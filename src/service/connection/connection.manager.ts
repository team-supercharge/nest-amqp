import { Injectable, LoggerService, Optional } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Connection } from 'rhea-promise';
import { AMQPConnectionOptions } from '../../interface';
import { AMQPService } from '../amqp/amqp.service';
import { ConnectionsRegistry } from './connections.registry';

export interface ConnectionRetryPolicy {
  maxAttempts?: number; // total attempts including the first
  baseDelayMs?: number; // initial delay before first retry
  maxDelayMs?: number;  // cap for exponential backoff
  jitter?: boolean;     // add random jitter to spread retries
}

@Injectable()
export class ConnectionManager {
  public readonly events = new EventEmitter();

  constructor(
    private readonly registry: ConnectionsRegistry,
    @Optional() private readonly logger?: LoggerService,
  ) {}

  public async connect(name: string, options: AMQPConnectionOptions, retry?: ConnectionRetryPolicy): Promise<Connection> {
    this.registry.setOptions(name, options);
    const policy: Required<ConnectionRetryPolicy> = {
      maxAttempts: retry?.maxAttempts ?? 3,
      baseDelayMs: retry?.baseDelayMs ?? 500,
      maxDelayMs: retry?.maxDelayMs ?? 5_000,
      jitter: retry?.jitter ?? true,
    };

    const attemptConnect = async (attempt: number): Promise<Connection> => {
      try {
        const conn = await AMQPService.createConnection(options, name);
        this.registry.setConnection(name, conn);
        this.logger?.log?.(`AMQP connection established: ${name}`);
        this.events.emit('connected', { name });
        return conn;
      } catch (err) {
        if (attempt >= policy.maxAttempts) {
          this.logger?.error?.(`AMQP connection failed after ${attempt} attempts: ${name}`);
          throw err;
        }
        const delay = this.computeDelay(policy.baseDelayMs, attempt, policy.maxDelayMs, policy.jitter);
        this.logger?.warn?.(`AMQP connection attempt ${attempt} failed for ${name}, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return attemptConnect(attempt + 1);
      }
    };

    return attemptConnect(1);
  }

  public getConnection(name: string): Connection | undefined {
    return this.registry.getConnection(name);
  }

  public getOptions(name: string): AMQPConnectionOptions | undefined {
    return this.registry.getOptions(name);
  }

  public async disconnect(name: string): Promise<void> {
    const connection = this.registry.getConnection(name);
    if (connection) {
      try {
        await connection.close();
      } catch {}
      this.registry.delete(name);
      this.logger?.log?.(`AMQP connection closed: ${name}`);
      this.events.emit('disconnected', { name });
    }
  }

  private computeDelay(base: number, attempt: number, cap: number, jitter: boolean): number {
    const exp = Math.min(cap, base * Math.pow(2, attempt - 1));
    if (!jitter) return exp;
    const rand = Math.random() * exp * 0.5; // up to 50% jitter
    return Math.floor(exp - rand);
  }
}
