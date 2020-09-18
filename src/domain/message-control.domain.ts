import { AmqpError, EventContext } from 'rhea-promise';

import { Logger } from '../util';

/**
 * Class to handle easily the state of a message transfer and status.
 *
 * @publicApi
 */
export class MessageControl {
  /**
   * If the message has already been processed once, do not process it again.
   */
  private handled = false;

  constructor(private readonly context: EventContext) {}

  /**
   * Use `accept` when message has been handled normally.
   *
   * NOTE: When no explicit `accept` / `reject` / `release` call has been made
   * in the callback, message will be automatically accepted.
   */
  public accept(): void {
    if (this.handled) {
      logger.error('message already handled');

      return;
    }

    logger.trace('accepting message');

    this.context.delivery.accept();
    this.handleSettlement();
  }

  /**
   * Use `reject` when message was unprocessable. It contained either malformed
   * or semantically incorrect data. In other words it can't be successfully
   * processed in the future without modifications.
   *
   * NOTE: With ActiveMQ `reject` will result in the same retry cycle as the
   * `release` settlement due to technical limitations. Regardless, please
   * always use the appropriate settlement.
   *
   * @param {string|object} reason reason to reject message
   */
  public reject(reason: string | Record<string, any>): void {
    if (this.handled) {
      logger.error('message already handled');

      return;
    }

    logger.trace('rejecting message with reason', reason);

    // condition and description will not be displayed anywhere
    const error: AmqpError = {
      condition: 'amqp:precondition-failed',
      description: this.getRejectReason(reason),
    };

    this.context.delivery.reject(error);
    this.handleSettlement();
  }

  /**
   * Use release when a temporary problem happened during message handling, e.g.
   * could not save record to DB, 3rd party service errored, etc. The message is
   * not malformed and theoretically can be processed at a later time without
   * modifications.
   *
   * NOTE: with ActiveMQ `release` will result in the same retry cycle as the
   * `reject` settlement due to technical limitations. Regardless, please
   * always use the appropriate settlement.
   */
  public release(): void {
    if (this.handled) {
      logger.error('message already handled');

      return;
    }

    logger.trace('releasing message');

    // NOTE: need to be handled this way to trigger retry logic
    this.context.delivery.release({
      undeliverable_here: true,
      delivery_failed: false,
    });
    this.handleSettlement();
  }

  /**
   * Tells you whether the message has already been processed or not.
   *
   * @return {boolean} The message has already been processed or not
   */
  public isHandled(): boolean {
    return this.handled;
  }

  private handleSettlement() {
    // need to add a credit after successful handling
    this.context.receiver.addCredit(1);

    // set as already handled
    this.handled = true;
  }

  private getRejectReason(reason: string | Record<string, any>): string {
    try {
      return typeof reason !== 'string' ? JSON.stringify(reason) : reason;
    } catch (error) {
      logger.error('could not parse error reason', reason);

      return 'unknown';
    }
  }
}
const logger = new Logger(MessageControl.name);
