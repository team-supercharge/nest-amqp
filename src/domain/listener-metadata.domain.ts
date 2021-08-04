import { ListenOptions } from '../interface';

/* eslint-disable @typescript-eslint/ban-types */

/**
 * Metadata added by the `@Listener` decorator
 */
export class ListenerMetadata<T> {
  /**
   * The method that should be executed once the message is transformed (and validated if needed)
   */
  public callback: any;

  /**
   * Name of the method
   */
  public callbackName: string;

  /**
   * Name of the queue the handler will handle
   */
  public source: string;

  /**
   * ListenOptions provided to the `@Listener` decorator
   */
  public options: ListenOptions<T>;

  /**
   * The name of Class the method belongs to
   */
  public targetName: string;

  /**
   * The Class the method belongs to
   */
  public target: object;

  /**
   * Connection the listener should be using
   */
  public connection: string;
}
