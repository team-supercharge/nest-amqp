import { Source } from 'rhea-promise';
import { ListenOptions } from '../interface';

/* eslint-disable @typescript-eslint/ban-types */

/**
 * Metadata added by the `@Listener` decorator
 */
export class ListenerMetadata<T> {
  /**
   * The method that should be executed once the message is transformed (and validated if needed)
   */
  public readonly callback: Function;

  /**
   * Name of the method
   */
  public readonly callbackName: string;

  /**
   * Name of the queue the handler will handle
   */
  public readonly source: string | Source;

  /**
   * ListenOptions provided to the `@Listener` decorator
   */
  public readonly options: ListenOptions<T>;

  /**
   * The name of Class the method belongs to
   */
  public readonly targetName: string;

  /**
   * The Class the method belongs to
   */
  public readonly target: object;

  /**
   * Connection the listener should be using
   */
  public readonly connection: string;

  // istanbul ignore next
  constructor(metadata: ListenerMetadata<T>) {
    this.connection = metadata?.connection;
    this.source = metadata?.source;
    this.options = metadata?.options;

    this.callback = metadata?.callback;
    this.callbackName = metadata?.callbackName;

    this.targetName = metadata?.targetName;
    this.target = metadata?.target;
  }
}
