import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  AwaitableSender,
  Connection,
  ConnectionEvents,
  ConnectionOptions,
  EventContext,
  Receiver,
  ReceiverEvents,
  SenderEvents,
} from 'rhea-promise';
import { URL } from 'url';

import { Logger } from '../../util';
import { QueueModuleOptions } from '../../interface';
import { AMQP_CLIENT_TOKEN, AMQP_CONNECTION_RECONNECT, QUEUE_MODULE_OPTIONS } from '../../constant';
import { NestAmqpInvalidConnectionProtocolException } from '../../exception';

type PropType<TObj, TProp extends keyof TObj> = TObj[TProp];

/**
 * Can create a single connection and manage the senders and receivers for it.
 *
 * @publicApi
 */
@Injectable()
export class AMQPService {
  /**
   * Event emitter for AMQP to show what is happening with the created connection.
   */
  public static readonly eventEmitter: EventEmitter = new EventEmitter();

  /**
   * Parses the connection URI and connect to the message broker by the given
   * information.
   *
   * NOTE: If the connection closes and there was no error then the service will
   * attempt to reconnect to the message broker but only once.
   *
   * ```ts
   * const connection = await AMQPService.createConnection({ connectionUri: 'amqp://user:password@localhost:5672' });
   * ```
   *
   * @param {QueueModuleOptions} [options] Options for the module.
   * @return {Connection} The created `rhea-promise` Connection.
   * @static
   */
  public static async createConnection(options: QueueModuleOptions): Promise<Connection> {
    if (Object.prototype.toString.call(options) !== '[object Object]') {
      throw new Error('AMQPModule connection options must an object');
    }

    logger.info('creating AMQP client');

    const { throwExceptionOnConnectionError, connectionUri, ...rheaConnectionOptions } = options;
    const { protocol, username, password, hostname, port } = new URL(connectionUri);

    logger.info('initializing client connection to', {
      protocol,
      username,
      password: '*****',
      hostname,
      port,
    });

    let transport: PropType<ConnectionOptions, 'transport'>;
    switch (protocol) {
      case 'amqp:':
        transport = 'tcp';
        break;
      case 'amqps:':
        transport = 'ssl';
        break;
      case 'amqp+ssl:':
        transport = 'ssl';
        break;
      case 'amqp+tls:':
        transport = 'tls';
        break;
      default:
        throw new NestAmqpInvalidConnectionProtocolException(`Not supported connection protocol: ${protocol}`);
    }

    const connection = new Connection({
      password,
      username,
      transport,
      host: hostname,
      port: Number.parseInt(port, 10),
      ...rheaConnectionOptions,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connection.on(ConnectionEvents.connectionOpen, (_: EventContext) => {
      logger.info('connection opened');
    });

    connection.on(ConnectionEvents.connectionClose, (context: EventContext) => {
      logger.info('connection closed', context.error || '');

      if (!!context.error) {
        setTimeout(async () => {
          context.connection.emit(ConnectionEvents.disconnected);
          await context.connection
            .open()
            .then(() => {
              logger.info('connection successfully reopened');
              const emitted = AMQPService.eventEmitter.emit(AMQP_CONNECTION_RECONNECT);

              if (!emitted) {
                logger.warn('reconnect event not emitted');
              }
            })
            .catch(error => {
              logger.error('reopening connection failed with error', error);
            });
        }, 1000);
      }
    });

    connection.on(ConnectionEvents.connectionError, (context: EventContext) => {
      logger.error('connection errored', context.error);
    });

    connection.on(ConnectionEvents.disconnected, (context: EventContext) => {
      logger.warn('connection closed by peer', context);
    });

    try {
      await connection.open();
    } catch (err) {
      logger.error('connection error', err);

      if (throwExceptionOnConnectionError === true) {
        throw err;
      }
    }
    logger.info('created AMQP connection');

    return connection;
  }

  constructor(
    @Inject(QUEUE_MODULE_OPTIONS) private readonly moduleOptions: QueueModuleOptions,
    @Inject(AMQP_CLIENT_TOKEN) private readonly connection: Connection,
  ) {}

  /**
   * Closes the created connection.
   */
  public async disconnect(): Promise<void> {
    logger.info('disconnecting from queue');

    // disconnect queue
    await this.connection.close();

    logger.info('queue disconnected');
  }

  /**
   * Returns the connection object with which the AMQP connection was created.
   *
   * @return {QueueModuleOptions} Connection options.
   */
  public getModuleOptions(): QueueModuleOptions {
    return { ...this.moduleOptions };
  }

  /**
   * Creates a sender object which will send the message to the given queue.
   *
   * @param {string} queueName Name of the queue.
   * @return {AwaitableSender} Sender.
   */
  public async createSender(queueName: string): Promise<AwaitableSender> {
    const sender = await this.connection.createAwaitableSender({
      target: queueName,
    });

    sender.on(SenderEvents.senderOpen, (context: EventContext) => {
      logger.info('sender opened', { name: context.sender.address });
    });

    sender.on(SenderEvents.senderClose, (context: EventContext) => {
      logger.info('sender closed', { name: context.sender.address });
    });

    sender.on(SenderEvents.senderError, (context: EventContext) => {
      logger.error('sender errored', {
        name: context.sender.address,
        error: context.sender.error,
      });
    });

    sender.on(SenderEvents.senderDraining, (context: EventContext) => {
      logger.info('sender requested to drain its credits by remote peer', {
        name: context.sender.address,
      });
    });

    return sender;
  }

  /**
   * Creates a receiver object which will send the message to the given queue.
   *
   * @param {string} queueName Name of the queue.
   * @param {number} credits How many message can be processed parallel.
   * @param {function(context: EventContext): Promise<void>} onMessage Function what will be invoked when a message arrives.
   * @return {Receiver} Receiver.
   */
  public async createReceiver(queueName: string, credits: number, onMessage: (context: EventContext) => Promise<void>): Promise<Receiver> {
    const onError = (context: EventContext) => {
      logger.error('receiver errored', {
        source: context.receiver.address,
        error: context.receiver.error,
      });
    };

    const receiver: Receiver = await this.connection.createReceiver({
      onError,
      onMessage,
      source: queueName,
      autoaccept: false,
      credit_window: 0,
    });

    receiver.addCredit(credits);

    receiver.on(ReceiverEvents.receiverOpen, (context: EventContext) => {
      logger.info('receiver opened', { source: context.receiver.address });

      const currentCredits = context.receiver.credit;

      if (currentCredits < credits) {
        logger.debug('receiver does not have credits, adding credits');

        context.receiver.addCredit(credits - currentCredits);
      }
    });

    receiver.on(ReceiverEvents.receiverClose, (context: EventContext) => {
      logger.info('receiver closed', { queue: context.receiver.address });
    });

    receiver.on(ReceiverEvents.receiverDrained, (context: EventContext) => {
      logger.debug('remote peer for receiver drained', {
        queue: context.receiver.address,
      });
    });

    receiver.on(ReceiverEvents.receiverFlow, (context: EventContext) => {
      logger.debug('flow event received for receiver', {
        queue: context.receiver.address,
      });
    });

    receiver.on(ReceiverEvents.settled, (context: EventContext) => {
      logger.debug('message has been settled by remote', {
        queue: context.receiver.address,
      });
    });

    logger.info('receiver created', {
      credits: receiver.credit,
      source: receiver.source,
    });

    return receiver;
  }
}

const logger = new Logger(AMQPService.name);
