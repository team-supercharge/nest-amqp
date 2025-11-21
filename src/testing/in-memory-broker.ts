import { EventEmitter } from 'events';

export class InMemoryBroker {
  private readonly events = new EventEmitter();

  public publish(queue: string, payload: any): void {
    this.events.emit(this.getEventKey(queue), payload);
  }

  public subscribe(queue: string, handler: (payload: any) => Promise<void> | void): () => void {
    const key = this.getEventKey(queue);
    const wrapped = (payload: any): void => {
      try {
        const maybePromise = handler(payload);
        if (maybePromise && typeof (maybePromise as any).then === 'function') {
          (maybePromise as Promise<void>).catch((): void => {
            // ignore in tests
          });
        }
      } catch {
        // ignore in tests
      }
    };
    this.events.on(key, wrapped);
    return () => this.events.off(key, wrapped);
  }

  private getEventKey(queue: string): string {
    return `queue:${queue}`;
  }
}
