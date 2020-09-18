import { Test, TestingModule } from '@nestjs/testing';

jest.mock('rhea-promise');

import { Connection, ConnectionEvents, ReceiverEvents, SenderEvents } from 'rhea-promise';

import { AMQP_CLIENT_TOKEN, AMQPService } from './amqp.service';
import { EventContextMock } from '../../test/event-context.mock';

describe('AMQPService', () => {
  const connectionUri = 'amqp://localhost:5672';
  const connectionSecureUri = 'amqps://localhost:5672';
  let module: TestingModule;
  let service: AMQPService;
  let connection: Connection;
  let connectionEvents: Array<{ event: ConnectionEvents; callback: (context: any) => any }> = [];
  let senderEvents: Array<{ event: SenderEvents; callback: (context: any) => any }> = [];
  const receiverEvents: Array<{ event: ReceiverEvents; callback: (context: any) => any }> = [];

  beforeAll(() => {
    // mock the Connection constructor
    (Connection as any).mockImplementation(() => ({
      on: (event: ConnectionEvents, callback: (context: any) => any) => connectionEvents.push({ event, callback }),
      open: jest.fn().mockResolvedValue(null),
      close: jest.fn().mockResolvedValue(null),
      createAwaitableSender: jest.fn().mockResolvedValue({
        on: (event: SenderEvents, callback: (context: any) => any) => senderEvents.push({ event, callback }),
      }),
      createReceiver: jest.fn().mockImplementation(options => ({
        on: (event: ReceiverEvents, callback: (context: any) => any) => receiverEvents.push({ event, callback }),
        credits: 0,
        addCredit: function(credits) {
          this.credits += credits;
        },
        linkOptions: options,
      })),
    }));
  });

  beforeEach(async () => {
    (Connection as any).mockClear();
    connectionEvents = [];
    senderEvents = [];
    connection = await AMQPService.createConnection(connectionUri);
    module = await Test.createTestingModule({
      providers: [
        AMQPService,
        {
          provide: AMQP_CLIENT_TOKEN,
          useValue: connection,
        },
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

  it('should create connection', async () => {
    const connection = await AMQPService.createConnection(connectionSecureUri);

    expect((connection as any).open).toHaveBeenCalled();
  });

  it('should listen to connection events', async () => {
    connectionEvents = [];

    await AMQPService.createConnection(connectionSecureUri);

    connectionEvents.forEach(event => event.callback({}));

    expect(connectionEvents.length).toBeGreaterThan(0);
  });

  it('should reconnect when connection close because of error', async () => {
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

  it('should successfully disconnect', async () => {
    const connection = module.get<Connection>(AMQP_CLIENT_TOKEN);

    await service.disconnect();

    expect(connection.close).toBeCalled();
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
    await service.createReceiver('queueName', 1, async () => {});

    expect(receiverEvents.length).toBeGreaterThan(0);
  });

  it('should execute receiver events', async () => {
    const context = new EventContextMock();
    const spy = jest.spyOn(context.receiver, 'address', 'get');
    await service.createReceiver('queueName', 1, async () => {});

    receiverEvents.forEach(event => event.callback(context));

    expect(spy).toBeCalled();

    spy.mockRestore();
  });

  it('should add credits', async () => {
    const context = new EventContextMock();
    const addCredits = 10;
    await service.createReceiver('queueName', addCredits, async () => {});

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
});
