import { AMQP_CONNECTION_OPTIONS_TOKEN, AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';

export const getAMQConnectionOptionsToken = (connection?: string): string => {
  if (!connection || connection === AMQP_DEFAULT_CONNECTION_TOKEN) {
    return AMQP_CONNECTION_OPTIONS_TOKEN;
  }

  return `${connection}_${AMQP_CONNECTION_OPTIONS_TOKEN}`;
};
