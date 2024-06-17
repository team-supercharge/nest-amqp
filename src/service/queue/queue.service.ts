import { Injectable } from '@nestjs/common';
import { isDefined } from 'class-validator';
import { AwaitableSender, Delivery, EventContext, Message, Receiver, Source } from 'rhea-promise';

import {
  extendObject,
  getLoggerContext,
  Logger,
  sleep,
  tryParseJSON,
  ValidationException,
  ValidationNullObjectException,
} from '../../util';
import { MessageControl } from '../../domain';
import { SendState } from '../../enum';
import { ListenOptions, SendOptions } from '../../interface';
import { AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';

import { AMQPService } from '../amqp/amqp.service';
import { ObjectValidatorService } from '../object-validator/object-validator.service';

const PARALLEL_MESSAGE_COUNT = 1;
const toString = Object.prototype.toString;

/**
 * Handles queue receivers and senders for the created connection.
 */
@Injectable()
export class QueueService {
  private readonly receivers: Map<string, Receiver>;
  private readonly senders: Map<string, AwaitableSender>;
  private readonly reconnectDelay: number = 5000; // 5 seconds

  constructor(private readonly amqpService: AMQPService, private readonly objectValidatorService: ObjectValidatorService) {
    // this means only one sender and receiver / app / queue
    this.receivers = new Map<string, Receiver>();
    this.senders = new Map<string, AwaitableSender>();
  }

  /**
   * Creates a receiver which will listen to message on the given queue. The
   * callback function will invoked with the body and the message control
   * objects when a new message arrives on the queue. If a receiver is already
   * created for the given queue then a new receiver won't be created.
   *
   * @param {string} source Name or Source object of the queue.
   * @param {function(body: T, control: MessageControl, metadata: Omit<Message, 'body'>) => Promise<void>} callback Function what will invoked when message arrives.
   * @param {ListenOptions<T>} options Options for message processing.
   * @param {string} connection Name of the connection
   *
   * @public
   */
  public async listen<T>(
    source: string | Source,
    callback: (body: T, control: MessageControl, metadata: Omit<Message, 'body'>) => Promise<void>,
    options: ListenOptions<T>,
    connection: string = AMQP_DEFAULT_CONNECTION_TOKEN,
  ): Promise<void> {
    const sourceToken = typeof source === 'string' ? source : source.address;

    // get receiver
    const initialCredit = options?.parallelMessageProcessing ?? PARALLEL_MESSAGE_COUNT;
    const transformerOptions = options?.transformerOptions ?? {};
    const validatorOptions = options?.validatorOptions ?? null;

    const messageValidator = async (context: EventContext, control: MessageControl) => {
      logger.verbose(`incoming message on queue '${sourceToken}'`);

      const messageBody: any = context.message.body;
      const metadata: Omit<Message, 'body'> = extendObject(context.message, { body: undefined });

      let body: T;

      // if not expecting parsed data
      if (!options || !isDefined(options.type)) {
        body = null;
      } else {
        // if expecting parsed data
        let parsed: any;

        // parse body received as string from queue
        try {
          parsed = this.decodeMessage(messageBody);
        } catch (error) {
          logger.error('cant decode message', messageBody);

          // can't decode, need to reject message
          control.reject((error as Error).message);

          return;
        }

        try {
          // HACK - change for better solution, when available
          // Explanation: Class-transformer supports differentiating on type and using different classes, but currently the discriminator can only be
          // inside the nested object. This extra property will be deleted during transformation
          // istanbul ignore next
          if (isDefined(parsed?.type) && isDefined(parsed?.payload)) {
            parsed.payload.type = parsed.type;
          }

          body =
            options && (options.noValidate || options.skipValidation)
              ? parsed
              : await this.objectValidatorService.validate(options.type, parsed, { transformerOptions, validatorOptions });
        } catch (error) {
          if (error instanceof ValidationNullObjectException) {
            logger.error(`null received as body on ${context.receiver.address}`);

            const acceptValidationNullObjectException = options.acceptValidationNullObjectException ?? false;
            if (acceptValidationNullObjectException === true) {
              control.accept();
            } else {
              control.reject(error.message);
            }

            return;
          }

          // istanbul ignore else
          if (error instanceof ValidationException) {
            logger.error(`validation error ${sourceToken} (payload: ${JSON.stringify(parsed)}): ${error.message}`, error.stack);
          } else {
            const parsedError = tryParseJSON((error as Error).message) || (error as Error).message;

            logger.error(
              `unexpected error happened during validation process on '${sourceToken}' (payload: ${JSON.stringify(
                parsed,
              )}): ${parsedError.toString()}`,
              (error as Error).stack,
            );
          }

          // can't validate, need to reject message
          control.reject((error as Error).message);

          return;
        }
      }

      try {
        // run callback function
        const startTime = new Date();
        await callback(body, control, metadata);
        const durationInMs = new Date().getTime() - startTime.getTime();
        logger.log(`handling '${sourceToken}' finished in ${durationInMs} (ms)`);

        // handle auto-accept when message is otherwise not handled
        // istanbul ignore next
        if (!control.isHandled()) {
          control.accept();
        }
      } catch (error) {
        logger.error(`error in callback on queue '${sourceToken}': ${(error as Error).message}`, (error as Error).stack);

        // can't process callback, need to reject message
        control.reject((error as Error).message);
      }

      logger.verbose(`handled message on queue '${sourceToken}'`);
    };

    const messageHandler = async (context: EventContext) => {
      const control: MessageControl = new MessageControl(context);

      messageValidator(context, control).catch(error => {
        logger.error(`unexpected error happened during message validation on '${context.receiver.address}': ${error.message}`, error);
        control.reject(error.message);
      });
    };
    await this.getReceiver(source, initialCredit, messageHandler, connection);
  }

  /**
   * Creates a sender which will send messages to the given queue. If a sender
   * is already created for the queue then a new sender won't be created.
   *
   * @param {string} target Name of the queue.
   * @param {T} message Message body.
   * @param {SendOptions} sendOptions Options for message sending.
   * @param {string} connectionName Name of the connection the Sender should be attached to
   *
   * @return {Promise<SendState>} Result of sending the message.
   *
   * @public
   */
  public async send<T>(target: string, message: T): Promise<SendState>;
  public async send<T>(target: string, message: T, sendOptions: SendOptions): Promise<SendState>;
  public async send<T>(target: string, message: T, connectionName: string): Promise<SendState>;
  public async send<T>(target: string, message: T, sendOptions: SendOptions, connectionName: string): Promise<SendState>;
  public async send<T>(target: string, message: T, sendOptions?: SendOptions | string, connectionName?: string): Promise<SendState> {
    const connection =
      connectionName ?? (typeof sendOptions === 'string' ? (sendOptions as string) : (AMQP_DEFAULT_CONNECTION_TOKEN as string));
    const options = toString.call(sendOptions) === '[object Object]' ? (sendOptions as SendOptions) : {};

    // get sender
    const sender: AwaitableSender = await this.getSender(target, connection);
    const { schedule, ...baseOptions } = options;

    // TODO: refactor messageToSend creation using state object or state switch
    let messageToSend: Message;

    // scheduling
    if (isDefined(schedule?.cron)) {
      // when using CRON syntax, simply add it to the message
      // NOD: not possible to use seconds
      messageToSend = {
        body: this.encodeMessage(message),
        message_annotations: {
          'x-opt-delivery-cron': schedule.cron,
        },
      };
    } else if (schedule?.divideMinute) {
      const period = Math.floor(60000 / schedule.divideMinute);
      const repeat = schedule.divideMinute - 1;

      // compose schedule
      messageToSend = {
        body: this.encodeMessage(message),
        message_annotations: {
          'x-opt-delivery-cron': '* * * * *', // trigger every minute
          'x-opt-delivery-delay': 0,
          'x-opt-delivery-period': period,
          'x-opt-delivery-repeat': repeat,
        },
      };
    } else if (isDefined(schedule?.afterSeconds)) {
      const milliseconds = schedule.afterSeconds * 1000;
      const now = new Date();

      logger.debug(
        `scheduling queue message for delivery after ${milliseconds} ms at around`,
        new Date(now.getTime() + milliseconds).toISOString(),
      );

      // compose schedule
      messageToSend = {
        body: this.encodeMessage(message),
        message_annotations: {
          'x-opt-delivery-delay': milliseconds,
        },
      };
    } else {
      messageToSend = {
        body: this.encodeMessage(message),
      };
    }

    // add other options to the message
    extendObject(messageToSend, baseOptions);

    // TTL handling
    // istanbul ignore if
    if (isDefined(options?.ttl)) {
      logger.debug(`setting ttl on message with ${options.ttl} ms`);

      messageToSend.ttl = options.ttl;
    }

    logger.verbose(`outgoing message to queue '${target}', payload: ${JSON.stringify(messageToSend)}`);

    // send message
    const delivery: Delivery = await sender.send(messageToSend);

    // istanbul ignore next: SendState is dependent on broker, very hard to mock out
    return delivery.sent || delivery.settled ? SendState.Success : SendState.Failed;
  }

  /**
   * Closes the connection to the message broker. Waits for all running
   * processes to complete.
   */
  public async shutdown(): Promise<void> {
    logger.log('shutting down queue processing');

    // stop receiving
    const receivers: Receiver[] = Array.from(this.receivers.values());

    for (const receiver of receivers) {
      await receiver.close();

      while (receiver.connection.isOpen() && receiver.credit === 0) {
        logger.log(`waiting to finish queue processing`);
        await sleep(1000);
      }
    }

    // disconnect queue connections

    await this.amqpService.disconnect();

    logger.log('queue processing stopped');
  }

  /**
   * Clears the existing senders and receivers.
   */
  public clearSenderAndReceiverLinks(): void {
    logger.warn('clearing senders and receivers');
    this.senders.clear();
    this.receivers.clear();
  }

  /**
   * Removes listener from active listeners
   *
   * @param {string} source Name or Source object of the queue.
   * @param {string} connection Name of the connection
   *
   * @returns {Promise<boolean>} Returns true if listener was removed, otherwise false. If listener was not found, returns false.
   *
   * @public
   */
  public async removeListener(source: string | Source, connection: string = AMQP_DEFAULT_CONNECTION_TOKEN): Promise<boolean> {
    const sourceToken = typeof source === 'string' ? source : JSON.stringify(source);
    const receiverToken = this.getLinkToken(sourceToken, connection);

    if (this.receivers.has(receiverToken)) {
      const receiver = this.receivers.get(receiverToken);
      await receiver.close();

      return this.receivers.delete(receiverToken);
    }

    return false;
  }

  private async getReceiver(
    source: string | Source,
    credit: number,
    messageHandler: (context: EventContext) => Promise<void>,
    connection: string,
  ): Promise<Receiver> {
    const sourceToken = typeof source === 'string' ? source : JSON.stringify(source);

    const receiverToken = this.getLinkToken(sourceToken, connection);

    if (this.receivers.has(receiverToken)) {
      return this.receivers.get(receiverToken);
    }

    try {
      const receiver = await this.amqpService.createReceiver(source, credit, messageHandler.bind(this), connection);
      this.receivers.set(receiverToken, receiver);
      return receiver;
    } catch (error) {
      logger.error(`Error creating receiver: ${error.message}`, error.stack);
      await sleep(this.reconnectDelay);
      return this.getReceiver(source, credit, messageHandler, connection);
    }
  }

  private async getSender(target: string, connection: string): Promise<AwaitableSender> {
    const senderToken = this.getLinkToken(target, connection);

    if (this.senders.has(senderToken)) {
      return this.senders.get(senderToken);
    }

    try {
      const sender = await this.amqpService.createSender(target, connection);
      this.senders.set(senderToken, sender);
      return sender;
    } catch (error) {
      logger.error(`Error creating sender: ${error.message}`, error.stack);
      await sleep(this.reconnectDelay);
      return this.getSender(target, connection);
    }
  }

  private encodeMessage(message: any): string {
    return JSON.stringify(message);
  }

  private decodeMessage(message: string | Record<string, any> | Buffer): Record<string, any> {
    if (toString.call(message) === '[object Object]') {
      return message as Record<string, any>;
    }

    const objectLike: string = message instanceof Buffer ? message.toString() : (message as string);
    return JSON.parse(objectLike);
  }

  private getLinkToken(sourceToken: string, connection: string): string {
    return `${connection}:${sourceToken}`;
  }
}

const logger = new Logger(getLoggerContext(QueueService.name));
