import { Connection } from 'rhea-promise';

export class AMQConnectionStorage {
  /**
   * Add Connection to storage
   *
   * @param {string} name Name of the Connection, will be used as key
   * @param {Connection} connection The connection object
   */
  public static add(name: string, connection: Connection): void {
    this.storage.set(name, connection);
  }

  /**
   * Retreive stored Connection from storage
   *
   * @param {string} name Name of the connection
   *
   * @returns {Connection | null} The stored connection or null
   */
  public static get(name: string): Connection | null {
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
  public static getConnectionNames(): string[] {
    return Array.from(this.storage.keys());
  }

  private static readonly storage = new Map<string, Connection>();
}
