import { ListenOptions, SendSchedule } from '../interface';
import { InMemoryBroker } from './in-memory-broker';

export class TestingQueueClient {
  constructor(private readonly broker: InMemoryBroker) {}

  public async listen<T = any>(
    source: string,
    handler: (data: T, control: any, metadata: any) => Promise<void>,
    _options: ListenOptions<T> = {},
  ): Promise<void> {
    this.broker.subscribe(source, payload => handler(payload as T, {} as any, {} as any));
  }

  public async send<T = any>(queue: string, data: T, _schedule?: SendSchedule): Promise<void> {
    this.broker.publish(queue, data);
  }
}

export function createTestingQueue(name?: string): { broker: InMemoryBroker; client: TestingQueueClient } {
  const broker = new InMemoryBroker();
  const client = new TestingQueueClient(broker);
  void name; // reserved for future multi-connection behavior
  return { broker, client };
}
