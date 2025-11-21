import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MetadataScanner, ModuleRef } from '@nestjs/core';

import { ListenerExplorer } from './explorer';
import { AMQPService, QueueService } from './service';
import { AMQP_CONNECTION_RECONNECT } from './constant';
import { ListenerMetadata } from './domain';
import { getLoggerContext, Logger } from './util';

@Module({
  providers: [MetadataScanner, ListenerExplorer],
})
export class ListenerModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(getLoggerContext(ListenerModule.name));

  constructor(
    private readonly queueService: QueueService,
    private readonly listenerExplorer: ListenerExplorer,
    private readonly moduleRef: ModuleRef,
  ) {}

  public async onModuleInit(): Promise<void> {
    this.logger.log('initializing listener module');
    const listeners = this.listenerExplorer.explore();
    await this.attachListeners(listeners);

    AMQPService.eventEmitter.on(AMQP_CONNECTION_RECONNECT, () => {
      this.logger.log('reattaching receivers to connection');
      this.queueService.clearSenderAndReceiverLinks();
      this.attachListeners(listeners)
        .then(() => this.logger.log('receivers reattached'))
        .catch(error => this.logger.error('error while reattaching listeners', error));
    });
  }

  public async onModuleDestroy(): Promise<void> {
    this.logger.log('destroying listener module');
  }

  private async attachListeners(listeners: Array<ListenerMetadata<unknown>>): Promise<void> {
    for (const listener of listeners) {
      this.logger.debug(`attaching listener for @Listen: ${JSON.stringify(listener)}`);
      const target = this.moduleRef.get(listener.target as any, { strict: false });
      await this.queueService.listen(listener.source, listener.callback.bind(target), listener.options, listener.connection);
    }
  }
}

const logger = new Logger(getLoggerContext(ListenerModule.name));
