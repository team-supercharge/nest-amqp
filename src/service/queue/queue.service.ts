import { Injectable } from '@nestjs/common';
import { AwaitableSender, Delivery, EventContext, Message, Receiver } from 'rhea-promise';

import { extendObject, sleep, tryParseJSON, ValidationNullObjectException, Logger, ObjectValidator } from '../../util';
import { MessageControl } from '../../domain';
import { SendState } from '../../enum';
import { AMQPService } from '..';
import { ListenOptions, SendOptions } from '../../interface';

const PARALLEL_MESSAGE_COUNT = 1;
const toString = Object.prototype.toString;

/**
 * Handles queue receivers and senders for the created connection.
 *
 * @publicApi
 */
@Injectable()
export class QueueService {
  private readonly receivers: Map<string, Receiver>;
  private readonly senders: Map<string, AwaitableSender>;

  constructor(private readonly amqpService: AMQPService, private readonly objectValidator: ObjectValidator) {
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
   * @param {string} source Name of the queue.
   * @param {function(object: T, control: MessageControl) => Promise<void>} callback Function what will invoked when message arrives.
   * @param {ListenOptions<T>} [options] Options for message processing.
   */
  public async listen<T>(
    source: string,
    callback: (object: T, control: MessageControl) => Promise<void>,
    options: ListenOptions<T>,
  ): Promise<void> {
    // get receiver
    const initialCredit = !!options && options.parallelMessageProcessing ? options.parallelMessageProcessing : PARALLEL_MESSAGE_COUNT;
    const transformerOptions = !!options && options.transformerOptions ? options.transformerOptions : {};
    const validatorOptions = !!options && options.validatorOptions ? options.validatorOptions : {};

    const messageValidator = async (context: EventContext, control: MessageControl) => {
      logger.trace(`incoming message on queue ${source}`);

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
          // istanbul ignore if
          if (parsed && parsed.type && parsed.payload) {
            parsed.payload.type = parsed.type;
          }

          object =
            options && options.noValidate
              ? parsed
              : await this.objectValidator.validate(options.type, parsed, { transformerOptions, validatorOptions });
        } catch (error) {
          if (error instanceof ValidationNullObjectException) {
            logger.error(`null received as body on ${context.receiver.address}`);
            // HACK
            // TODO - Use control.reject for this error,
            // once AMQ Broker can handle the difference between reject and release
            // control.reject(error.message);
            control.accept();

            return;
          }

          const parsedError = tryParseJSON(error.message) || error.message;

          // istanbul ignore else
          if (Array.isArray(parsedError)) {
            logger.error(`validation error on ${source}`, error, { parsed });
          } else {
            logger.error(`unexpected error happened during validation process on ${source}`, error, { parsed });
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
        logger.info(`handling ${source} finished in ${durationInMs} (ms)`);

        // handle auto-accept when message is otherwise not handled
        if (!control.isHandled()) {
          control.accept();
        }
      } catch (error) {
        logger.error(`error in callback on ${source}`, error);

        // can't process callback, need to reject message
        control.reject(error.message);
      }

      logger.trace(`handled message on queue ${source}`);
    };

    const messageHandler = async (context: EventContext) => {
      const control: MessageControl = new MessageControl(context);

      messageValidator(context, control).catch(error => {
        logger.error('unexpected error happened during message validation', error, { source: context.receiver.address });
        control.reject(error.message);
      });
    };
    await this.getReceiver(source, initialCredit, messageHandler);
  }

  /**
   * Creates a sender which will send messages to the given queue. If a sender
   * is already created for the queue then a new sender won't be created.
   *
   * @param {string} target Name of the queue.
   * @param {T} message Message body.
   * @param {SendOptions} [options] Options for message sending.
   * @return {Promise<SendState>} State of send.
   */
  public async send<T = any>(target: string, message: T, options?: SendOptions): Promise<SendState> {
    // get sender
    const sender: AwaitableSender = await this.getSender(target);
    const { schedule, ...baseOptions } = options || {};

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
    extendObject(messageToSend, baseOptions || {});

    // TTL handling
    // istanbul ignore if
    if (options && options.ttl) {
      logger.debug(`setting ttl on message with ${options.ttl} ms`);
    }

    logger.trace(`outgoing message to queue ${target}`, messageToSend);

    // send message
    const delivery: Delivery = await sender.send(messageToSend);

    return delivery.sent ? SendState.Success : SendState.Failed;
  }

  /**
   * Closes the connection to the message broker. Waits for all running
   * processes to complete.
   */
  public async shutdown(): Promise<void> {
    logger.info('shutting down queue processing');

    // stop receiving
    const receivers: Receiver[] = Array.from(this.receivers.values());

    for (const receiver of receivers) {
      await receiver.close();

      while (receiver.credit === 0) {
        logger.info(`waiting to finish queue processing`);
        await sleep(1000);
      }
    }

    // disconnect queue connection
    await this.amqpService.disconnect();

    logger.info('queue processing stopped');
  }

  /**
   * Clears the existing senders and receivers.
   */
  public clearSenderAndReceiverLinks(): void {
    logger.warn('clearing senders and receivers');
    this.senders.clear();
    this.receivers.clear();
  }

  private async getReceiver(source: string, credit: number, messageHandler: (context: EventContext) => Promise<void>): Promise<Receiver> {
    let receiver;

    if (this.receivers.has(source)) {
      receiver = this.receivers.get(source);
    } else {
      receiver = await this.amqpService.createReceiver(source, credit, messageHandler.bind(this));

      this.receivers.set(source, receiver);
    }

    return receiver;
  }

  private async getSender(target: string): Promise<AwaitableSender> {
    let sender;

    if (this.senders.has(target)) {
      sender = this.senders.get(target);
    } else {
      sender = await this.amqpService.createSender(target);

      // TODO: handle more sender events

      this.senders.set(target, sender);
    }

    return sender;
  }

  private encodeMessage(message: any): string {
    return JSON.stringify(message);
  }

  private decodeMessage(message: any): any {
    if (toString.call(message) === '[object Object]') {
      return message;
    }

    const objectLike = message instanceof Buffer ? message.toString() : message;
    const object = JSON.parse(objectLike);

    return object;
  }
}

const logger = new Logger(QueueService.name);
