import { Message } from 'rhea-promise';

import { ObjectValidationOptions } from '../service';

/**
 * Interface defining options that can be passed to `@Listen()` decorator
 *
 * @publicApi
 */
export interface ListenOptions<T> extends ObjectValidationOptions {
  /**
   * Specifies an optional data transfer object (DTO) class which describes the
   * payload with `class-transformer` and `class-validator` decorators.
   */
  type?: new (...params: any[]) => T;

  /**
   * If it is true then the message body will not be validated.
   */
  noValidate?: boolean;

  /**
   * A listener method how many messages can process in the same time. The
   * default value is 1.
   */
  parallelMessageProcessing?: number;
}

/**
 * Schedule options
 */
export interface SendSchedule {
  /**
   * Send the message periodically by cron time/date
   */
  cron?: string;

  /**
   * Send the message multiple times given by this number
   */
  divideMinute?: number;

  /**
   * Message sending delay in seconds
   */
  afterSeconds?: number;
}

/**
 * Interface defining options that can be passed to `send()` method
 *
 * @publicApi
 */
export interface SendOptions extends Omit<Message, 'body'> {
  /**
   * Schedule options
   */
  schedule?: SendSchedule;
}
