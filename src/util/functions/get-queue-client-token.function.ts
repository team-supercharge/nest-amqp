import { AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';

export const getQueueClientToken = (name: string = AMQP_DEFAULT_CONNECTION_TOKEN): string => `NEST_AMQP_QUEUE_CLIENT:${name}`;
