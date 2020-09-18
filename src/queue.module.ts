import { DynamicModule, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';

import { Logger, UtilModule } from './util';

import { ListenerMetadata } from './domain';
import { ListenerExplorer } from './explorer';
import { AMQP_CLIENT_TOKEN, AMQP_CONNECTION_RECONNECT, AMQPService, QueueService } from './service';
import { AMQPConnectionOptions } from './interface';

@Module({
  imports: [UtilModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private static readonly moduleDefinition: DynamicModule = {
    exports: [QueueService],
    module: QueueModule,
    providers: [AMQPService, QueueService, MetadataScanner, ListenerExplorer],
  };

  public static forRoot(connectionUri: string, connectionOptions?: AMQPConnectionOptions): DynamicModule {
    this.moduleDefinition.providers.push({
      provide: AMQP_CLIENT_TOKEN,
      useFactory: async () => AMQPService.createConnection(connectionUri, connectionOptions),
    });

    return this.moduleDefinition;
  }

  public static forFeature(): DynamicModule {
    return this.moduleDefinition;
  }

  constructor(
    private readonly queueService: QueueService,
    private readonly listenerExplorer: ListenerExplorer,
    private readonly moduleRef: ModuleRef,
  ) {}

  public async onModuleInit(): Promise<void> {
    logger.info('initializing queue module');

    // find everything marked with @Listen
    const listeners = this.listenerExplorer.explore();
    await this.attachListeners(listeners);

    AMQPService.eventEmitter.on(AMQP_CONNECTION_RECONNECT, () => {
      logger.info('reattaching receivers to connection');
      this.queueService.clearSenderAndReceiverLinks();
      this.attachListeners(listeners)
        .then(() => logger.info('receivers reattached'))
        .catch(error => logger.error('error while reattaching listeners', error));
    });

    logger.info('queue module initialized');
  }

  public async onModuleDestroy(): Promise<void> {
    logger.info('destroying queue module');

    await this.queueService.shutdown();

    logger.info('queue module destroyed');
  }

  private async attachListeners(listeners: Array<ListenerMetadata<unknown>>): Promise<void> {
    // set up listeners
    for (const listener of listeners) {
      logger.debug('attaching listener for @Listen', listener);

      // fetch instance from DI framework
      const target = this.moduleRef.get(listener.targetName, { strict: false });

      await this.queueService.listen(listener.source, listener.callback.bind(target), listener.options);
    }
  }
}
const logger = new Logger(QueueModule.name);
