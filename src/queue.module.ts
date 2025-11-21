import { DynamicModule, Module, OnModuleDestroy, OnModuleInit, Provider } from '@nestjs/common';
import { Connection } from 'rhea-promise';
import { isDefined } from 'class-validator';

import { QueueModuleOptions, QueueModuleAsyncOptions, QueueModuleOptionsFactory, AMQPConnectionOptions } from './interface';
import { AMQPService, QueueService } from './service';
import { AMQP_DEFAULT_CONNECTION_TOKEN, QUEUE_MODULE_OPTIONS } from './constant';
import {
  getQueueClientToken,
  getAMQConnectionToken,
  getLoggerContext,
  getAMQConnectionOptionsToken,
  Logger,
  AMQConnectionOptionsStorage,
  MessageCodec,
  MessageFactory,
  ObjectValidatorService,
  UtilModule,
} from './util';

@Module({})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private static readonly CORE_PROVIDERS: Provider[] = [AMQPService, QueueService, ObjectValidatorService, MessageCodec, MessageFactory];

  public static register(options: {
    name: string;
    connectionUri: string;
    connectionOptions?: AMQPConnectionOptions['connectionOptions'];
    isGlobal?: boolean;
    logger?: QueueModuleOptions['logger'];
  }): DynamicModule {
    const { name, isGlobal, logger: customLogger, connectionUri, connectionOptions } = options;

    const queueModuleOptionsProviders: Provider[] = [
      {
        provide: QUEUE_MODULE_OPTIONS,
        useValue: { isGlobal, logger: customLogger } as Partial<QueueModuleOptions>,
      },
    ];

    const connectionOptionsProviders: Provider[] = [
      this.getAMQPConnectionOptionsProvider(
        {
          connectionUri,
          ...(isDefined(connectionOptions) ? { connectionOptions } : {}),
        } as AMQPConnectionOptions,
        name,
      ),
    ];

    const connectionProviders: Provider[] = [this.getConnectionProvider(name)];

    const queueClientProvider: Provider = {
      provide: getQueueClientToken(name),
      useFactory: (queueService: QueueService) => new (require('./service/queue/queue.client').QueueClient)(queueService, name),
      inject: [QueueService],
    };

    const providers: Provider[] = [
      ...queueModuleOptionsProviders,
      ...connectionOptionsProviders,
      ...connectionProviders,
      ...QueueModule.CORE_PROVIDERS,
      queueClientProvider,
    ];

    return {
      global: isGlobal ?? false,
      module: QueueModule,
      providers,
      exports: [QueueService, getQueueClientToken(name)],
      imports: [UtilModule],
    };
  }

  /**
   * New API: Async one-connection-per-DynamicModule registration
   */
  public static registerAsync(options: QueueModuleAsyncOptions & { name: string }): DynamicModule {
    const name = options.name;

    const asyncOptionsProvider = this.createAsyncQueueModuleOptionsProvider(options);
    const asyncConnectionOptionsProvider: Provider = options.useFactory
      ? {
          provide: getAMQConnectionOptionsToken(name),
          inject: options.inject || [],
          useFactory: async (...args: any[]) => {
            const moduleOptions = await options.useFactory!(...args);
            const useValue = QueueModule.getConnectionOptions(moduleOptions);
            AMQConnectionOptionsStorage.add(name, useValue);
            return moduleOptions;
          },
        }
      : {
          provide: getAMQConnectionOptionsToken(name),
          useFactory: async (optionsFactory: QueueModuleOptionsFactory) => {
            const moduleOptions = await optionsFactory.createQueueModuleOptions();
            const useValue = QueueModule.getConnectionOptions(moduleOptions);
            AMQConnectionOptionsStorage.add(name, useValue);
            return moduleOptions;
          },
          inject: [options.useClass ?? (options.useExisting as any)],
        };

    const connectionProviders = [QueueModule.getConnectionProvider(name)];

    const queueClientProvider: Provider = {
      provide: getQueueClientToken(name),
      useFactory: (queueService: QueueService) => new (require('./service/queue/queue.client').QueueClient)(queueService, name),
      inject: [QueueService],
    };

    const baseProviders: Provider[] = [
      ...QueueModule.CORE_PROVIDERS,
      asyncOptionsProvider,
      asyncConnectionOptionsProvider,
      ...connectionProviders,
      queueClientProvider,
    ];

    const extraProviders: Provider[] = [];
    if (options.useClass) {
      extraProviders.push({ provide: options.useClass, useClass: options.useClass });
    }

    return {
      global: options.isGlobal ?? false,
      module: QueueModule,
      imports: [...(options.imports ?? []), UtilModule],
      providers: [...baseProviders, ...extraProviders],
      exports: [QueueService, getQueueClientToken(name)],
    };
  }

  // Legacy APIs removed in vNext

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

  // Legacy async AMQ connection options provider removed in vNext

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

  constructor(private readonly queueService: QueueService) {}

  // istanbul ignore next
  public async onModuleInit(): Promise<void> {
    logger.log('initializing queue module');
    logger.log('queue module initialized');
  }

  public async onModuleDestroy(): Promise<void> {
    logger.log('destroying queue module');

    await this.queueService.shutdown();

    logger.log('queue module destroyed');
  }

  // no listener wiring here; use ListenerModule to enable @Listen()
}
const logger = new Logger(getLoggerContext(QueueModule.name));
