import { EventContext } from 'rhea-promise';

import { MessageControl } from './message-control.domain';
import { Logger } from '../util';
import { LoggerMock } from '../test/logger.mock';

Logger.overrideLogger(new LoggerMock());

const mockEventContext = (): any => ({
  delivery: {
    accept: jest.fn(),
    release: jest.fn(),
    reject: jest.fn(),
  },
  receiver: {
    addCredit: jest.fn(),
  },
});

describe('MessageControl', () => {
  let messageControl: MessageControl;
  let eventContext: EventContext;

  beforeEach(() => {
    eventContext = mockEventContext();
    messageControl = new MessageControl(eventContext);
  });

  describe('accept the message control', () => {
    it('should accept an unhandled control', () => {
      messageControl.accept();

      expect(eventContext.delivery.accept).toHaveBeenCalled();
    });

    it('should do nothing on a handled control', () => {
      messageControl.accept();
      messageControl.accept();

      expect(eventContext.delivery.accept).toHaveBeenCalledTimes(1);
    });
  });

  describe('reject the message control', () => {
    it('should reject an unhandled control', () => {
      const reason = new Error('Reason');
      messageControl.reject(reason);

      expect(eventContext.delivery.reject).toHaveBeenCalled();
    });

    it('should do nothing on a handled control', () => {
      const reason = 'Reason';
      messageControl.reject(reason);
      messageControl.reject(reason);

      expect(eventContext.delivery.reject).toHaveBeenCalledTimes(1);
    });

    it('should return with unknown rejection reason', () => {
      const reason = { message: null } as any;
      reason.message = reason;
      messageControl.reject(reason);

      expect(eventContext.delivery.reject).toHaveBeenCalledWith(expect.objectContaining({ description: 'unknown' }));
    });
  });

  describe('release the message control', () => {
    it('should release an unhandled control', () => {
      messageControl.release();

      expect(eventContext.delivery.release).toHaveBeenCalled();
    });

    it('should do nothing on a handled control', () => {
      messageControl.release();
      messageControl.release();

      expect(eventContext.delivery.release).toHaveBeenCalledTimes(1);
    });
  });

  it('should say that the control is handled or not', () => {
    expect(messageControl.isHandled()).toBe(false);
    messageControl.accept();
    expect(messageControl.isHandled()).toBe(true);
  });
});
