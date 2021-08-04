import { AMQP_CLIENT_TOKEN, AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';

export const getAMQConnectionToken = (connection?: string): string => {
  if (!connection || connection === AMQP_DEFAULT_CONNECTION_TOKEN) {
    return AMQP_CLIENT_TOKEN;
  }

  return `${connection}_${AMQP_CLIENT_TOKEN}`;
};
