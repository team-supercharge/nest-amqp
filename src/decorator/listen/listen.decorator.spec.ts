import { Listen } from './listen.decorator';
import { AMQP_DEFAULT_CONNECTION_TOKEN, QUEUE_LISTEN_METADATA_KEY } from '../../constant';
import { ListenOptions } from '../../interface';

describe('@Listen', () => {
  const queueName = 'test-queue';
  const listenOptions: ListenOptions<unknown> = { skipValidation: true };
  let instance: Test;

  class Test {
    @Listen(queueName, {})
    public method1() {}

    @Listen(queueName, listenOptions)
    public method2() {}

    @Listen(queueName, 'test-connection')
    public method3() {}

    @Listen(queueName, listenOptions, 'test-connection')
    public method4() {}

    @Listen(queueName)
    public [Symbol.for('foo')]() {}
  }

  beforeEach(() => {
    instance = new Test();
  });

  it('should set correctly the queue name and target data', () => {
    const metadata = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, instance.method1);

    expect(metadata).toEqual(
      expect.objectContaining({
        source: queueName,
        targetName: Test.name,
        callbackName: 'method1',
        connection: AMQP_DEFAULT_CONNECTION_TOKEN,
      }),
    );
  });

  it('should set the queue options', () => {
    const metadata = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, instance.method2);

    expect(metadata.options).toEqual(listenOptions);
  });

  it('should have a named connection', () => {
    const metadata = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, instance.method3);

    expect(metadata).toEqual(expect.objectContaining({ connection: 'test-connection' }));
  });

  it('should have a named connection', () => {
    const metadata = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, instance.method4);

    expect(metadata).toEqual(expect.objectContaining({ connection: 'test-connection', options: listenOptions }));
  });

  it('should set metadata correctly for `symbol` method', () => {
    const sym = Symbol.for('foo');

    const metadata = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, (instance as any)[sym]);

    expect(metadata).toEqual(
      expect.objectContaining({
        source: queueName,
        targetName: Test.name,
        callbackName: sym.toString(),
        connection: AMQP_DEFAULT_CONNECTION_TOKEN,
      }),
    );
  });
});
