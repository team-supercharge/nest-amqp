import { ConnectionOptions } from 'rhea-promise';
import { LoggerService } from '@nestjs/common';

/** Interface defining options for importing QueueModule
 *
 * @public
 */
export interface QueueModuleOptions {
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
   * Queue Module should throw exception when error occurs in the connections
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
