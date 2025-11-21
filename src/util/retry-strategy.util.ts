import { getLoggerContext, Logger, sleep } from './index';

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  retryDelay?: number;
  maxRetryAttempts?: number;
}

/**
 * Generic retry strategy for handling transient failures.
 * Encapsulates the common retry-with-backoff pattern.
 *
 * @public
 */
export class RetryStrategy {
  private static readonly logger = new Logger(getLoggerContext(RetryStrategy.name));

  /**
   * Execute an async operation with retry logic.
   *
   * @param operation The async function to retry
   * @param config Retry configuration (delay and max attempts)
   * @param operationName Name for logging purposes
   * @returns Result of the operation
   * @throws Error if all retry attempts fail
   */
  public static async execute<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {},
    operationName: string = 'operation',
  ): Promise<T> {
    const retryDelay = config.retryDelay ?? 0;
    const maxRetryAttempts = config.maxRetryAttempts ?? 1;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < maxRetryAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.error(
          `Error executing ${operationName} (attempt ${attempt + 1}/${maxRetryAttempts}): ${lastError.message}`,
          lastError.stack,
        );

        attempt++;

        if (attempt >= maxRetryAttempts) {
          break;
        }

        if (retryDelay > 0) {
          await sleep(retryDelay);
        }
      }
    }

    throw new Error(
      `Max retry attempts (${maxRetryAttempts}) reached for ${operationName}: ${lastError?.message}`,
    );
  }
}
