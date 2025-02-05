import { Test, TestingModule } from '@nestjs/testing';
import { AwaitableSender, EventContext, Receiver, Source, filter } from 'rhea-promise';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { MessageControl } from '../../domain';
import { AMQPService } from '../amqp/amqp.service';
import { QueueService } from './queue.service';
import { EventContextMock } from '../../test/event-context.mock';
import { sleep } from '../../util/functions';
import { SendState } from '../../enum';
import { QueueModuleOptions } from '../../interface';
import { ObjectValidatorService } from '../object-validator/object-validator.service';
import { AMQP_DEFAULT_CONNECTION_TOKEN, QUEUE_MODULE_OPTIONS } from '../../constant';
import { AMQConnectionStorage, Logger } from '../../util';
import { LoggerMock } from '../../test/logger.mock';

jest.mock('../amqp/amqp.service');
jest.mock('../../domain/message-control.domain');
jest.mock('../../util/functions/sleep.function');

Logger.overrideLogger(new LoggerMock());

describe('QueueService', () => {
  const defaultQueue = 'test';
  let queueService: QueueService;
  let amqpService: AMQPService;

  const getSender = (service: QueueService, queueName: string, connectionName: string): AwaitableSender => {
    return (service as any).senders.get((service as any).getLinkToken(queueName, connectionName));
  };
  const getReceiver = (service: QueueService, queueName: string, connectionName: string): Receiver => {
    return (service as any).receivers.get((service as any).getLinkToken(queueName, connectionName));
  };
  const getMessageHandler = (service: AMQPService): ((context: EventContext) => Promise<void>) => {
    return (service.createReceiver as any).mock.calls[0][2];
  };
  const getInternallyCreatedMessageControl = (): MessageControl => {
    return (MessageControl as jest.Mock).mock.instances[0];
  };

  const moduleOptions: QueueModuleOptions = { connectionUri: null };

  class TestDto {
    @Expose()
    @IsString()
    public name: string;
  }

  beforeEach(async () => {
    (MessageControl as jest.Mock).mockClear();
    (sleep as jest.Mock).mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        ObjectValidatorService,
        {
          provide: QUEUE_MODULE_OPTIONS,
          useValue: moduleOptions as QueueModuleOptions,
        },
        {
          provide: AMQPService,
          useValue: {
            createReceiver: jest.fn().mockResolvedValue(jest.fn().mockResolvedValue(new EventContextMock().receiver)),
            createSender: jest.fn().mockResolvedValue(new EventContextMock().sender),
            disconnect: jest.fn().mockResolvedValue(jest.fn()),
            getConnectionOptions: jest.fn(() => ({
              connectionUri: 'amqp://test',
              retryConnection: {
                receiver: {
                  retryDelay: 1000,
                  maxRetryAttempts: 3,
                },
                sender: {
                  retryDelay: 1000,
                  maxRetryAttempts: 3,
                },
              },
            })),
            getModuleOptions(): QueueModuleOptions {
              return moduleOptions;
            },
          } as Partial<AMQPService>,
        },
      ],
    }).compile();
    queueService = module.get<QueueService>(QueueService);
    amqpService = module.get<AMQPService>(AMQPService);

    ((AMQConnectionStorage as any).storage as Map<string, any>).clear();
  });

  it('should be defined', () => {
    expect(queueService).toBeDefined();
  });

  it('should listen to a queue given by the queue name', async () => {
    const spy = jest.spyOn(queueService, 'getReceiver' as any);

    await queueService.listen(defaultQueue, () => void 0, {});

    expect(spy).toBeCalled();
    expect(spy.mock.calls[0][0]).toEqual('test');
  });

  it('should listen to a queue given by a Source object', async () => {
    const spy = jest.spyOn(queueService, 'getReceiver' as any);

    const source: Source = {
      address: defaultQueue,
      filter: filter.selector("(JMSDeliveryMode = 'PERSISTENT') OR (JMSCorrelationID) <> ''"),
    };

    await queueService.listen(source, () => void 0, {});

    expect(spy).toBeCalled();
    expect(spy.mock.calls[0][0]).toEqual(source);
  });

  describe('receiver', () => {
    it('should create a receiver', async () => {
      await queueService.listen(defaultQueue, () => void 0, {});

      expect(queueService['receivers'].size).toBe(1);
    });

    describe('message handling', () => {
      it('should handle not valid options for listen()', async () => {
        const callback = jest.fn().mockResolvedValue({});
        await queueService.listen(defaultQueue, callback, null);
        const messageHandler = getMessageHandler(amqpService);

        await messageHandler(new EventContextMock());

        expect(callback.mock.calls[0][0]).toBe(null);
      });

      it('should catch error during message validation', async () => {
        await queueService.listen(defaultQueue, () => void 0, null);
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        delete eventContext.message;

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(messageControl.reject).toHaveBeenCalled();
      });

      it('should catch error during callback processing', async () => {
        const errorMessage = 'test error message';
        await queueService.listen(
          defaultQueue,
          () => {
            throw new Error(errorMessage);
          },
          null,
        );
        const messageHandler = getMessageHandler(amqpService);

        await messageHandler(new EventContextMock());

        const messageControl = getInternallyCreatedMessageControl();
        expect(messageControl.reject).toHaveBeenCalledWith(errorMessage);
      });

      it('should catch error during body decoding', async () => {
        await queueService.listen(defaultQueue, () => void 0, { type: '' } as any);
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = '{null}';

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        // in node 20 error message on JSON parsing became more informative, hence the regex
        expect(messageControl.reject).toHaveBeenCalledWith(expect.stringMatching(/^(Expected|Unexpected token)/));
      });

      it('should not validate parsed body if explicitly specified (deprecated)', async () => {
        const callback = jest.fn();
        const body = { a: 1, b: 2 };
        await queueService.listen(defaultQueue, callback, { type: '', skipValidation: true } as any);
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = JSON.stringify(body);

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(callback).toHaveBeenCalledWith(body, messageControl, eventContext.message);
      });

      it('should not validate parsed body if explicitly specified', async () => {
        const callback = jest.fn();
        const body = { a: 1, b: 2 };
        await queueService.listen(defaultQueue, callback, { type: '', skipValidation: true } as any);
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = JSON.stringify(body);

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(callback).toHaveBeenCalledWith(body, messageControl, eventContext.message);
      });

      it('should successfully validate and transform parsed body', async () => {
        const body = { name: 'Peter' };
        const callback = async (result: any) => {
          expect(result).toBeInstanceOf(TestDto);
          expect(result).toEqual(body);
        };
        await queueService.listen(defaultQueue, callback, { type: TestDto });
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = JSON.stringify(body);

        await messageHandler(eventContext);
      });

      it('should handle validation error when message body is null', async () => {
        await queueService.listen(defaultQueue, () => void 0, { type: TestDto });
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = 'null';

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(messageControl.reject).toHaveBeenCalled();
      });

      it('should handle validation error when message body is an empty object', async () => {
        await queueService.listen(defaultQueue, () => void 0, { type: TestDto });
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = '{}';

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(messageControl.accept).not.toHaveBeenCalled();
      });

      it('should accept context when ValidationNullObjectException was thrown', async () => {
        await queueService.listen(defaultQueue, () => void 0, { type: TestDto, acceptValidationNullObjectException: true });
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = 'null';

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(messageControl.accept).toHaveBeenCalled();
      });

      it('should return an existing receiver if already created', async () => {
        const receiver = {} as Receiver;
        const source = 'test-queue';
        queueService['receivers'].set('default:test-queue', receiver);

        const result = await queueService['getReceiver'](source, 1, jest.fn(), 'default');

        expect(result).toBe(receiver);
        expect(amqpService.createReceiver).not.toHaveBeenCalled();
      });

      it('should create a new receiver if not already created', async () => {
        const receiver = {} as Receiver;
        const source = 'test-queue';
        const messageHandler = jest.fn();

        (amqpService as any).createReceiver.mockResolvedValue(receiver);

        const result = await queueService['getReceiver'](source, 1, messageHandler, 'default');

        expect(result).toBe(receiver);
        expect(amqpService.createReceiver).toHaveBeenCalledWith(source, 1, expect.any(Function), 'default');
      });

      it('should retry creating a receiver on failure', async () => {
        const source = 'test-queue';
        const messageHandler = jest.fn();

        (amqpService as any).createReceiver.mockRejectedValueOnce(new Error('Test error')).mockResolvedValueOnce({} as Receiver);

        const result = await queueService['getReceiver'](source, 1, messageHandler, 'default');

        expect(result).toBeDefined();
        expect(amqpService.createReceiver).toHaveBeenCalledTimes(2);
      });

      it('should not retry creating a receiver if maxRetryAttempts is 1', async () => {
        (amqpService as any).getConnectionOptions.mockReturnValueOnce({
          retryConnection: {
            receiver: {
              retryDelay: 1000,
              maxRetryAttempts: 1,
            },
          },
        });

        const source = 'test-queue';
        const messageHandler = jest.fn();

        (amqpService as any).createReceiver.mockRejectedValue(new Error('Test error'));

        await expect(queueService['getReceiver'](source, 1, messageHandler, 'default')).rejects.toThrow('Test error');

        expect(amqpService.createReceiver).toHaveBeenCalledTimes(1);
      });

      it('should not retry if both retryDelay and maxRetryAttempts are set to zero', async () => {
        (amqpService.getConnectionOptions as jest.Mock).mockReturnValueOnce({
          connectionUri: 'amqp://test',
          retryConnection: {
            receiver: {
              retryDelay: 0,
              maxRetryAttempts: 0,
            },
          },
        });

        const source = 'test-queue';
        const messageHandler = jest.fn();

        (amqpService.createReceiver as jest.Mock).mockRejectedValue(new Error('Test error'));

        await expect(queueService['getReceiver'](source, 1, messageHandler, 'default')).rejects.toThrow('Test error');

        expect(amqpService.createReceiver).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('listen()', () => {
    it('should work with parallelMessageProcessing option', async () => {
      const parallelMessageProcessing = 2;
      await queueService.listen(defaultQueue, () => void 0, { type: TestDto, parallelMessageProcessing });
      expect((amqpService as any).createReceiver.mock.calls[0][1]).toBe(parallelMessageProcessing);
    });

    it('should work with transformerOptions option', async () => {
      const payload = { name: 'Peter', age: 25 };
      const callback = async (result: any) => {
        expect(result).toEqual(payload);
      };
      await queueService.listen(defaultQueue, callback, {
        type: TestDto,
        transformerOptions: {
          strategy: 'exposeAll',
        },
      });
      const messageHandler = getMessageHandler(amqpService);
      const eventContext = new EventContextMock();
      eventContext.message.body = JSON.stringify(payload);

      await messageHandler(eventContext);
    });

    it('should work with validatorOptions option', async () => {
      const callback = async (result: any) => {
        expect(result).toEqual({});
      };
      await queueService.listen(defaultQueue, callback, {
        type: TestDto,
        validatorOptions: {
          skipNullProperties: true,
        },
      });
      const messageHandler = getMessageHandler(amqpService);
      const eventContext = new EventContextMock();
      eventContext.message.body = JSON.stringify({ name: null });

      await messageHandler(eventContext);
    });
  });

  describe('send()', () => {
    it('should successfully send a message', async () => {
      const result = await queueService.send(defaultQueue, '');

      expect(result).toEqual(SendState.Success);
    });

    it('should set cron schedule', async () => {
      await queueService.send(defaultQueue, null, { schedule: { cron: 'cron' } });
      const sender = getSender(queueService, defaultQueue, AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(sender.send).toHaveBeenCalledWith({ body: 'null', message_annotations: { 'x-opt-delivery-cron': 'cron' } });
    });

    it('should set divide minutes', async () => {
      await queueService.send(defaultQueue, null, { schedule: { divideMinute: 100 } });
      const sender = getSender(queueService, defaultQueue, AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(sender.send).toHaveBeenCalledWith({
        body: 'null',
        message_annotations: {
          'x-opt-delivery-cron': '* * * * *',
          'x-opt-delivery-delay': 0,
          'x-opt-delivery-period': 600,
          'x-opt-delivery-repeat': 99,
        },
      });
    });

    it('should delay the delivery', async () => {
      const delay = 30;
      await queueService.send(defaultQueue, null, { schedule: { afterSeconds: delay } });
      const sender = getSender(queueService, defaultQueue, AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(sender.send).toHaveBeenCalledWith({ body: 'null', message_annotations: { 'x-opt-delivery-delay': delay * 1000 } });
    });

    it('should have defaults with no options and no connectionName', async () => {
      await queueService.send(defaultQueue, null);
      const sender = getSender(queueService, defaultQueue, AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(sender.send).toHaveBeenCalledWith({ body: 'null' });
    });

    it('should have defaults with no options and with connectionName', async () => {
      const connection = 'test_connection';
      await queueService.send(defaultQueue, null, connection);
      const sender = getSender(queueService, defaultQueue, connection);

      expect(sender.send).toHaveBeenCalledWith({ body: 'null' });
    });

    it('should have defaults with options and with connectionName', async () => {
      const delay = 30;
      const connection = 'test_connection';
      await queueService.send(defaultQueue, null, { schedule: { afterSeconds: delay } }, connection);
      const sender = getSender(queueService, defaultQueue, connection);

      expect(sender.send).toHaveBeenCalledWith({ body: 'null', message_annotations: { 'x-opt-delivery-delay': delay * 1000 } });
    });

    it('should return an existing sender if already created', async () => {
      const sender = {} as AwaitableSender;
      const target = 'test-queue';
      queueService['senders'].set('default:test-queue', sender);

      const result = await queueService['getSender'](target, 'default');

      expect(result).toBe(sender);
      expect(amqpService.createSender).not.toHaveBeenCalled();
    });

    it('should create a new sender if not already created', async () => {
      const sender = {} as AwaitableSender;
      const target = 'test-queue';

      (amqpService as any).createSender.mockResolvedValue(sender);

      const result = await queueService['getSender'](target, 'default');

      expect(result).toBe(sender);
      expect(amqpService.createSender).toHaveBeenCalledWith(target, 'default');
    });

    it('should retry creating a sender on failure', async () => {
      const target = 'test-queue';

      (amqpService as any).createSender.mockRejectedValueOnce(new Error('Test error')).mockResolvedValueOnce({} as AwaitableSender);

      const result = await queueService['getSender'](target, 'default');

      expect(result).toBeDefined();
      expect(amqpService.createSender).toHaveBeenCalledTimes(2);
    });

    it('should retry creating a sender with custom retry configuration', async () => {
      (amqpService.getConnectionOptions as jest.Mock).mockReturnValueOnce({
        connectionUri: 'amqp://test',
        retryConnection: {
          sender: {
            retryDelay: 500,
            maxRetryAttempts: 2,
          },
        },
      });

      const target = 'test-queue';

      (amqpService.createSender as jest.Mock).mockRejectedValueOnce(new Error('Test error')).mockResolvedValueOnce({} as AwaitableSender);

      const result = await queueService['getSender'](target, 'default');

      expect(result).toBeDefined();
      expect(amqpService.createSender).toHaveBeenCalledTimes(2);
    });

    it('should not retry creating a sender if maxRetryAttempts is 1', async () => {
      (amqpService.getConnectionOptions as jest.Mock).mockReturnValueOnce({
        connectionUri: 'amqp://test',
        retryConnection: {
          sender: {
            retryDelay: 1000,
            maxRetryAttempts: 1,
          },
        },
      });

      const target = 'test-queue';

      (amqpService.createSender as jest.Mock).mockRejectedValue(new Error('Test error'));

      await expect(queueService['getSender'](target, 'default')).rejects.toThrow('Test error');

      expect(amqpService.createSender).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeListener()', () => {
    it('should remove listener', async () => {
      (amqpService.createReceiver as jest.Mock).mockResolvedValue(new EventContextMock().receiver);
      await queueService.listen(defaultQueue, () => void 0, {});
      expect(queueService['receivers'].size).toBe(1);

      const receiver = queueService['receivers'].get(queueService['receivers'].keys().next().value);

      const result = await queueService.removeListener(defaultQueue);
      expect(receiver.close).toBeCalled();
      expect(result).toBe(true);
      expect(queueService['receivers'].size).toBe(0);
    });

    it('should remove listener with connectionName', async () => {
      (amqpService.createReceiver as jest.Mock).mockResolvedValue(new EventContextMock().receiver);
      const connection = 'test_connection';
      await queueService.listen(defaultQueue, () => void 0, {}, connection);

      const receiver = queueService['receivers'].get(queueService['receivers'].keys().next().value);

      expect(queueService['receivers'].size).toBe(1);

      const result = await queueService.removeListener(defaultQueue, connection);
      expect(receiver.close).toBeCalled();
      expect(result).toBe(true);
      expect(queueService['receivers'].size).toBe(0);
    });

    it('should remove listener with Source object', async () => {
      (amqpService.createReceiver as jest.Mock).mockResolvedValue(new EventContextMock().receiver);
      const source: Source = {
        address: defaultQueue,
        filter: filter.selector("((JMSCorrelationID) <> ''"),
      };
      await queueService.listen(source, () => void 0, {});
      expect(queueService['receivers'].size).toBe(1);
      const receiver = queueService['receivers'].get(queueService['receivers'].keys().next().value);

      const result = await queueService.removeListener(source);
      expect(receiver.close).toBeCalled();
      expect(result).toBe(true);
      expect(queueService['receivers'].size).toBe(0);
    });

    it('should not do anything with non-existing listener', async () => {
      (amqpService.createReceiver as jest.Mock).mockResolvedValue(new EventContextMock().receiver);
      await queueService.listen(defaultQueue, () => void 0, {});
      expect(queueService['receivers'].size).toBe(1);

      const result = await queueService.removeListener('otherQueue');
      expect(result).toBe(false);
      expect(queueService['receivers'].size).toBe(1);
    });
  });

  it('should shutdown', async () => {
    (amqpService.createReceiver as jest.Mock).mockResolvedValue(new EventContextMock().receiver);
    await queueService.listen(defaultQueue, () => void 0, {});
    const receiver = getReceiver(queueService, defaultQueue, AMQP_DEFAULT_CONNECTION_TOKEN);
    (receiver as any).connection = {
      isOpen: () => true,
    };
    (sleep as jest.Mock).mockImplementation(() => {
      (receiver as any).credit = 1;
    });

    await queueService.shutdown();

    expect(amqpService.disconnect).toBeCalled();
  });

  it('should clear links', async () => {
    await queueService['getSender']('queueName', AMQP_DEFAULT_CONNECTION_TOKEN);

    queueService.clearSenderAndReceiverLinks();

    expect(queueService['senders'].size).toBe(0);
  });

  describe('getReceiver()', () => {
    it('should create receiver if not exists yet', async () => {
      await queueService['getReceiver']('queueName', 1, async () => void 0, AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(queueService['receivers'].size).toBe(1);
    });

    it('should not create an existing receiver', async () => {
      await queueService['getReceiver']('queueName', 1, async () => void 0, AMQP_DEFAULT_CONNECTION_TOKEN);
      await queueService['getReceiver']('queueName', 1, async () => void 0, AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(queueService['receivers'].size).toBe(1);
    });

    it('should create different receivers for the same queue name but on different connections', async () => {
      const queue = 'queue';
      enum connection {
        A = 'A',
        B = 'B',
      }

      await queueService['getReceiver'](queue, 1, async () => void 0, connection.A);
      await queueService['getReceiver'](queue, 1, async () => void 0, connection.B);

      expect(queueService['receivers'].size).toBe(2);
    });
  });

  describe('getSender()', () => {
    it('should create sender if not exists yet', async () => {
      await queueService['getSender']('queueName', AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(queueService['senders'].size).toBe(1);
    });

    it('should not create an existing sender', async () => {
      await queueService['getSender']('queueName', AMQP_DEFAULT_CONNECTION_TOKEN);
      await queueService['getSender']('queueName', AMQP_DEFAULT_CONNECTION_TOKEN);

      expect(queueService['senders'].size).toBe(1);
    });

    it('should create different senders for the same queue name but on different connections', async () => {
      const queue = 'queue';
      enum connection {
        A = 'A',
        B = 'B',
      }

      await queueService['getSender'](queue, connection.A);
      await queueService['getSender'](queue, connection.B);

      expect(queueService['senders'].size).toBe(2);
    });
  });

  it('should encode message', () => {
    const obj = { name: 'Peter' };
    const result = queueService['encodeMessage'](obj);

    expect(result).toEqual(JSON.stringify(obj));
  });

  describe('decodeMessage()', () => {
    it('should decode Buffer', () => {
      const result = queueService['decodeMessage'](Buffer.from('{}'));

      expect(result).toEqual({});
    });

    it('should with the argument itself if it is an object', () => {
      const obj = { name: 'Peter' };
      const result = queueService['decodeMessage'](obj);

      expect(result).toBe(obj);
    });

    it('should decode not object but valid values', () => {
      const result = queueService['decodeMessage']('false');

      expect(result).toEqual(false);
    });

    it('should decode valid objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const result = queueService['decodeMessage'](JSON.stringify(obj));

      expect(result).toEqual(obj);
    });

    it('should throw error on invalid objects', () => {
      expect(() => {
        queueService['decodeMessage']('{null}');
      }).toThrowError(SyntaxError);
    });
  });
});
