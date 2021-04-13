import { DynamicModule, Module, OnModuleDestroy, OnModuleInit, Provider, Type } from '@nestjs/common';
import { Connection } from 'rhea-promise';
import { MetadataScanner, ModuleRef } from '@nestjs/core';

import { QueueModuleOptions, QueueModuleAsyncOptions, QueueModuleOptionsFactory } from './interface';
import { AMQPService, ObjectValidatorService, QueueService } from './service';
import { ListenerExplorer } from './explorer';
import { AMQP_CLIENT_TOKEN, AMQP_CONNECTION_RECONNECT, QUEUE_MODULE_OPTIONS } from './constant';
import { ListenerMetadata } from './domain';
import { Logger } from './util';

@Module({})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private static readonly moduleDefinition: DynamicModule = {
    global: false,
    module: QueueModule,
    providers: [AMQPService, QueueService, MetadataScanner, ListenerExplorer, ObjectValidatorService],
    exports: [QueueService],
  };

  public static forRoot(options: QueueModuleOptions): DynamicModule;
  public static forRoot(connectionUri: string, options?: Omit<QueueModuleOptions, 'connectionUri'>): DynamicModule;
  public static forRoot(connectionUri: string | QueueModuleOptions, options?: Omit<QueueModuleOptions, 'connectionUri'>): DynamicModule {
    const moduleOptions = typeof connectionUri === 'string' ? { ...options, connectionUri } : connectionUri;
    const queueModuleOptionsProvider = QueueModule.getQueueModuleOptionsProvider(moduleOptions);
    const connectionProvider = QueueModule.getConnectionProvider();

    Object.assign(QueueModule.moduleDefinition, {
      global: !!moduleOptions.isGlobal,
      providers: [queueModuleOptionsProvider, ...QueueModule.moduleDefinition.providers, connectionProvider],
    });

    return QueueModule.moduleDefinition;
  }

  public static forRootAsync(options: QueueModuleAsyncOptions): DynamicModule {
    const connectionProvider = QueueModule.getConnectionProvider();
    const asyncProviders = this.createAsyncProviders(options);

    Object.assign(QueueModule.moduleDefinition, {
      global: !!options.isGlobal,
      imports: options.imports,
      providers: [...asyncProviders, ...QueueModule.moduleDefinition.providers, connectionProvider],
    });

    return QueueModule.moduleDefinition;
  }

  public static forFeature(): DynamicModule {
    return QueueModule.moduleDefinition;
  }

  private static createAsyncProviders(options: QueueModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    const useClass = options.useClass as Type<QueueModuleOptionsFactory>;

    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(options: QueueModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: QUEUE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    // `as Type<QueueOptionsFactory>` is a workaround for microsoft/TypeScript#31603
    const inject = [(options.useClass || options.useExisting) as Type<QueueModuleOptionsFactory>];

    return {
      provide: QUEUE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: QueueModuleOptionsFactory) => optionsFactory.createQueueModuleOptions(),
      inject,
    };
  }

  private static getConnectionProvider(): Provider {
    return {
      provide: AMQP_CLIENT_TOKEN,
      useFactory: async (options: QueueModuleOptions): Promise<Connection> => AMQPService.createConnection(options),
      inject: [QUEUE_MODULE_OPTIONS],
    };
  }

  private static getQueueModuleOptionsProvider(options: QueueModuleOptions): Provider {
    return {
      provide: QUEUE_MODULE_OPTIONS,
      useValue: options,
    };
  }

  constructor(
    private readonly queueService: QueueService,
    private readonly listenerExplorer: ListenerExplorer,
    private readonly moduleRef: ModuleRef,
  ) {}

  // istanbul ignore next
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

  // istanbul ignore next
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
