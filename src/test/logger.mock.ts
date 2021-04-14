import { LoggerService } from '@nestjs/common';

/* istanbul ignore file */
/* eslint-disable @typescript-eslint/no-unused-vars */

export class LoggerMock implements LoggerService {
  public log(message: any, context?: string): void {}
  public error(message: any, trace?: string, context?: string): void {}
  public warn(message: any, context?: string): void {}
  public debug(message: any, context?: string): void {}
  public verbose(message: any, context?: string): void {}
}
