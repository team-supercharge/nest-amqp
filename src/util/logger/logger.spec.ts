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

    expect(loggerMock.log).toHaveBeenCalled();
  });

  it('should log warn messages', () => {
    logger.warn('message');

    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    logger.error('message');

    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('should log debug messages', () => {
    logger.debug('message');

    expect(loggerMock.debug).toHaveBeenCalled();
  });

  it('should log verbose messages', () => {
    logger.verbose('message');

    expect(loggerMock.verbose).toHaveBeenCalled();
  });

  it('should log without context', () => {
    logger = new Logger();

    expect((logger as any).context).toBe('');
  });
});
