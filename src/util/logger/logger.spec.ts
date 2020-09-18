import { Logger } from './logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  it('should log info messages', () => {
    (Logger as any).logInfo = jest.fn();

    logger.info('message');

    expect((Logger as any).logInfo).toBeCalled();
  });

  it('should log warn messages', () => {
    (Logger as any).logWarn = jest.fn();

    logger.warn('message');

    expect((Logger as any).logWarn).toBeCalled();
  });

  it('should log error messages', () => {
    (Logger as any).logError = jest.fn();

    logger.error('message');

    expect((Logger as any).logError).toBeCalled();
  });

  it('should log debug messages', () => {
    (Logger as any).logDebug = jest.fn();

    logger.debug('message');

    expect((Logger as any).logDebug).toBeCalled();
  });

  it('should log trace messages', () => {
    (Logger as any).logTrace = jest.fn();

    logger.trace('message');

    expect((Logger as any).logTrace).toBeCalled();
  });
});
