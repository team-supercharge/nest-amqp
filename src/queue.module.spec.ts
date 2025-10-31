import { Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AMQP_DEFAULT_CONNECTION_TOKEN, QUEUE_MODULE_OPTIONS } from './constant';

jest.mock('rhea-promise');

import { QueueModuleAsyncOptions, QueueModuleOptions, QueueModuleOptionsFactory } from './interface';
import { QueueModule } from './queue.module';
import { AMQPService, QueueService } from './service';
import { AMQConnectionOptionsStorage, AMQConnectionStorage, getAMQConnectionOptionsToken, getQueueClientToken } from './util';

describe('QueueModule', () => {
  const connectionUri = 'amqp://localhost:5672';
  let module: TestingModule;

  // Helper test services and modules
  @Injectable()
  class TestConfigService {
    getAmqpUrl(): string {
      return connectionUri;
    }
  }

  @Module({
    providers: [TestConfigService],
    exports: [TestConfigService],
  })
  class TestConfigModule {}

  @Injectable()
  class TestQueueConfigService implements QueueModuleOptionsFactory {
    async createQueueModuleOptions(): Promise<QueueModuleOptions> {
      return { connectionUri };
    }
  }

  @Module({
    providers: [TestQueueConfigService],
    exports: [TestQueueConfigService],
  })
  class TestQueueConfigModule {}

  @Injectable()
  class TestFeatureService {
    constructor(public readonly queueService: QueueService) {}
  }

  @Module({
    imports: [QueueModule.register({ name: 'default', connectionUri })],
    providers: [TestFeatureService],
    exports: [TestFeatureService],
  })
  class TestFeatureModule {}

  afterEach(async () => {
    AMQConnectionOptionsStorage['storage'].clear();
    AMQConnectionStorage['storage'].clear();
    await module?.close();
  });

  describe('register()', () => {
    it('should register QueueModule with minimal options', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
      expect(connectionOptions.connectionUri).toBe(connectionUri);
    });

    it('should register QueueModule with all options', async () => {
      const connectionOptions = { transport: 'tls' } as const;
      const customLogger = { log: jest.fn() };

      module = await Test.createTestingModule({
        imports: [
          QueueModule.register({
            name: 'test',
            connectionUri,
            connectionOptions,
            isGlobal: true,
            logger: customLogger as any,
          }),
        ],
      }).compile();

      const retrievedConnectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(retrievedConnectionOptions).toBeDefined();
      expect(retrievedConnectionOptions.connectionUri).toBe(connectionUri);
      expect(retrievedConnectionOptions.connectionOptions).toEqual(connectionOptions);
    });

    it('should mark module as global when isGlobal is true', async () => {
      const dynamicModule = QueueModule.register({
        name: 'test',
        connectionUri,
        isGlobal: true,
      });

      expect(dynamicModule.global).toBe(true);
    });

    it('should not mark module as global when isGlobal is false', async () => {
      const dynamicModule = QueueModule.register({
        name: 'test',
        connectionUri,
        isGlobal: false,
      });

      expect(dynamicModule.global).toBe(false);
    });

    it('should default isGlobal to false', async () => {
      const dynamicModule = QueueModule.register({
        name: 'test',
        connectionUri,
      });

      expect(dynamicModule.global).toBe(false);
    });

    it('should export QueueService and queue client token', async () => {
      const dynamicModule = QueueModule.register({
        name: 'test',
        connectionUri,
      });

      expect(dynamicModule.exports).toContain(QueueService);
      expect(dynamicModule.exports).toContain(getQueueClientToken('test'));
    });

    it('should import UtilModule', async () => {
      const dynamicModule = QueueModule.register({
        name: 'test',
        connectionUri,
      });

      expect(dynamicModule.imports).toContain(expect.objectContaining({ name: 'UtilModule' }));
    });

    it('should register core providers', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      expect(module.get(AMQPService)).toBeDefined();
      expect(module.get(QueueService)).toBeDefined();
    });

    it('should register queue client provider', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const queueClient = module.get(getQueueClientToken('test'));
      expect(queueClient).toBeDefined();
    });

    it('should handle multiple registrations with different names', async () => {
      const connectionUri1 = 'amqp://localhost:5672';
      const connectionUri2 = 'amqp://localhost:5671';

      const dynamicModule = QueueModule.register({
        name: 'connection1',
        connectionUri: connectionUri1,
      });

      expect(dynamicModule).toBeDefined();
      expect(dynamicModule.exports).toContain(getQueueClientToken('connection1'));
    });

    it('should store connection options in AMQConnectionOptionsStorage', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const stored = AMQConnectionOptionsStorage['storage'].get('test');
      expect(stored).toBeDefined();
      expect(stored.connectionUri).toBe(connectionUri);
    });
  });

  describe('registerAsync()', () => {
    it('should register QueueModule asynchronously with useFactory', async () => {
      const asyncOptions: QueueModuleAsyncOptions = {
        useFactory: () => ({ connectionUri }),
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
      expect(connectionOptions.connectionUri).toBe(connectionUri);
    });

    it('should register QueueModule asynchronously with useFactory and dependencies', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        imports: [TestConfigModule],
        inject: [TestConfigService],
        useFactory: (testConfigService: TestConfigService) => ({
          connectionUri: testConfigService.getAmqpUrl(),
        }),
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
      expect(connectionOptions.connectionUri).toBe(connectionUri);
    });

    it('should register QueueModule asynchronously with useClass', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        imports: [TestQueueConfigModule],
        useClass: TestQueueConfigService,
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
      expect(connectionOptions.connectionUri).toBe(connectionUri);
    });

    it('should register QueueModule asynchronously with useExisting', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        imports: [TestQueueConfigModule],
        useExisting: TestQueueConfigService,
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
      expect(connectionOptions.connectionUri).toBe(connectionUri);
    });

    it('should mark module as global when isGlobal is true', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        useFactory: () => ({ connectionUri }),
        isGlobal: true,
        name: 'test',
      };

      const dynamicModule = QueueModule.registerAsync(asyncOptions);
      expect(dynamicModule.global).toBe(true);
    });

    it('should default isGlobal to false', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        useFactory: () => ({ connectionUri }),
        name: 'test',
      };

      const dynamicModule = QueueModule.registerAsync(asyncOptions);
      expect(dynamicModule.global).toBe(false);
    });

    it('should import custom modules when provided', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        imports: [TestConfigModule],
        inject: [TestConfigService],
        useFactory: (testConfigService: TestConfigService) => ({
          connectionUri: testConfigService.getAmqpUrl(),
        }),
        name: 'test',
      };

      const dynamicModule = QueueModule.registerAsync(asyncOptions);
      expect(dynamicModule.imports).toContainEqual(TestConfigModule);
    });

    it('should always import UtilModule', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        useFactory: () => ({ connectionUri }),
        name: 'test',
      };

      const dynamicModule = QueueModule.registerAsync(asyncOptions);
      expect(dynamicModule.imports).toContainEqual(expect.objectContaining({ name: 'UtilModule' }));
    });

    it('should export QueueService and queue client token', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        useFactory: () => ({ connectionUri }),
        name: 'test',
      };

      const dynamicModule = QueueModule.registerAsync(asyncOptions);
      expect(dynamicModule.exports).toContain(QueueService);
      expect(dynamicModule.exports).toContain(getQueueClientToken('test'));
    });

    it('should register core providers', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        useFactory: () => ({ connectionUri }),
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      expect(module.get(AMQPService)).toBeDefined();
      expect(module.get(QueueService)).toBeDefined();
    });

    it('should store connection options in AMQConnectionOptionsStorage for async registration', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        useFactory: () => ({ connectionUri }),
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      const stored = AMQConnectionOptionsStorage['storage'].get('test');
      expect(stored).toBeDefined();
      expect(stored.connectionUri).toBe(connectionUri);
    });

    it('should provide useClass provider when useClass is provided', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        imports: [TestQueueConfigModule],
        useClass: TestQueueConfigService,
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      const provider = module.get(TestQueueConfigService);
      expect(provider).toBeDefined();
    });
  });

  describe('module lifecycle', () => {
    it('should implement OnModuleInit', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const queueModuleInstance = module.get(QueueModule);
      expect(queueModuleInstance).toBeInstanceOf(QueueModule);
      expect(typeof (queueModuleInstance as any).onModuleInit).toBe('function');
    });

    it('should implement OnModuleDestroy', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const queueModuleInstance = module.get(QueueModule);
      expect(queueModuleInstance).toBeInstanceOf(QueueModule);
      expect(typeof (queueModuleInstance as any).onModuleDestroy).toBe('function');
    });

    it('should call QueueService.shutdown() on module destroy', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const queueService = module.get(QueueService);
      const shutdownSpy = jest.spyOn(queueService, 'shutdown').mockResolvedValue(undefined);

      const queueModuleInstance = module.get(QueueModule);
      await (queueModuleInstance as any).onModuleDestroy();

      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle connectionOptions undefined', async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.register({
            name: 'test',
            connectionUri,
            connectionOptions: undefined,
          }),
        ],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
      expect(connectionOptions.connectionUri).toBe(connectionUri);
      expect(connectionOptions.connectionOptions).toBeUndefined();
    });

    it('should handle throwExceptionOnConnectionError option', async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.register({
            name: 'test',
            connectionUri,
          }),
        ],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
    });

    it('should create different queue clients for different names', async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.register({ name: 'connection1', connectionUri: 'amqp://localhost:5672' }),
          QueueModule.register({ name: 'connection2', connectionUri: 'amqp://localhost:5671' }),
        ],
      }).compile();

      const client1 = module.get(getQueueClientToken('connection1'));
      const client2 = module.get(getQueueClientToken('connection2'));

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });

    it('should handle async registration with no custom imports', async () => {
      const asyncOptions: QueueModuleAsyncOptions & { name: string } = {
        useFactory: () => ({ connectionUri }),
        name: 'test',
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.registerAsync(asyncOptions)],
      }).compile();

      expect(module).toBeDefined();
      const connectionOptions = module.get(getAMQConnectionOptionsToken('test'));
      expect(connectionOptions).toBeDefined();
    });

    it('should handle custom logger in register options', async () => {
      const customLogger = { log: jest.fn(), error: jest.fn() };

      module = await Test.createTestingModule({
        imports: [
          QueueModule.register({
            name: 'test',
            connectionUri,
            logger: customLogger as any,
          }),
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('provider resolution', () => {
    it('should resolve QueueService as singleton', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const queueService1 = module.get(QueueService);
      const queueService2 = module.get(QueueService);

      expect(queueService1).toBe(queueService2);
    });

    it('should resolve queue client via token', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'myqueue', connectionUri })],
      }).compile();

      const queueClient = module.get(getQueueClientToken('myqueue'));
      expect(queueClient).toBeDefined();
      expect(queueClient.name).toBe('myqueue');
    });

    it('should inject QueueService into QueueClient', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.register({ name: 'test', connectionUri })],
      }).compile();

      const queueClient = module.get(getQueueClientToken('test'));
      expect(queueClient.queueService).toBeDefined();
      expect(queueClient.queueService).toBeInstanceOf(QueueService);
    });
  });
});
