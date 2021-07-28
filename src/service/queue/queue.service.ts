import { Injectable } from '@nestjs/common';
import { AwaitableSender, Delivery, EventContext, Message, Receiver } from 'rhea-promise';

import {
  extendObject,
  sleep,
  tryParseJSON,
  ValidationNullObjectException,
  Logger,
  getLoggerContext,
  ValidationException,
} from '../../util';
import { MessageControl } from '../../domain';
import { SendState } from '../../enum';
import { AMQPService, ObjectValidatorService } from '..';
import { ListenOptions, SendOptions } from '../../interface';

const PARALLEL_MESSAGE_COUNT = 1;
const toString = Object.prototype.toString;

/**
 * Handles queue receivers and senders for the created connection.
 */
@Injectable()
export class QueueService {
  private readonly receivers: Map<string, Receiver>;
  private readonly senders: Map<string, AwaitableSender>;

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
   * @param {string} queueName Name of the queue.
   * @param {function(object: T, control: MessageControl) => Promise<void>} callback Function what will invoked when message arrives.
   * @param {ListenOptions<T>} [options] Options for message processing.
   *
   * @public
   */
  public async listen<T>(
    queueName: string,
    callback: (object: T, control: MessageControl) => Promise<void>,
    options: ListenOptions<T>,
  ): Promise<void> {
    // get receiver
    const initialCredit = !!options && options.parallelMessageProcessing ? options.parallelMessageProcessing : PARALLEL_MESSAGE_COUNT;
    const transformerOptions = !!options && options.transformerOptions ? options.transformerOptions : {};
    const validatorOptions = !!options && options.validatorOptions ? options.validatorOptions : {};

    const messageValidator = async (context: EventContext, control: MessageControl) => {
      logger.verbose(`incoming message on queue '${queueName}'`);

      const body: any = context.message.body;
      let object: T;

      // if not expecting parsed data
      if (!options || options.type === null || options.type === undefined) {
        object = null;
      }
      // if expecting parsed data
      else {
        let parsed: any;

        // parse body received as string from queue
        try {
          parsed = this.decodeMessage(body);
        } catch (error) {
          logger.error('cant decode message', body);

          // can't decode, need to reject message
          control.reject(error.message);

          return;
        }

        try {
          // HACK - change for better solution, when available
          // Explanation: Class-transformer supports differentiating on type and using different classes, but currently the discriminator can only be
          // inside the nested object. This extra property will be deleted during transformation
          // istanbul ignore next
          if (parsed && parsed.type && parsed.payload) {
            parsed.payload.type = parsed.type;
          }

          object =
            options && options.noValidate
              ? parsed
              : await this.objectValidatorService.validate(options.type, parsed, { transformerOptions, validatorOptions });
        } catch (error) {
          if (error instanceof ValidationNullObjectException) {
            logger.error(`null received as body on ${context.receiver.address}`);

            const { acceptValidationNullObjectException } = this.amqpService.getModuleOptions();
            if (acceptValidationNullObjectException === true) {
              control.accept();
            } else {
              control.reject(error.message);
            }

            return;
          }

          // istanbul ignore else
          if (error instanceof ValidationException) {
            logger.error(`validation error ${queueName} (payload: ${JSON.stringify(parsed)}): ${error.message}`, error.stack);
          } else {
            const parsedError = tryParseJSON(error.message) || error.message;

            logger.error(
              `unexpected error happened during validation process on '${queueName}' (payload: ${JSON.stringify(
                parsed,
              )}): ${parsedError.toString()}`,
              error,
            );
          }

          // can't validate, need to reject message
          control.reject(error.message);

          return;
        }
      }

      try {
        // run callback function
        const startTime = new Date();
        await callback(object, control);
        const durationInMs = new Date().getTime() - startTime.getTime();
        logger.log(`handling '${queueName}' finished in ${durationInMs} (ms)`);

        // handle auto-accept when message is otherwise not handled
        if (!control.isHandled()) {
          control.accept();
        }
      } catch (error) {
        logger.error(`error in callback on queue '${queueName}': ${error.message}`, error);

        // can't process callback, need to reject message
        control.reject(error.message);
      }

      logger.verbose(`handled message on queue '${queueName}'`);
    };

    const messageHandler = async (context: EventContext) => {
      const control: MessageControl = new MessageControl(context);

      messageValidator(context, control).catch(error => {
        logger.error(`unexpected error happened during message validation on '${context.receiver.address}': ${error.message}`, error);
        control.reject(error.message);
      });
    };
    await this.getReceiver(queueName, initialCredit, messageHandler);
  }

  /**
   * Creates a sender which will send messages to the given queue. If a sender
   * is already created for the queue then a new sender won't be created.
   *
   * @param {string} target Name of the queue.
   * @param {T} message Message body.
   * @param {SendOptions} [options] Options for message sending.
   *
   * @return {Promise<SendState>} Result of sending the message.
   *
   * @public
   */
  public async send<T = any>(target: string, message: T, options?: SendOptions): Promise<SendState> {
    // get sender
    const sender: AwaitableSender = await this.getSender(target);
    const { schedule, ...baseOptions } = options || {};

    // TODO: refactor messageToSend creation using state object or state switch
    let messageToSend: Message;

    // scheduling
    if (schedule && schedule.cron) {
      // when using CRON syntax, simply add it to the message
      // NOD: not possible to use seconds
      messageToSend = {
        body: this.encodeMessage(message),
        message_annotations: {
          'x-opt-delivery-cron': schedule.cron,
        },
      };
    } else if (schedule && schedule.divideMinute) {
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
    } else if (schedule && schedule.afterSeconds) {
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
    if (options && options.ttl) {
      logger.debug(`setting ttl on message with ${options.ttl} ms`);

      messageToSend.ttl = options.ttl;
    }

    logger.verbose(`outgoing message to queue '${target}', payload: ${JSON.stringify(messageToSend)}`);

    // send message
    const delivery: Delivery = await sender.send(messageToSend);

    return delivery.sent ? SendState.Success : SendState.Failed;
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

    // disconnect queue connection
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

  private async getReceiver(
    queueName: string,
    credit: number,
    messageHandler: (context: EventContext) => Promise<void>,
  ): Promise<Receiver> {
    let receiver;

    if (this.receivers.has(queueName)) {
      receiver = this.receivers.get(queueName);
    } else {
      receiver = await this.amqpService.createReceiver(queueName, credit, messageHandler.bind(this));

      this.receivers.set(queueName, receiver);
    }

    return receiver;
  }

  private async getSender(target: string): Promise<AwaitableSender> {
    let sender;

    if (this.senders.has(target)) {
      sender = this.senders.get(target);
    } else {
      sender = await this.amqpService.createSender(target);

      this.senders.set(target, sender);
    }

    return sender;
  }

  private encodeMessage(message: any): string {
    return JSON.stringify(message);
  }

  private decodeMessage(message: string | Record<string, any> | Buffer): Record<string, any> {
    if (toString.call(message) === '[object Object]') {
      return message as Record<string, any>;
    }

    const objectLike: string = message instanceof Buffer ? message.toString() : (message as string);
    const object = JSON.parse(objectLike);

    return object;
  }
}

const logger = new Logger(getLoggerContext(QueueService.name));
