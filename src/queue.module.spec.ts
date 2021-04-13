import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('rhea-promise');

import { QueueModuleOptions, QueueModuleOptionsFactory } from './interface';
import { QueueModule } from './queue.module';
import { AMQPService, QueueService } from './service';

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
    await module.close();
    (QueueModule as any).moduleDefinition.imports = [];
    (QueueModule as any).moduleDefinition.providers = originalModuleProviders;
  });

  describe('forRoot()', () => {
    it('should work only with a connection URI', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri)],
      }).compile();
      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getModuleOptions()).toEqual(moduleOptions);
    });

    it('should work with connection URI and module options arguments', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri, { throwExceptionOnConnectionError: true })],
      }).compile();
      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getModuleOptions()).toEqual({ throwExceptionOnConnectionError: true, connectionUri });
    });

    it('should work only with module options', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot({ connectionUri, throwExceptionOnConnectionError: true })],
      }).compile();
      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getModuleOptions()).toEqual({ throwExceptionOnConnectionError: true, connectionUri });
    });
  });

  describe('forFeature()', () => {
    it('should import as feature module', async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri), TestForFeatureModule],
      }).compile();
      const forFeatureTestService = module.get<TestForFeatureService>(TestForFeatureService);

      expect((forFeatureTestService.queueService as any).amqpService.getModuleOptions()).toEqual(moduleOptions);
    });
  });

  describe('forRootAsync()', () => {
    it(`should import as sync module with 'useFactory'`, async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRootAsync({
            useFactory: () => ({ connectionUri }),
          }),
        ],
      }).compile();
      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getModuleOptions()).toEqual({ connectionUri });
    });

    it(`should import as async module with 'useFactory'`, async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRootAsync({
            imports: [TestConfigModule],
            inject: [TestConfigService],
            useFactory: (testConfigService: TestConfigService) => ({
              connectionUri: testConfigService.getAmqpUrl(),
            }),
          }),
        ],
      }).compile();
      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getModuleOptions()).toEqual({ connectionUri });
    });

    it(`should import as async module with 'useClass'`, async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRootAsync({
            imports: [TestQueueConfigModule],
            useClass: TestQueueConfigService,
          }),
        ],
      }).compile();
      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getModuleOptions()).toEqual({ connectionUri });
    });

    it(`should import as async module with 'useExisting'`, async () => {
      module = await Test.createTestingModule({
        imports: [
          QueueModule.forRootAsync({
            imports: [TestQueueConfigModule],
            useExisting: TestQueueConfigService,
          }),
        ],
      }).compile();
      const amqpService = module.get<AMQPService>(AMQPService);

      expect(amqpService.getModuleOptions()).toEqual({ connectionUri });
    });
  });

  describe('make to global module', () => {
    it(`should be global module with .forRoot() import`, async () => {
      module = await Test.createTestingModule({
        imports: [QueueModule.forRoot(connectionUri, { isGlobal: true }), TestGlobalFeatureModule],
      }).compile();
      const testGlobalFeatureService = module.get<TestGlobalFeatureService>(TestGlobalFeatureService);

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
