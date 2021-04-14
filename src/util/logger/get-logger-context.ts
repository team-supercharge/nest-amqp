const loggerContextPrefix = 'NestAMQP';

export function getLoggerContext(context: string): string {
  return `${context}@${loggerContextPrefix}`;
}
