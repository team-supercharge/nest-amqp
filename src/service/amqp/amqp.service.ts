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

import { getLoggerContext, Logger } from '../../util';
import { QueueModuleOptions } from '../../interface';
import { AMQP_CLIENT_TOKEN, AMQP_CONNECTION_RECONNECT, QUEUE_MODULE_OPTIONS } from '../../constant';
import { NestAmqpInvalidConnectionProtocolException } from '../../exception';

/**
 * Can create a single connection and manage the senders and receivers for it.
 *
 * @public
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

    logger.log('creating AMQP client');

    const { throwExceptionOnConnectionError, connectionUri, ...rheaConnectionOptions } = options;
    const parsedConnectionUri = new URL(connectionUri);
    const { protocol, hostname, port } = parsedConnectionUri;
    const username = decodeURIComponent(parsedConnectionUri.username);
    const password = decodeURIComponent(parsedConnectionUri.password);

    logger.log(
      `initializing client connection to ${JSON.stringify({
        protocol,
        username,
        password: '*****',
        hostname,
        port,
      })}`,
    );

    const transport: ConnectionOptions['transport'] = this.getTransport(protocol);

    const connection = new Connection({
      password,
      username,
      transport,
      host: hostname,
      port: Number.parseInt(port, 10),
      ...rheaConnectionOptions,
    });

    connection.on(ConnectionEvents.connectionOpen, (_: EventContext) => {
      logger.log('connection opened');
    });

    connection.on(ConnectionEvents.connectionClose, (context: EventContext) => {
      if (!context.error) {
        logger.log('connection closed');
        return;
      }

      // If there was an error, try to reconnect in 1 second
      logger.error(`connection closed with error: ${context.error.name} - ${context.error.message}`, context.error.stack);

      const timeoutHandler = setTimeout(async () => {
        (context.connection as any)._connection.dispatch(ConnectionEvents.disconnected, void 0);
        await context.connection
          .open()
          .then(() => {
            logger.log('connection successfully reopened');
            const emitted = AMQPService.eventEmitter.emit(AMQP_CONNECTION_RECONNECT);

            // istanbul ignore next: mocking out the event emitter is unnecessary
            if (!emitted) {
              logger.warn('reconnect event not emitted');
            }
          })
          .catch(error => {
            logger.error(`reopening connection failed with error: ${error.message}`, error);
          });
        clearTimeout(timeoutHandler);
      }, 1000);
    });

    connection.on(ConnectionEvents.connectionError, (context: EventContext) => {
      logger.error(`connection errored: ${context.error.message}`, context.error.stack);
    });

    connection.on(ConnectionEvents.disconnected, (context: EventContext) => {
      const error = context?.error ?? context?._context?.error ?? null;
      // istanbul ignore next
      logger.warn(`connection closed by peer: ${error?.message ?? ''}`, error?.stack);
    });

    try {
      await connection.open();
    } catch (error) {
      logger.error(`connection error: ${error.message}`, error);

      if (throwExceptionOnConnectionError === true) {
        throw error;
      }
    }
    logger.log('created AMQP connection');

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
    logger.log('disconnecting from queue');

    // disconnect queue
    await this.connection.close();

    logger.log('queue disconnected');
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
   * @param {string} queue Name of the queue.
   * @return {AwaitableSender} Sender.
   */
  public async createSender(queue: string): Promise<AwaitableSender> {
    const sender = await this.connection.createAwaitableSender({ target: queue });

    sender.on(SenderEvents.senderOpen, (context: EventContext) => {
      logger.log(`sender for ${context.sender.address} opened`);
    });

    sender.on(SenderEvents.senderClose, (context: EventContext) => {
      logger.log(`sender for ${context.sender.address} closed`);
    });

    sender.on(SenderEvents.senderError, (context: EventContext) => {
      logger.error(
        `sender errored: ${JSON.stringify({
          name: context.sender.address,
          error: context.sender.error,
        })}`,
      );
    });

    sender.on(SenderEvents.senderDraining, (context: EventContext) => {
      logger.log(`sender for ${context.sender.address} requested to drain its credits by remote peer`);
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
      logger.error(
        `receiver for ${context.receiver.address} errored: ${JSON.stringify({
          error: context.receiver.error,
        })}`,
      );
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
      logger.log(`receiver of ${context.receiver.address} opened`);

      const currentCredits = context.receiver.credit;

      // istanbul ignore next
      if (currentCredits < credits) {
        logger.debug('receiver does not have credits, adding credits');

        context.receiver.addCredit(credits - currentCredits);
      }
    });

    receiver.on(ReceiverEvents.receiverClose, (context: EventContext) => {
      logger.log(`receiver of ${context.receiver.address} closed`);
    });

    receiver.on(ReceiverEvents.receiverDrained, (context: EventContext) => {
      logger.debug(`remote peer for receiver of ${context.receiver.address} drained`);
    });

    receiver.on(ReceiverEvents.receiverFlow, (context: EventContext) => {
      logger.debug(`flow event received for receiver of ${context.receiver.address}`);
    });

    receiver.on(ReceiverEvents.settled, (context: EventContext) => {
      logger.debug(`message has been settled by remote for receiver of ${context.receiver.address}`);
    });

    logger.log(
      `receiver created: ${JSON.stringify({
        credits: receiver.credit,
        source: receiver.source,
      })}`,
    );

    return receiver;
  }

  // istanbul ignore next
  private static getTransport(protocol: string): ConnectionOptions['transport'] {
    switch (protocol) {
      case 'amqp:':
        return 'tcp';
        break;
      case 'amqps:':
        return 'ssl';
        break;
      case 'amqp+ssl:':
        return 'ssl';
        break;
      case 'amqp+tls:':
        return 'tls';
        break;
      default:
        throw new NestAmqpInvalidConnectionProtocolException(`Not supported connection protocol: ${protocol}`);
    }
  }
}

const logger = new Logger(getLoggerContext(AMQPService.name));
