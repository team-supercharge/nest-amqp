import { Injectable } from '@nestjs/common';
import { isDefined } from 'class-validator';
import { AwaitableSender, Delivery, EventContext, Message, Receiver, Source } from 'rhea-promise';
import type { Except } from 'type-fest';

import {
  extendObject,
  getLoggerContext,
  Logger,
  RetryStrategy,
  MessageCodec,
  MessageFactory,
  ObjectValidatorService,
  sleep,
  ValidationException,
  ValidationNullObjectException,
} from '../../util';
import { MessageControl } from '../../domain';
import { SendState } from '../../enum';
import { ListenOptions, SendOptions } from '../../interface';

import { AMQPService } from '../amqp/amqp.service';

const PARALLEL_MESSAGE_COUNT = 1;

/**
 * Handles queue receivers and senders for a single AMQP connection.
 * Coordinates message sending/receiving with validation and encoding.
 *
 * @public
 */
@Injectable()
export class QueueService {
  private readonly receivers: Map<string, Receiver>;
  private readonly senders: Map<string, AwaitableSender>;

  constructor(
    private readonly amqpService: AMQPService,
    private readonly objectValidatorService: ObjectValidatorService,
    private readonly codec: MessageCodec,
    private readonly messageFactory: MessageFactory,
  ) {
    this.receivers = new Map<string, Receiver>();
    this.senders = new Map<string, AwaitableSender>();
  }

  /**
   * Creates a receiver which will listen to messages on the given queue.
   * The callback function will be invoked with the body and message control objects.
   *
   * @param source Name or Source object of the queue.
   * @param callback Function invoked when message arrives.
   * @param options Options for message processing.
   * @param connectionName Name of the connection to use
   *
   * @public
   */
  public async listen<T>(
    source: string | Source,
    callback: (body: T, control: MessageControl, metadata: Except<Message, 'body'>) => Promise<void>,
    options: ListenOptions<T>,
    connectionName: string,
  ): Promise<void> {
    const sourceToken = typeof source === 'string' ? source : source.address;
    const initialCredit = options?.parallelMessageProcessing ?? PARALLEL_MESSAGE_COUNT;

    const messageHandler = async (context: EventContext) => {
      const control: MessageControl = new MessageControl(context);

      logger.verbose(`incoming message on queue '${sourceToken}'`);

      const { body: messageBody, ...metadata } = context.message ?? {};

      const body = await this.getMessageBody(messageBody, options, control, sourceToken);

      const startTime = new Date();
      await callback(body, control, metadata)
        .then(() => {
          if (!control.isHandled) control.accept();
        })
        .catch((error: Error) => {
          logger.error(`error in callback on queue '${sourceToken}': ${error.message}`, error.stack);
          control.reject(error.message);
        });

      const durationInMs = new Date().getTime() - startTime.getTime();
      logger.log(`handling '${sourceToken}' finished in ${durationInMs} (ms)`);
      logger.verbose(`handled message on queue '${sourceToken}'`);
    };

    await this.getReceiver(source, initialCredit, messageHandler, connectionName);
  }

  /**
   * Sends a message to the given queue.
   *
   * @param target Name of the queue.
   * @param message Message body.
   * @param sendOptions Optional send options.
   * @param connectionName Name of the connection to use
   * @returns SendState indicating success/failure
   *
   * @public
   */
  public async send<T>(
    target: string,
    message: T,
    sendOptions?: SendOptions,
    connectionName?: string,
  ): Promise<SendState> {
    const options = sendOptions ?? {};
    const { schedule, ...baseOptions } = options;

    const messageToSend = this.messageFactory.build(message, schedule);
    extendObject(messageToSend, baseOptions);

    logger.verbose(`outgoing message to queue '${target}', payload: ${JSON.stringify(messageToSend)}`);

    const sender: AwaitableSender = await this.getSender(target, connectionName);
    const delivery: Delivery = await sender.send(messageToSend);

    return delivery.sent || delivery.settled ? SendState.Success : SendState.Failed;
  }

  /**
   * Closes all receivers and disconnects.
   *
   * @public
   */
  public async shutdown(): Promise<void> {
    logger.log('shutting down queue processing');

    const receivers: Receiver[] = Array.from(this.receivers.values());

    for (const receiver of receivers) {
      await receiver.close();

      while (receiver.connection.isOpen() && receiver.credit === 0) {
        logger.log(`waiting to finish queue processing`);
        await sleep(1000);
      }
    }

    await this.amqpService.disconnect();

    logger.log('queue processing stopped');
  }

  /**
   * Clears all cached senders and receivers.
   *
   * @public
   */
  public clearSenderAndReceiverLinks(): void {
    logger.warn('clearing senders and receivers');
    this.senders.clear();
    this.receivers.clear();
  }

  /**
   * Removes a specific listener.
   *
   * @param source Name or Source object of the queue.
   * @param connectionName Name of the connection
   * @returns True if removed, false if not found
   *
   * @public
   */
  public async removeListener(source: string | Source, connectionName: string): Promise<boolean> {
    const sourceToken = typeof source === 'string' ? source : JSON.stringify(source);
    const receiverToken = this.getLinkToken(sourceToken);

    if (this.receivers.has(receiverToken)) {
      const receiver = this.receivers.get(receiverToken);
      await receiver?.close();
      return this.receivers.delete(receiverToken);
    }

    return false;
  }

  private async getReceiver(
    source: string | Source,
    credit: number,
    messageHandler: (context: EventContext) => Promise<void>,
    connectionName: string,
  ): Promise<Receiver> {
    const sourceToken = typeof source === 'string' ? source : JSON.stringify(source);
    const receiverToken = this.getLinkToken(sourceToken);

    if (this.receivers.has(receiverToken)) {
      return this.receivers.get(receiverToken)!;
    }

    const connectionOptions = this.amqpService.getConnectionOptions(connectionName);
    const retryConfig = connectionOptions.retryConnection?.receiver;

    const receiver = await RetryStrategy.execute(
      () => this.amqpService.createReceiver(source, credit, messageHandler.bind(this), connectionName),
      retryConfig,
      `receiver for ${sourceToken}`,
    );

    this.receivers.set(receiverToken, receiver);
    return receiver;
  }

  private async getSender(target: string, connectionName: string): Promise<AwaitableSender> {
    const senderToken = this.getLinkToken(target);

    if (this.senders.has(senderToken)) {
      return this.senders.get(senderToken)!;
    }

    const connectionOptions = this.amqpService.getConnectionOptions(connectionName);
    const retryConfig = connectionOptions.retryConnection?.sender;

    const sender = await RetryStrategy.execute(
      () => this.amqpService.createSender(target, connectionName),
      retryConfig,
      `sender for ${target}`,
    );

    this.senders.set(senderToken, sender);
    return sender;
  }

  private getLinkToken(sourceToken: string): string {
    return sourceToken;
  }

  private async getMessageBody<T>(
    messageBody: unknown,
    options: ListenOptions<T>,
    control: MessageControl,
    source: string,
  ): Promise<T | null | undefined> {
    if (!isDefined(options?.type)) {
      return null;
    }

    try {
      const parsed = this.codec.decode<T>(messageBody);

      const transformerOptions = options?.transformerOptions;
      const validatorOptions = options?.validatorOptions;

      if (options.skipValidation) return parsed;

      try {
        return await this.objectValidatorService.validate(options.type, parsed, { transformerOptions, validatorOptions });
      } catch (err) {
        const error = err as Error;

        if (error instanceof ValidationNullObjectException) {
          logger.error(`null received as body on ${source}`);

          if ((options.acceptValidationNullObjectException ?? false) === true) {
            control.accept();
          } else {
            control.reject(error.message);
          }

          return undefined;
        }

        // istanbul ignore else
        if (error instanceof ValidationException) {
          logger.error(`validation error ${source} (payload: ${JSON.stringify(parsed)}): ${error.message}`, error.stack);

          control.reject('validation failed');
          return undefined;
        }

        const parsedError = parseJson(error.message) || error.message;

        logger.error(
          `unexpected error happened during validation process on '${source}' (payload: ${JSON.stringify(
            parsed,
          )}): ${parsedError.toString()}`,
          error.stack,
        );
      }
    } catch (error) {
      logger.error(`cant decode message: ${messageBody}`);

      // can't decode, need to reject message
      control.reject((error as Error).message);
    }

    return undefined;
  }
}

const logger = new Logger(getLoggerContext(QueueService.name));

const parseJson = (json: string): Record<string, any> => {
  try {
    if (typeof json !== 'string') {
      return undefined;
    }

    return JSON.parse(json);
  } catch (error) {
    logger.error(`Error parsing JSON: ${(error as Error).message}`);
    return undefined;
  }
};
