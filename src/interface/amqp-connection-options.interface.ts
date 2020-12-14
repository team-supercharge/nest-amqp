import { ConnectionOptions } from 'rhea-promise';

/**
 * Interface defining options that can be passed to the AMQP connection.
 *
 * @publicApi
 */
export type AMQPConnectionOptions = ConnectionOptions & {
  throwExceptionOnConnectionError?: boolean;
  acceptValidationNullObjectException?: boolean;
};
