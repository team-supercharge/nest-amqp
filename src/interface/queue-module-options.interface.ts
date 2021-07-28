import { ConnectionOptions } from 'rhea-promise';
import { LoggerService } from '@nestjs/common';

/** Interface defining options for importing QueueModule
 *
 * @extends QueueServiceMessageHandlingOptions
 *
 * @public
 */
export interface QueueModuleOptions extends QueueServiceMessageHandlingOptions {
  /**
   * Marks Module as Global module in NestJS
   */
  isGlobal?: boolean;

  /**
   * Custom Logger to be used if needed
   */
  logger?: LoggerService;
}

/**
 * Interface defining options how the QueueService should handle Messages or errors with messages
 *
 * @extends AMQPConnectionOptions
 *
 * @public
 */
export interface QueueServiceMessageHandlingOptions extends AMQPConnectionOptions {
  /**
   * Queue Module should mark the message as accepted if the validation fails with Null Exception.
   *
   * Allows for removing message from ActiveMQ specifically since it currently does not handle the difference between reject and release
   *
   * @default false
   */
  acceptValidationNullObjectException?: boolean;
}

/**
 * Interface defining options that can be passed to the AMQP connection.
 *
 * @public
 */
export interface AMQPConnectionOptions {
  /**
   * Queue Module should throw exception when error occures in the connections
   * @default false
   */
  throwExceptionOnConnectionError?: boolean;
  connectionUri?: string;
  connectionOptions?: ConnectionOptions;
}
