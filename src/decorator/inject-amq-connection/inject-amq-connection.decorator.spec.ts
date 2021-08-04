import { Connection } from 'rhea-promise';
import { AMQP_CLIENT_TOKEN } from '../../constant';
import { InjectAMQConnection } from './inject-amq-connection.decorator';

describe('@InjectAMQConnection', () => {
  const test = 'testConnection';

  class Test {
    constructor(
      @InjectAMQConnection()
      public readonly defaultConnection: Connection,

      @InjectAMQConnection(test)
      public readonly namedConnection: Connection,
    ) {}
  }

  it('should add default and named connection', () => {
    const metadata = Reflect.getMetadata('self:paramtypes', Test);

    const expectedMetadata = [
      { index: 1, param: `${test}_${AMQP_CLIENT_TOKEN}` },
      { index: 0, param: AMQP_CLIENT_TOKEN },
    ];
    expect(metadata).toEqual(expectedMetadata);
  });
});
