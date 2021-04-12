import { ConnectionOptions } from 'rhea-promise';

/**
 * Interface defining options that can be passed to the AMQP connection.
 *
 * @publicApi
 */
export type QueueModuleOptions = {
  throwExceptionOnConnectionError?: boolean;
  acceptValidationNullObjectException?: boolean;
  connectionUri?: string;
  connectionOptions?: ConnectionOptions;
};
