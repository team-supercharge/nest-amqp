import { LoggerService } from '@nestjs/common';

import { Logger } from './logger';
import { getLoggerContext } from './get-logger-context';

describe('Logger', () => {
  let logger: Logger;
  let loggerMock: LoggerService;

  beforeEach(() => {
    logger = new Logger(getLoggerContext('test'));
    loggerMock = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
    Logger.overrideLogger(loggerMock);
  });

  it('should log log messages', () => {
    logger.log('message', 'context');

    expect(loggerMock.log).toBeCalled();
  });

  it('should log warn messages', () => {
    logger.warn('message');

    expect(loggerMock.warn).toBeCalled();
  });

  it('should log error messages', () => {
    logger.error('message');

    expect(loggerMock.error).toBeCalled();
  });

  it('should log debug messages', () => {
    logger.debug('message');

    expect(loggerMock.debug).toBeCalled();
  });

  it('should log verbose messages', () => {
    logger.verbose('message');

    expect(loggerMock.verbose).toBeCalled();
  });

  it('should log without context', () => {
    logger = new Logger();

    expect((logger as any).context).toBe('');
  });
});
