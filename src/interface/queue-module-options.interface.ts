import { ConnectionOptions } from 'rhea-promise';
import { LoggerService } from '@nestjs/common';

/** Interface defining options for importing QueueModule for multiple connections
 *
 * @public
 */
export interface MultiConnectionQueueModuleOptions {
  /**
   * Marks Module as Global module in NestJS
   */
  isGlobal?: boolean;

  /**
   * Custom Logger to be used if needed
   */
  logger?: LoggerService;
}

/** Interface defining options for importing QueueModule
 *
 * @extends AMQPConnectionOptions
 *
 * @public
 */
export interface QueueModuleOptions extends AMQPConnectionOptions {
  /**
   * Marks Module as Global module in NestJS
   */
  isGlobal?: boolean;

  /**
   * Custom Logger to be used if needed
   */
  logger?: LoggerService;
}

/** Interface defining options for importing QueueModule with multiple connections
 *
 * @extends AMQPConnectionOptions
 *
 * @public
 */
export interface NamedAMQPConnectionOptions extends AMQPConnectionOptions {
  /**
   * Name of the connection, must be unique
   *
   * It will be a default value if not given
   */
  readonly name?: string;
}

/**
 * Interface defining options that can be passed to the AMQP connection.
 *
 * @public
 */
export interface AMQPConnectionOptions {
  /**
   * AMQ Broker uri
   */
  connectionUri: string;

  /**
   * Queue Module should throw exception when error occures in the connections
   * @default false
   */
  throwExceptionOnConnectionError?: boolean;

  /**
   * Connection options directly used by `rhea`
   */
  connectionOptions?: ConnectionOptions;

  /**
   * Retry configuration for senders and receivers
   */
  retryConnection?: {
    receiver?: RetryConfig;
    sender?: RetryConfig;
  };
}

export interface RetryConfig {
  retryDelay?: number;
  maxRetryAttempts?: number;
}
