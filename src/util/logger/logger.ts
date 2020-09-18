import debug from 'debug';

export class Logger {
  private static logInfo: debug.Debugger = debug('nest-amqp:info');
  private static logWarn: debug.Debugger = debug('nest-amqp:warn');
  private static logError: debug.Debugger = debug('nest-amqp:error');
  private static logDebug: debug.Debugger = debug('nest-amqp:debug');
  private static logTrace: debug.Debugger = debug('nest-amqp:trace');

  constructor(namespace = '') {}

  public info(...args: any[]): void {
    Logger.logInfo.apply(Logger.logInfo, args as any);
  }

  public warn(...args: any[]): void {
    Logger.logWarn.apply(Logger.logWarn, args as any);
  }

  public error(...args: any[]): void {
    Logger.logError.apply(Logger.logError, args as any);
  }

  public debug(...args: any[]): void {
    Logger.logDebug.apply(Logger.logDebug, args as any);
  }

  public trace(...args: any[]) {
    Logger.logTrace.apply(Logger.logTrace, args as any);
  }
}
