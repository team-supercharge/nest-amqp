import { DynamicModule, Inject, Module, OnModuleDestroy, OnModuleInit, Provider, Type } from '@nestjs/common';
import { Connection } from 'rhea-promise';
import { MetadataScanner, ModuleRef } from '@nestjs/core';
import { UnknownElementException } from '@nestjs/core/errors/exceptions/unknown-element.exception';
import { isDefined } from 'class-validator';

import {
  QueueModuleOptions,
  QueueModuleAsyncOptions,
  QueueModuleOptionsFactory,
  NamedAMQPConnectionOptions,
  AMQPConnectionOptions,
  MultiConnectionQueueModuleOptions,
} from './interface';
import { AMQPService, ObjectValidatorService, QueueService } from './service';
import { ListenerExplorer } from './explorer';
import { AMQP_CONNECTION_RECONNECT, AMQP_DEFAULT_CONNECTION_TOKEN, QUEUE_MODULE_OPTIONS } from './constant';
import { ListenerMetadata } from './domain';
import { getAMQConnectionToken, getLoggerContext, getAMQConnectionOptionsToken, Logger, AMQConnectionOptionsStorage } from './util';

const toString: () => string = Object.prototype.toString;

@Module({})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private static readonly moduleDefinition: DynamicModule = {
    global: false,
    module: QueueModule,
    providers: [AMQPService, QueueService, MetadataScanner, ListenerExplorer, ObjectValidatorService],
    exports: [QueueService],
  };

  public static forRoot(options: QueueModuleOptions): DynamicModule;
  public static forRoot(connectionUri: string): DynamicModule;
  public static forRoot(connectionUri: string, options: Omit<QueueModuleOptions, 'connectionUri'>): DynamicModule;
  public static forRoot(connections: NamedAMQPConnectionOptions[], options?: MultiConnectionQueueModuleOptions): DynamicModule;
  public static forRoot(
    connectionUri: string | QueueModuleOptions | NamedAMQPConnectionOptions[],
    options: Omit<QueueModuleOptions, 'connectionUri'> | MultiConnectionQueueModuleOptions = {},
  ): DynamicModule {
    const queueModuleOptionsProviders = [];
    const connectionProviders = [];
    const connectionOptionsProviders = [];

    if (toString.call(connectionUri) === '[object Array]') {
      queueModuleOptionsProviders.push(QueueModule.getQueueModuleOptionsProvider(options));
      for (const connectionOptions of connectionUri as NamedAMQPConnectionOptions[]) {
        connectionOptionsProviders.push(QueueModule.getAMQPConnectionOptionsProvider(connectionOptions, connectionOptions.name));
        connectionProviders.push(QueueModule.getConnectionProvider(connectionOptions.name));
      }
    } else {
      const moduleOptions = typeof connectionUri === 'string' ? { ...options, connectionUri } : (connectionUri as QueueModuleOptions);
      queueModuleOptionsProviders.push(QueueModule.getQueueModuleOptionsProvider(moduleOptions));
      connectionOptionsProviders.push(QueueModule.getAMQPConnectionOptionsProvider(moduleOptions));
      connectionProviders.push(QueueModule.getConnectionProvider(AMQP_DEFAULT_CONNECTION_TOKEN));
    }

    Object.assign(QueueModule.moduleDefinition, {
      global: !!options.isGlobal,
      providers: [
        ...queueModuleOptionsProviders,
        ...QueueModule.moduleDefinition.providers,
        ...connectionOptionsProviders,
        ...connectionProviders,
      ],
    });

    return QueueModule.moduleDefinition;
  }

  public static forRootAsync(options: QueueModuleAsyncOptions): DynamicModule {
    // TODO - allow for multiple connections
    const connectionProviders = [QueueModule.getConnectionProvider(AMQP_DEFAULT_CONNECTION_TOKEN)];

    const asyncProviders = this.createAsyncProviders(options);

    Object.assign(QueueModule.moduleDefinition, {
      global: !!options.isGlobal,
      imports: options.imports,
      providers: [...asyncProviders, ...QueueModule.moduleDefinition.providers, ...connectionProviders],
    });

    return QueueModule.moduleDefinition;
  }

  public static forFeature(): DynamicModule {
    return QueueModule.moduleDefinition;
  }

  private static createAsyncProviders(options: QueueModuleAsyncOptions): Provider[] {
    if (!options.useClass && !options.useExisting && !options.useFactory) {
      throw new Error('Must provide factory, class or existing provider');
    }

    if (options.useExisting || options.useFactory) {
      return [this.createAsyncQueueModuleOptionsProvider(options), this.createAsyncAMQConnectionsOptionsProvider(options)];
    }

    const useClass = options.useClass as Type<QueueModuleOptionsFactory>;

    return [
      this.createAsyncQueueModuleOptionsProvider(options),
      this.createAsyncAMQConnectionsOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncQueueModuleOptionsProvider(options: QueueModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: QUEUE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    const inject = [options.useClass ?? options.useExisting];

    return {
      provide: QUEUE_MODULE_OPTIONS,
      useFactory: async (factory: QueueModuleOptionsFactory): Promise<QueueModuleOptions> => factory.createQueueModuleOptions(),
      inject,
    };
  }

  private static createAsyncAMQConnectionsOptionsProvider(options: QueueModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN),
        inject: options.inject || [],
        useFactory: async (...args: any[]) => {
          const moduleOptions = await options.useFactory(...args);
          const useValue = QueueModule.getConnectionOptions(moduleOptions);

          AMQConnectionOptionsStorage.add(AMQP_DEFAULT_CONNECTION_TOKEN, useValue);

          return moduleOptions;
        },
      };
    }

    const inject = [options.useClass ?? options.useExisting];

    return {
      provide: getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN),
      useFactory: async (optionsFactory: QueueModuleOptionsFactory) => {
        const moduleOptions = await optionsFactory.createQueueModuleOptions();
        const useValue = QueueModule.getConnectionOptions(moduleOptions);

        AMQConnectionOptionsStorage.add(AMQP_DEFAULT_CONNECTION_TOKEN, useValue);

        return moduleOptions;
      },
      inject,
    };
  }

  /**
   * Creates a connection provider with the given name
   *
   * @param {string} connection Name of the connection
   *
   * @returns {Provider} Named Connection provider
   *
   * @private
   * @static
   */
  private static getConnectionProvider(connection: string = AMQP_DEFAULT_CONNECTION_TOKEN): Provider {
    return {
      provide: getAMQConnectionToken(connection),
      useFactory: async (options: AMQPConnectionOptions): Promise<Connection> => AMQPService.createConnection(options, connection),
      inject: [getAMQConnectionOptionsToken(connection)],
    };
  }

  private static getQueueModuleOptionsProvider(options: Partial<QueueModuleOptions>): Provider {
    return {
      provide: QUEUE_MODULE_OPTIONS,
      useValue: options,
    };
  }

  private static getAMQPConnectionOptionsProvider(
    options: AMQPConnectionOptions,
    connection: string = AMQP_DEFAULT_CONNECTION_TOKEN,
  ): Provider {
    const provide = getAMQConnectionOptionsToken(connection);
    const useValue = QueueModule.getConnectionOptions(options);

    AMQConnectionOptionsStorage.add(connection, useValue);

    return { provide, useValue };
  }

  private static getConnectionOptions(options: AMQPConnectionOptions): AMQPConnectionOptions {
    const { connectionOptions, connectionUri, throwExceptionOnConnectionError } = options;

    return {
      connectionUri,
      ...(isDefined(connectionOptions) ? { connectionOptions } : {}),
      ...(isDefined(throwExceptionOnConnectionError) ? { throwExceptionOnConnectionError } : {}),
    };
  }

  constructor(
    @Inject(QUEUE_MODULE_OPTIONS) private readonly moduleOptions: QueueModuleOptions,
    private readonly queueService: QueueService,
    private readonly listenerExplorer: ListenerExplorer,
    private readonly moduleRef: ModuleRef,
  ) {}

  // istanbul ignore next
  public async onModuleInit(): Promise<void> {
    logger.log('initializing queue module');

    if (this.moduleOptions.logger) {
      Logger.overrideLogger(this.moduleOptions.logger);
    }

    // find everything marked with @Listen
    const listeners = this.listenerExplorer.explore();
    await this.attachListeners(listeners);

    AMQPService.eventEmitter.on(AMQP_CONNECTION_RECONNECT, () => {
      logger.log('reattaching receivers to connection');
      this.queueService.clearSenderAndReceiverLinks();
      this.attachListeners(listeners)
        .then(() => logger.log('receivers reattached'))
        .catch(error => logger.error('error while reattaching listeners', error));
    });

    logger.log('queue module initialized');
  }

  public async onModuleDestroy(): Promise<void> {
    logger.log('destroying queue module');

    await this.queueService.shutdown();

    logger.log('queue module destroyed');
  }

  // istanbul ignore next
  private async attachListeners(listeners: Array<ListenerMetadata<unknown>>): Promise<void> {
    // set up listeners
    for (const listener of listeners) {
      logger.debug(`attaching listener for @Listen: ${JSON.stringify(listener)}`);

      // fetch instance from DI framework
      let target: any;
      try {
        target = this.moduleRef.get(listener.target as any, { strict: false });
      } catch (err) {
        if (err instanceof UnknownElementException) {
          target = this.moduleRef.get(listener.targetName, { strict: false });
        } else {
          throw err;
        }
      }

      await this.queueService.listen(listener.source, listener.callback.bind(target), listener.options, listener.connection);
    }
  }
}
const logger = new Logger(getLoggerContext(QueueModule.name));
