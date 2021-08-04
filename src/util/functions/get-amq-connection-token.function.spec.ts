import { AMQP_CLIENT_TOKEN, AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';
import { getAMQConnectionToken } from './get-amq-connection-token.function';

describe('getAMQConnectionToken()', () => {
  it('should return the default amqp client token with default connection name', () => {
    expect(getAMQConnectionToken(AMQP_DEFAULT_CONNECTION_TOKEN)).toEqual(AMQP_CLIENT_TOKEN);
  });

  it('should return the default amqp client token with no connection name', () => {
    expect(getAMQConnectionToken()).toEqual(AMQP_CLIENT_TOKEN);
  });

  it('should return the amqp client token extended with the connection name', () => {
    expect(getAMQConnectionToken('test')).toEqual(`test_${AMQP_CLIENT_TOKEN}`);
  });
});
