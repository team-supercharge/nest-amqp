import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AMQP_DEFAULT_CONNECTION_TOKEN, QUEUE_MODULE_OPTIONS } from './constant';

jest.mock('rhea-promise');

import { QueueModuleAsyncOptions, QueueModuleOptions, QueueModuleOptionsFactory } from './interface';
import { QueueModule } from './queue.module';
import { AMQPService, QueueService } from './service';
import { AMQConnectionOptionsStorage, AMQConnectionStorage, getAMQConnectionOptionsToken } from './util';

describe('QueueModule', () => {
  const connectionUri = 'amqp://localhost:5672';
  const moduleOptions: QueueModuleOptions = {
    connectionUri,
  };
  const originalModuleProviders = (QueueModule as any).moduleDefinition.providers;
  let module: TestingModule;

  @Injectable()
  class TestForFeatureService {
    constructor(public readonly queueService: QueueService) {}
  }

  @Module({
    imports: [QueueModule.forFeature()],
    providers: [TestForFeatureService],
    exports: [TestForFeatureService],
  })
  class TestForFeatureModule {}

  @Injectable()
  class TestConfigService {
    public getAmqpUrl(): string {
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
    public async createQueueModuleOptions(): Promise<QueueModuleOptions> {
      return { connectionUri };
    }
  }

  @Module({
    providers: [TestQueueConfigService],
    exports: [TestQueueConfigService],
  })
  class TestQueueConfigModule {}

  @Injectable()
  class TestGlobalFeatureService {
    constructor(public readonly queueService: QueueService) {}
  }

  @Module({
    providers: [TestGlobalFeatureService],
    exports: [TestGlobalFeatureService],
  })
  class TestGlobalFeatureModule {}

  afterEach(async () => {
    ((AMQConnectionOptionsStorage as any).storage as Map<string, any>).clear();
    ((AMQConnectionStorage as any).storage as Map<string, any>).clear();

    await module?.close();

    (QueueModule as any).moduleDefinition.imports = [];
    (QueueModule as any).moduleDefinition.providers = originalModuleProviders;
  });

  describe('forRoot()', () => {
    it('should work only with a connection URI', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN));

      expect(connectionOptions).toEqual(moduleOptions);
    });

    it('should work with connection URI and module options arguments', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri, { throwExceptionOnConnectionError: true })],
      }).compile();

      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getConnectionOptions()).toEqual({ throwExceptionOnConnectionError: true, connectionUri });
    });

    it('should work only with module options', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot({ connectionUri, throwExceptionOnConnectionError: true })],
      }).compile();

      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getConnectionOptions()).toEqual({ throwExceptionOnConnectionError: true, connectionUri });
    });

    it('should work with connection URI and connection name', async () => {
      const connection = 'test-connection';

      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot([{ connectionUri, name: connection }], {})],
      }).compile();

      const amqpService = module.get<AMQPService>(AMQPService);
      expect(amqpService.getConnectionOptions(connection)).toEqual({ connectionUri });
    });

    it('should work with multiple connection options supplied', async () => {
      const connection1 = 'connection1';
      const connection2 = 'connection2';

      const connectionUri1 = 'amqp://localhost:5672';
      const connectionUri2 = 'amqp://localhost:5671';

      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRoot(
            [
              { connectionUri: connectionUri1, name: connection1, connectionOptions: {} },
              { connectionUri: connectionUri2, name: connection2, connectionOptions: {} },
            ],
            {},
          ),
        ],
      }).compile();

      const amqpService = module.get<AMQPService>(AMQPService);
      expect(amqpService.getConnectionOptions(connection1)).toEqual({ connectionUri: connectionUri1, connectionOptions: {} });
      expect(amqpService.getConnectionOptions(connection2)).toEqual({ connectionUri: connectionUri2, connectionOptions: {} });
    });

    it('should work with multiple connection options supplied, one named default', async () => {
      const connection2 = 'connection2';

      const connectionUri1 = 'amqp://localhost:5672';
      const connectionUri2 = 'amqp://localhost:5671';

      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRoot(
            [
              { connectionUri: connectionUri1, connectionOptions: {} },
              { connectionUri: connectionUri2, name: connection2, connectionOptions: {} },
            ],
            {},
          ),
        ],
      }).compile();

      const amqpService = module.get<AMQPService>(AMQPService);
      expect(amqpService.getConnectionOptions()).toEqual({ connectionUri: connectionUri1, connectionOptions: {} });
      expect(amqpService.getConnectionOptions(AMQP_DEFAULT_CONNECTION_TOKEN)).toEqual({
        connectionUri: connectionUri1,
        connectionOptions: {},
      });
      expect(amqpService.getConnectionOptions(connection2)).toEqual({ connectionUri: connectionUri2, connectionOptions: {} });
    });
  });

  describe('forFeature()', () => {
    it('should import as feature module, with default module options', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri), TestForFeatureModule],
      }).compile();

      const forFeatureTestService = module.get<TestForFeatureService>(TestForFeatureService);

      expect((forFeatureTestService.queueService as any).amqpService.getConnectionOptions()).toEqual(moduleOptions);
    });

    it('should import as feature module, with module options for connection', async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRoot(connectionUri),
          {
            imports: [QueueModule.forFeature()],
            providers: [TestForFeatureService],
            exports: [TestForFeatureService],
            module: TestForFeatureModule,
          },
        ],
      }).compile();

      const forFeatureTestService = module.get<TestForFeatureService>(TestForFeatureService);

      expect((forFeatureTestService.queueService as any).amqpService.getConnectionOptions()).toEqual(moduleOptions);
    });
  });

  describe('forRootAsync()', () => {
    it(`should import as sync module with 'useFactory'`, async () => {
      const asyncOptions = { useFactory: () => ({ connectionUri }) };
      module = await Test.createTestingModule({
        imports: [QueueModule.forRootAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN));

      expect(connectionOptions).toEqual({ connectionUri });
    });

    it(`should import as async module with 'useFactory'`, async () => {
      const asyncOptions = {
        imports: [TestConfigModule],
        inject: [TestConfigService],
        useFactory: (testConfigService: TestConfigService) => ({
          connectionUri: testConfigService.getAmqpUrl(),
        }),
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.forRootAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN));

      expect(connectionOptions).toEqual({ connectionUri });
    });

    it(`should import as async module with 'useClass'`, async () => {
      const asyncOptions = {
        imports: [TestQueueConfigModule],
        useClass: TestQueueConfigService,
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.forRootAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN));

      expect(connectionOptions).toEqual({ connectionUri });
    });

    it(`should import as async module with 'useExisting'`, async () => {
      const asyncOptions = {
        imports: [TestQueueConfigModule],
        useExisting: TestQueueConfigService,
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.forRootAsync(asyncOptions)],
      }).compile();

      const connectionOptions = module.get(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN));

      expect(connectionOptions).toEqual({ connectionUri });
    });

    it(`should import as async module with 'useExisting' adding Queue Module Options`, async () => {
      const asyncOptions: QueueModuleAsyncOptions = {
        imports: [TestQueueConfigModule],
        useExisting: TestQueueConfigService,
      };

      module = await Test.createTestingModule({
        imports: [QueueModule.forRootAsync(asyncOptions)],
      }).compile();

      const moduleOptions = module.get(QUEUE_MODULE_OPTIONS);

      expect(moduleOptions).toEqual({ connectionUri });
    });

    it('should throw error when no provider is added', async () => {
      try {
        Test.createTestingModule({
          imports: [QueueModule.forRootAsync({})],
        });
      } catch (e) {
        expect(e.message).toBe('Must provide factory, class or existing provider');
      }
    });
  });

  describe('make to global module', () => {
    it(`should be global module with .forRoot() import`, async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri, { isGlobal: true }), TestGlobalFeatureModule],
      }).compile();

      const testGlobalFeatureService = module.get<TestGlobalFeatureService>(TestGlobalFeatureService);
      const connectionOptions = module.get(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN));

      expect(connectionOptions).toEqual({ connectionUri });
      expect(testGlobalFeatureService.queueService).toBeDefined();
    });

    it(`should be global module with .forRootAsync() import`, async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRootAsync({
            isGlobal: true,
            useFactory: () => ({ connectionUri }),
          }),
          TestGlobalFeatureModule,
        ],
      }).compile();
      const testGlobalFeatureService = module.get<TestGlobalFeatureService>(TestGlobalFeatureService);
      const connectionOptions = module.get(getAMQConnectionOptionsToken(AMQP_DEFAULT_CONNECTION_TOKEN));

      expect(connectionOptions).toEqual({ connectionUri });
      expect(testGlobalFeatureService.queueService).toBeDefined();
    });

    it(`should use .forFeature() when not global module`, async () => {
      const moduleBuilder = Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri, { isGlobal: false }), TestGlobalFeatureModule],
      });

      await expect(moduleBuilder.compile()).rejects.toThrow(/Nest can't resolve dependencies of the TestGlobalFeatureService/);
    });
  });
});
