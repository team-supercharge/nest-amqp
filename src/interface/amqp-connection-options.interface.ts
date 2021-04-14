import { ConnectionOptions } from 'rhea-promise';
import { LoggerService } from '@nestjs/common';

/**
 * Interface defining options that can be passed to the AMQP connection.
 *
 * @publicApi
 */
export type QueueModuleOptions = {
  isGlobal?: boolean;
  logger?: LoggerService;
  throwExceptionOnConnectionError?: boolean;
  acceptValidationNullObjectException?: boolean;
  connectionUri?: string;
  connectionOptions?: ConnectionOptions;
};
