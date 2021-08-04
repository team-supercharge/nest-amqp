import { AMQPConnectionOptions } from '../../interface';

export class AMQConnectionOptionsStorage {
  /**
   * Add Queue Module Options to storage for connection
   *
   * @param {string} name Name of the connection, will be used as key
   * @param {Options} options The options object
   */
  public static add(name: string, options: AMQPConnectionOptions): void {
    this.storage.set(name, options);
  }

  /**
   * Retreive stored from storage for connection
   *
   * @param {string} name Name of the connection
   *
   * @returns {Options | null} The stored connection or null
   */
  public static get(name: string): AMQPConnectionOptions | null {
    if (!name) {
      return null;
    }

    return this.storage.get(name) || null;
  }

  /**
   * Get all connection keys
   *
   * @returns {string[]}
   */
  public static getKeys(): string[] {
    return Array.from(this.storage.keys());
  }

  private static readonly storage = new Map<string, AMQPConnectionOptions>();
}
