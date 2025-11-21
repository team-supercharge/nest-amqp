import { Injectable } from '@nestjs/common';
import { Source } from 'rhea-promise';
import { ListenOptions, SendOptions } from '../../interface';
import { SendState } from '../../enum';
import { AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';
import { QueueService } from './queue.service';

@Injectable()
export class QueueClient {
  constructor(
    private readonly queueService: QueueService,
    private readonly connectionName: string = AMQP_DEFAULT_CONNECTION_TOKEN,
  ) {}

  public async listen<T = any>(
    source: string | Source,
    handler: (data: T, control: any, metadata: any) => Promise<void>,
    options: ListenOptions<T> = {},
  ): Promise<void> {
    return this.queueService.listen(source, handler, options, this.connectionName!);
  }

  public async send<T = any>(queue: string, data: T, sendOptions?: SendOptions): Promise<SendState> {
    return this.queueService.send(queue, data, sendOptions, this.connectionName);
  }

  public async shutdown(): Promise<void> {
    return this.queueService.shutdown();
  }
}
