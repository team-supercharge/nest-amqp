import { AMQP_CONNECTION_OPTIONS_TOKEN, AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';
import { getAMQConnectionOptionsToken } from './get-amq-connection-options-token.function';

describe('getAMQConnectionOptionsToken()', () => {
  it('should return the default amqp client token with default connection name', () => {
    expect(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN)).toEqual(AMQP_CONNECTION_OPTIONS_TOKEN);
  });

  it('should return the default amqp client token with no connection name', () => {
    expect(getAMQConnectionOptionsToken()).toEqual(AMQP_CONNECTION_OPTIONS_TOKEN);
  });

  it('should return the amqp client token extended with the connection name', () => {
    expect(getAMQConnectionOptionsToken('test')).toEqual(`test_${AMQP_CONNECTION_OPTIONS_TOKEN}`);
  });
});
