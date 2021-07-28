import { Message } from 'rhea-promise';

import { ObjectValidationOptions } from '../service';

/**
 * Interface defining options that can be passed to `@Listen()` decorator
 *
 * @public
 */
export interface ListenOptions<T> extends ObjectValidationOptions {
  /**
   * Specifies an optional data transfer object (DTO) class which describes the
   * payload with `class-transformer` and `class-validator` decorators.
   */
  type?: new (...params: any[]) => T;

  /**
   * If it is true then the message body will not be validated.
   *
   * @default false
   */
  noValidate?: boolean;

  /**
   * How many messages can should the listener method process in the same time. A way to control performace
   * @default 1.
   */
  parallelMessageProcessing?: number;
}

/**
 * Scheduling options for Messages
 *
 * @public
 */
export interface SendSchedule {
  /**
   * Send the message periodically by cron time/date. Standard crontab format applies.
   *
   * ```
   * ┌───────────── minute (0 - 59)
   * │ ┌───────────── hour (0 - 23)
   * │ │ ┌───────────── day of the month (1 - 31)
   * │ │ │ ┌───────────── month (1 - 12)
   * │ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday;
   * │ │ │ │ │                                   7 is also Sunday on some systems)
   * * * * * *
   * ```
   *
   * NOTE: Needs a Scheduler feature enabled on the Broker.
   */
  cron?: string;

  /**
   * Send the message multiple times in a minute given by this number.
   * i.e a value of 12 would mean it sent every 60/12 = 5 seconds
   *
   * NOTE: Needs a Scheduler feature enabled on the Broker.
   */
  divideMinute?: number;

  /**
   * Message sending delay in seconds.
   *
   * NOTE: Needs a Scheduler feature enabled on the Broker.
   */
  afterSeconds?: number;
}

/**
 * Interface defining options that can be passed to `send()` method
 *
 * @public
 */
export interface SendOptions extends Omit<Message, 'body'> {
  /**
   * Scheduling options
   */
  schedule?: SendSchedule;
}
