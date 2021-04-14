import { Logger as NestLogger, LoggerService } from '@nestjs/common';

export class Logger implements LoggerService {
  private static instance: LoggerService = new NestLogger();

  constructor(private readonly context = '') {}

  public static overrideLogger(logger: LoggerService) {
    Logger.instance = logger;
  }

  public log(message: any, context?: string): void {
    Logger.instance.log(message, context || this.context);
  }

  public error(message: any, trace?: string, context?: string): void {
    Logger.instance.error(message, trace, context || this.context);
  }

  public warn(message: any, context?: string): void {
    Logger.instance.warn(message, context || this.context);
  }

  public debug(message: any, context?: string): void {
    Logger.instance.debug(message, context || this.context);
  }

  public verbose(message: any, context?: string): void {
    Logger.instance.verbose(message, context || this.context);
  }
}
