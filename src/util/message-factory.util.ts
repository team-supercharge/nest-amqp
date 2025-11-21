import { Injectable } from '@nestjs/common';
import { isDefined } from 'class-validator';
import { Message } from 'rhea-promise';

import { SendSchedule, SendOptions } from '../interface';
import { getLoggerContext, Logger } from './index';
import { MessageCodec } from './message-codec.util';

/**
 * Builds AMQP Message objects with scheduling annotations and options.
 * Handles message metadata, TTL, and scheduled delivery formatting.
 *
 * @public
 */
@Injectable()
export class MessageFactory {
  private readonly logger = new Logger(getLoggerContext(MessageFactory.name));

  constructor(private readonly codec: MessageCodec) {}

  /**
   * Constructs an AMQP Message with body and optional scheduling.
   *
   * @param payload Message body
   * @param schedule Optional scheduling configuration (CRON, delay, divideMinute)
   * @returns Formatted AMQP Message
   */
  public build<T>(payload: T, schedule?: SendSchedule): Message {
    switch (true) {
      // Repeating with CRON syntax
      case isDefined(schedule?.cron): {
        this.logger.debug(`creating CRON scheduled message with pattern: ${schedule!.cron}`);
        return {
          body: this.codec.encode(payload),
          message_annotations: {
            'x-opt-delivery-cron': schedule!.cron,
          },
        };
      }

      // Repeating `divideMinute` times every minute
      case (schedule?.divideMinute ?? 0) > 0: {
        const period = Math.floor(60000 / schedule!.divideMinute);
        const repeat = schedule!.divideMinute - 1;
        this.logger.debug(
          `creating divideMinute repeating message: ${schedule!.divideMinute} times/minute (period: ${period}ms, repeat: ${repeat})`,
        );

        return {
          body: this.codec.encode(payload),
          message_annotations: {
            'x-opt-delivery-cron': '* * * * *', // trigger every minute
            'x-opt-delivery-delay': 0,
            'x-opt-delivery-period': period,
            'x-opt-delivery-repeat': repeat,
          },
        };
      }

      // Deliver delayed
      case isDefined(schedule?.afterSeconds): {
        const milliseconds = schedule!.afterSeconds * 1000;

        this.logger.debug(
          `scheduling queue message for delivery after ${milliseconds} ms at around: ${new Date(
            new Date().getTime() + milliseconds,
          ).toISOString()}`,
        );

        return {
          body: this.codec.encode(payload),
          message_annotations: {
            'x-opt-delivery-delay': milliseconds,
          },
        };
      }

      // Default: no scheduling
      default: {
        return {
          body: this.codec.encode(payload),
        };
      }
    }
  }

  /**
   * Applies additional options (TTL, custom headers, etc.) to a message.
   *
   * @param message The AMQP Message to modify
   * @param options Send options to apply
   * @returns Modified message
   */
  public applyOptions<T extends Message>(message: T, options: SendOptions): T {
    const result = { ...message, ...options };

    if (isDefined(options.ttl)) {
      this.logger.debug(`setting ttl on message with ${options.ttl} ms`);
      result.ttl = options.ttl;
    }

    return result;
  }
}
