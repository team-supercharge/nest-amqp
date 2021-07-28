import { Test, TestingModule } from '@nestjs/testing';
import { AwaitableSender, EventContext, Receiver } from 'rhea-promise';
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
import { QUEUE_MODULE_OPTIONS } from '../../constant';
import { Logger } from '../../util';
import { LoggerMock } from '../../test/logger.mock';

jest.mock('../amqp/amqp.service');
jest.mock('../../domain/message-control.domain');
jest.mock('../../util/functions/sleep.function');

Logger.overrideLogger(new LoggerMock());

describe('QueueService', () => {
  const defaultQueue = 'test';
  let queueService: QueueService;
  let amqpService: AMQPService;

  const getSender = (service: QueueService, queueName: string): AwaitableSender => {
    return (service as any).senders.get(queueName);
  };
  const getReceiver = (service: QueueService, queueName: string): Receiver => {
    return (service as any).receivers.get(queueName);
  };
  const getMessageHandler = (amqpService: AMQPService): ((context: EventContext) => Promise<void>) => {
    return (amqpService.createReceiver as any).mock.calls[0][2];
  };
  const getInternallyCreatedMessageControl = (): MessageControl => {
    return (MessageControl as jest.Mock).mock.instances[0];
  };
  const moduleOptions: QueueModuleOptions = {};

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
            createReceiver: jest.fn().mockResolvedValue(jest.fn()),
            createSender: jest.fn().mockResolvedValue(new EventContextMock().sender),
            disconnect: jest.fn().mockResolvedValue(jest.fn()),
            getModuleOptions(): QueueModuleOptions {
              return moduleOptions;
            },
          } as Partial<AMQPService>,
        },
      ],
    }).compile();
    queueService = module.get<QueueService>(QueueService);
    amqpService = module.get<AMQPService>(AMQPService);
  });

  it('should be defined', () => {
    expect(queueService).toBeDefined();
  });

  it('should listen to a queue', async () => {
    const spy = jest.spyOn(queueService, 'getReceiver' as any);

    await queueService.listen(defaultQueue, () => void 0, {});

    expect(spy).toBeCalled();
  });

  describe('receiver', () => {
    it('should create a receiver', async () => {
      await queueService.listen(defaultQueue, () => void 0, {});

      expect((queueService as any).receivers.size).toBe(1);
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
        expect(messageControl.reject).toHaveBeenCalledWith(expect.stringMatching(/Unexpected token/));
      });

      it('should not validate parsed body if explicitly specified', async () => {
        const callback = jest.fn();
        const body = { a: 1, b: 2 };
        await queueService.listen(defaultQueue, callback, { type: '', noValidate: true } as any);
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = JSON.stringify(body);

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(callback).toHaveBeenCalledWith(body, messageControl);
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
        moduleOptions.acceptValidationNullObjectException = true;
        await queueService.listen(defaultQueue, () => void 0, { type: TestDto });
        const messageHandler = getMessageHandler(amqpService);
        const eventContext = new EventContextMock();
        eventContext.message.body = 'null';

        await messageHandler(eventContext);

        const messageControl = getInternallyCreatedMessageControl();
        expect(messageControl.accept).toHaveBeenCalled();
        moduleOptions.acceptValidationNullObjectException = false;
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
      const sender = getSender(queueService, defaultQueue);

      expect(sender.send).toHaveBeenCalledWith({ body: 'null', message_annotations: { 'x-opt-delivery-cron': 'cron' } });
    });

    it('should set divide minutes', async () => {
      await queueService.send(defaultQueue, null, { schedule: { divideMinute: 100 } });
      const sender = getSender(queueService, defaultQueue);

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
      const sender = getSender(queueService, defaultQueue);

      expect(sender.send).toHaveBeenCalledWith({ body: 'null', message_annotations: { 'x-opt-delivery-delay': delay * 1000 } });
    });
  });

  it('should shutdown', async () => {
    (amqpService.createReceiver as jest.Mock).mockResolvedValue(new EventContextMock().receiver);
    await queueService.listen(defaultQueue, () => void 0, {});
    const receiver = getReceiver(queueService, defaultQueue);
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
    await (queueService as any).getSender('queueName');

    queueService.clearSenderAndReceiverLinks();

    expect((queueService as any).senders.size).toBe(0);
  });

  describe('getReceiver()', () => {
    it('should create receiver if not exists yet', async () => {
      await (queueService as any).getReceiver('queueName', 1, async () => {});

      expect((queueService as any).receivers.size).toBe(1);
    });

    it('should not create an existing receiver', async () => {
      await (queueService as any).getReceiver('queueName', 1, async () => {});
      await (queueService as any).getReceiver('queueName', 1, async () => {});

      expect((queueService as any).receivers.size).toBe(1);
    });
  });

  describe('getSender()', () => {
    it('should create sender if not exists yet', async () => {
      await (queueService as any).getSender('queueName');

      expect((queueService as any).senders.size).toBe(1);
    });

    it('should not create an existing sender', async () => {
      await (queueService as any).getSender('queueName');
      await (queueService as any).getSender('queueName');

      expect((queueService as any).senders.size).toBe(1);
    });
  });

  it('should encode message', () => {
    const obj = { name: 'Peter' };
    const result = (queueService as any).encodeMessage(obj);

    expect(result).toEqual(JSON.stringify(obj));
  });

  describe('decodeMessage()', () => {
    it('should decode Buffer', () => {
      const result = (queueService as any).decodeMessage(Buffer.from('{}'));

      expect(result).toEqual({});
    });

    it('should with the argument itself if it is an object', () => {
      const obj = { name: 'Peter' };
      const result = (queueService as any).decodeMessage(obj);

      expect(result).toBe(obj);
    });

    it('should decode not object but valid values', () => {
      const result = (queueService as any).decodeMessage('false');

      expect(result).toEqual(false);
    });

    it('should decode valid objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const result = (queueService as any).decodeMessage(JSON.stringify(obj));

      expect(result).toEqual(obj);
    });

    it('should throw error on invalid objects', () => {
      expect(() => {
        (queueService as any).decodeMessage('{null}');
      }).toThrowError(SyntaxError);
    });
  });
});
