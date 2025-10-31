import { Injectable } from '@nestjs/common';
import { Connection } from 'rhea-promise';
import { AMQPConnectionOptions } from '../../interface';

@Injectable()
export class ConnectionsRegistry {
  private readonly connections = new Map<string, Connection>();
  private readonly options = new Map<string, AMQPConnectionOptions>();

  public setOptions(name: string, opts: AMQPConnectionOptions): void {
    if (this.options.has(name)) {
      throw new Error(`Connection options for '${name}' already registered. Call delete('${name}') first.`);
    }
    this.options.set(name, opts);
  }

  public getOptions(name: string): AMQPConnectionOptions | undefined {
    return this.options.get(name);
  }

  public setConnection(name: string, connection: Connection): void {
    if (this.connections.has(name)) {
      throw new Error(`Connection '${name}' already registered. Call delete('${name}') first.`);
    }
    this.connections.set(name, connection);
  }

  public getConnection(name: string): Connection | undefined {
    return this.connections.get(name);
  }

  public delete(name: string): void {
    this.connections.delete(name);
    this.options.delete(name);
  }
}
