import { Listen } from './listen.decorator';
import { QUEUE_LISTEN_METADATA_KEY } from '../explorer';
import { ListenOptions } from '../interface';

describe('@Listen', () => {
  const queueName = 'test-queue';
  const listenOptions: ListenOptions<unknown> = { noValidate: true };
  let instance: Test;

  class Test {
    @Listen(queueName, {})
    public method1() {}

    @Listen(queueName, listenOptions)
    public method2() {}
  }

  beforeEach(() => {
    instance = new Test();
  });

  it('should set correctly the queue name and target data', () => {
    const metadata = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, instance.method1);

    expect(metadata).toEqual(expect.objectContaining({ source: queueName, targetName: Test.name, callbackName: 'method1' }));
  });

  it('should set the queue options', () => {
    const metadata = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, instance.method2);

    expect(metadata.options).toEqual(listenOptions);
  });
});
