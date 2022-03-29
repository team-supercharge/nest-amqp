import { Test, TestingModule } from '@nestjs/testing';
import MockInstance = jest.MockInstance;

jest.mock('rhea-promise');

import { Connection, ConnectionEvents, ReceiverEvents, SenderEvents } from 'rhea-promise';

import { EventContextMock } from '../../test/event-context.mock';
import { AMQP_CLIENT_TOKEN, AMQP_DEFAULT_CONNECTION_TOKEN } from '../../constant';
import { QueueModuleOptions } from '../../interface';
import { NestAmqpInvalidConnectionProtocolException } from '../../exception';
import { AMQConnectionStorage, getAMQConnectionToken, getAMQConnectionOptionsToken, Logger, AMQConnectionOptionsStorage } from '../../util';
import { LoggerMock } from '../../test/logger.mock';

import { AMQPService } from './amqp.service';

Logger.overrideLogger(new LoggerMock());

describe('AMQPService', () => {
  const connectionUri = 'amqp://localhost:5672';
  const connectionSecureUri = 'amqps://localhost:5672';
  let module: TestingModule;
  let service: AMQPService;
  let moduleOptions: QueueModuleOptions = { connectionUri };
  let connection: Connection;
  let connectionEvents: Array<{ event: ConnectionEvents; callback: (context: any) => any }> = [];
  let senderEvents: Array<{ event: SenderEvents; callback: (context: any) => any }> = [];
  let receiverEvents: Array<{ event: ReceiverEvents; callback: (context: any) => any }> = [];
  let connectionOpenMock: jest.Mock = jest.fn().mockResolvedValue(null);
  const getLastMockCall = (obj: MockInstance<any, any>) => {
    const mockCalls = obj.mock.calls;
    return mockCalls[mockCalls.length - 1];
  };

  const spyStorageSet = jest.spyOn(AMQConnectionStorage['storage'], 'set');
  const spyStorageGet = jest.spyOn(AMQConnectionStorage['storage'], 'get');

  beforeAll(() => {
    // mock the Connection constructor
    (Connection as any).mockImplementation(() => ({
      on: (event: ConnectionEvents, callback: (context: any) => any) => connectionEvents.push({ event, callback }),
      open: connectionOpenMock,
      close: jest.fn().mockResolvedValue(null),
      createAwaitableSender: jest.fn().mockResolvedValue({
        on: (event: SenderEvents, callback: (context: any) => any) => senderEvents.push({ event, callback }),
      }),
      createReceiver: jest.fn().mockImplementation(options => ({
        on: (event: ReceiverEvents, callback: (context: any) => any) => receiverEvents.push({ event, callback }),
        credits: 0,
        addCredit: function (credits: number) {
          this.credits += credits;
        },
        linkOptions: options,
      })),
      _connection: {
        dispatch: (): undefined => void 0,
      },
    }));
  });

  beforeEach(async () => {
    (Connection as any).mockClear();
    connectionEvents = [];
    senderEvents = [];
    receiverEvents = [];
    moduleOptions = { connectionUri };

    AMQConnectionStorage['storage'].clear();
    AMQConnectionOptionsStorage['storage'].clear();
    spyStorageSet.mockClear();
    spyStorageGet.mockClear();

    module = await Test.createTestingModule({
      providers: [
        {
          provide: getAMQConnectionOptionsToken(),
          useValue: moduleOptions,
        },
        {
          provide: AMQP_CLIENT_TOKEN,
          useFactory: async options => {
            connection = await AMQPService.createConnection(options);

            return connection;
          },
          inject: [getAMQConnectionOptionsToken()],
        },
        AMQPService,
      ],
    }).compile();
    service = module.get<AMQPService>(AMQPService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return with module options', async () => {
    AMQConnectionOptionsStorage.add('test', moduleOptions);
    expect(service.getConnectionOptions('test')).toEqual(moduleOptions);
  });

  it('should create connection', async () => {
    const localConnection = await AMQPService.createConnection({ connectionUri: connectionSecureUri });

    expect(localConnection.open).toHaveBeenCalled();
  });

  it('should create connection with special chars in username and password', async () => {
    const username = 'Jörg';
    const password = 'Gt|N#R=6$5(TE@rH"Pvc$7a';
    const localConnectionUri = `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@localhost:5672`;

    await AMQPService.createConnection({ connectionUri: localConnectionUri });

    expect(getLastMockCall(Connection as any)[0]).toEqual(expect.objectContaining({ username, password }));
  });

  it('should create throw error if connection options is not a valid object', async () => {
    await expect(AMQPService.createConnection(null)).rejects.toThrow(/connection options must an object/);
  });

  describe('connection protocol', () => {
    it('should work with amqp:// protocol', async () => {
      await AMQPService.createConnection({ connectionUri: 'amqp://localhost:5672' });
      expect(getLastMockCall(Connection as any)[0]).toEqual(expect.objectContaining({ transport: 'tcp' }));
    });

    it('should work with amqps:// protocol', async () => {
      await AMQPService.createConnection({ connectionUri: 'amqps://localhost:5672' });
      expect(getLastMockCall(Connection as any)[0]).toEqual(expect.objectContaining({ transport: 'ssl' }));
    });

    it('should work with amqp+ssl:// protocol', async () => {
      await AMQPService.createConnection({ connectionUri: 'amqp+ssl://localhost:5672' });
      expect(getLastMockCall(Connection as any)[0]).toEqual(expect.objectContaining({ transport: 'ssl' }));
    });

    it('should work with amqp+tls:// protocol', async () => {
      await AMQPService.createConnection({ connectionUri: 'amqp+tls://localhost:5672' });
      expect(getLastMockCall(Connection as any)[0]).toEqual(expect.objectContaining({ transport: 'tls' }));
    });

    it('should throw error on unsupported protocol', async () => {
      await expect(AMQPService.createConnection({ connectionUri: 'stomp://localhost:5672' })).rejects.toThrowError(
        NestAmqpInvalidConnectionProtocolException,
      );
    });
  });

  describe('connection options', () => {
    it('should not throw connection error by default', async () => {
      connectionOpenMock = jest.fn().mockRejectedValue(new Error('Test'));

      await expect(AMQPService.createConnection({ connectionUri })).resolves.toBeInstanceOf(Object);

      connectionOpenMock = jest.fn().mockResolvedValue(null);
    });

    it('should throw connection error by connection options', async () => {
      const exception = new Error('Test');
      connectionOpenMock = jest.fn().mockRejectedValue(exception);

      await expect(AMQPService.createConnection({ connectionUri, throwExceptionOnConnectionError: true })).rejects.toBe(exception);

      connectionOpenMock = jest.fn().mockResolvedValue(null);
    });
  });

  it('should listen to connection events', async () => {
    connectionEvents = [];

    await AMQPService.createConnection({ connectionUri: connectionSecureUri });

    connectionEvents.forEach(event =>
      event.callback(
        new EventContextMock({
          error: new Error('test'),
          connection: {
            open: () => Promise.resolve({}),
          },
        }),
      ),
    );

    expect(connectionEvents.length).toBeGreaterThan(0);
  });

  it('should reconnect when connection closed because of error', async () => {
    const eventContext = new EventContextMock({ error: new Error(), connection: { open: jest.fn().mockResolvedValue(true) } });
    const connectionCloseEventHandler = connectionEvents.find(item => {
      return item.event === ConnectionEvents.connectionClose;
    }).callback;

    jest.useFakeTimers();
    connectionCloseEventHandler(eventContext);
    jest.runOnlyPendingTimers();
    expect(eventContext.connection.open).toHaveBeenCalled();
    jest.clearAllTimers();
  });

  it('should not try to reconnect when connection closed without error', async () => {
    const eventContext = new EventContextMock({ error: null, connection: { open: jest.fn().mockResolvedValue(true) } });
    const connectionCloseEventHandler = connectionEvents.find(item => {
      return item.event === ConnectionEvents.connectionClose;
    }).callback;

    jest.useFakeTimers();
    connectionCloseEventHandler(eventContext);
    jest.runOnlyPendingTimers();
    expect(eventContext.connection.open).toBeCalledTimes(0);
    jest.clearAllTimers();
  });

  it('should reconnect with connection error', async () => {
    const eventContext = new EventContextMock({ error: new Error(), connection: { open: jest.fn().mockRejectedValue(new Error()) } });
    const connectionCloseEventHandler = connectionEvents.find(item => {
      return item.event === ConnectionEvents.connectionClose;
    }).callback;

    jest.useFakeTimers();
    connectionCloseEventHandler(eventContext);
    jest.runOnlyPendingTimers();
    expect(eventContext.connection.open).toHaveBeenCalled();
    jest.clearAllTimers();
  });

  describe(`'disconnect' connection event`, () => {
    it('should log error message during connection closing', async () => {
      const customError = {
        counter: 0,
        get message() {
          this.counter++;
          return 'msg';
        },
      };
      const eventContext = new EventContextMock({ error: customError });
      const disconnectedEventHandler = connectionEvents.find(item => {
        return item.event === ConnectionEvents.disconnected;
      }).callback;

      disconnectedEventHandler(eventContext);
      expect(customError.counter).toBe(2);
    });

    it('should log context error message during connection closing', async () => {
      const customError = {
        counter: 0,
        get message() {
          this.counter++;
          return 'msg';
        },
      };
      const eventContext = new EventContextMock({ _context: { error: customError } });
      const disconnectedEventHandler = connectionEvents.find(item => {
        return item.event === ConnectionEvents.disconnected;
      }).callback;

      disconnectedEventHandler(eventContext);
      expect(customError.counter).toBe(2);
    });

    it('should log nothing during connection closing', async () => {
      const disconnectedEventHandler = connectionEvents.find(item => {
        return item.event === ConnectionEvents.disconnected;
      }).callback;

      expect(() => disconnectedEventHandler(null)).not.toThrow();
    });
  });

  it('should successfully disconnect', async () => {
    const localConnection = module.get<Connection>(getAMQConnectionToken());

    await service.disconnect();

    expect(localConnection.close).toBeCalled();
  });

  it('should create a sender', async () => {
    await service.createSender('queue');

    expect(senderEvents.length).toBeGreaterThan(0);
  });

  it('should execute sender events', async () => {
    const context = new EventContextMock();
    const spy = jest.spyOn(context.sender, 'address', 'get');
    await service.createSender('queueName');

    senderEvents.forEach(event => event.callback(context));

    expect(spy).toBeCalled();

    spy.mockRestore();
  });

  it('should create a receiver', async () => {
    await service.createReceiver('queueName', 1, async () => void 0);

    expect(receiverEvents.length).toBeGreaterThan(0);
  });

  it('should execute receiver events', async () => {
    const context = new EventContextMock();
    const spy = jest.spyOn(context.receiver, 'address', 'get');
    await service.createReceiver('queueName', 1, async () => void 0);

    receiverEvents.forEach(event => event.callback(context));

    expect(spy).toBeCalled();

    spy.mockRestore();
  });

  it('should add credits', async () => {
    const context = new EventContextMock();
    const addCredits = 10;
    await service.createReceiver('queueName', addCredits, async () => void 0);

    receiverEvents.forEach(event => event.callback(context));

    expect(context.receiver.addCredit).toBeCalledWith(addCredits);
  });

  it('should execute onMessage() callback', async () => {
    const onMessage = jest.fn();
    const receiver = await service.createReceiver('queueName', 1, onMessage);

    (receiver.linkOptions as any).onMessage();

    expect(onMessage).toBeCalled();
  });

  it('should execute onError() callback', async () => {
    const context = new EventContextMock();
    const receiver = await service.createReceiver('queueName', 1, () => void 0);

    expect(() => {
      (receiver.linkOptions as any).onError(context);
    }).not.toThrow();
  });

  describe('multiple connections', () => {
    const connectionName = 'testConnection';

    beforeEach(() => {
      (AMQConnectionStorage['storage'] as Map<string, any>).clear();
      spyStorageSet.mockClear();
      spyStorageGet.mockClear();

      senderEvents = [];
      receiverEvents = [];

      service = module.get<AMQPService>(AMQPService);
    });

    it('should create connection with the default name', async () => {
      const createdConnection = await AMQPService.createConnection({ connectionUri: connectionSecureUri });

      const storedConnection = AMQConnectionStorage.get(AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(spyStorageSet.mock.calls.length).toEqual(1);
      expect(spyStorageSet.mock.calls[0][0]).toEqual(AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(storedConnection).toEqual(createdConnection);
    });

    it('should create connection with not the default name', async () => {
      const createdConnection = await AMQPService.createConnection({ connectionUri: connectionSecureUri }, connectionName);

      const storedConnection = AMQConnectionStorage.get(connectionName);

      expect(spyStorageSet.mock.calls.length).toEqual(1);
      expect(spyStorageSet.mock.calls[0][0]).toEqual(connectionName);

      expect(storedConnection).toEqual(createdConnection);
    });

    it('should create sender on connection', async () => {
      await AMQPService.createConnection({ connectionUri: connectionSecureUri }, connectionName);

      await service.createSender('testQueue', connectionName);

      expect(senderEvents.length).toBeGreaterThan(0);
    });

    it('should throw error while trying to create sender on nonexistent connection', async () => {
      await AMQPService.createConnection({ connectionUri: connectionSecureUri }, connectionName);

      try {
        await service.createSender('testQueue', 'nonExisting');
        expect.assertions(1);
      } catch (error) {
        expect((error as Error).message).toBe('No connection found for name nonExisting');
      }

      expect(spyStorageGet.mock.calls.length).toEqual(1);
      expect(spyStorageGet.mock.calls[0][0]).toEqual('nonExisting');
      expect(senderEvents.length).toEqual(0);
    });

    it('should create receiver on connection', async () => {
      await AMQPService.createConnection({ connectionUri: connectionSecureUri }, connectionName);

      await service.createReceiver('testQueue', 1, async () => void 0, connectionName);

      expect(receiverEvents.length).toBeGreaterThan(0);
    });

    it('should throw error while trying to create receiver on nonexistent connection', async () => {
      await AMQPService.createConnection({ connectionUri: connectionSecureUri }, connectionName);

      try {
        await service.createReceiver('testQueue', 1, async () => void 0, 'nonExisting');
        expect.assertions(1);
      } catch (error) {
        expect((error as Error).message).toBe('No connection found for name nonExisting');
      }

      expect(spyStorageGet.mock.calls.length).toEqual(1);
      expect(spyStorageGet.mock.calls[0][0]).toEqual('nonExisting');
      expect(receiverEvents.length).toEqual(0);
    });
  });
});
