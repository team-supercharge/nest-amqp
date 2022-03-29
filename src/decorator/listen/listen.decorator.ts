import { SetMetadata } from '@nestjs/common';
import { Source } from 'rhea-promise';
import { AMQP_DEFAULT_CONNECTION_TOKEN, QUEUE_LISTEN_METADATA_KEY } from '../../constant';

import { ListenerMetadata } from '../../domain';
import { ListenOptions } from '../../interface';

interface ListenOverload {
  (source: string | Source, connection?: string): MethodDecorator;
  <T>(source: string | Source, options: ListenOptions<T>, connection?: string): MethodDecorator;
}

/**
 * Decorator for adding handler to a queue's messages
 *
 * ```ts
 * @Listen<TestDto>('test-queue', { type: TestDto })
 * public async listenForTestQueue(data: TestDto, control: MessageControl): Promise<void> {
 *    console.log('Message arrived on test-queue with data:', data);
 *    control.accept();
 *  }
 * ```
 *
 * @param {string} source The name of the queue which will listen to.
 * @param {ListenOptions<T>} [optionsOrConnection={}] Options for the queue listening.
 * @param {} [connectionName] Name of the connection the queue belongs.
 *
 * @public
 */
export const Listen: ListenOverload = <T>(
  source: string | Source,
  optionsOrConnection?: ListenOptions<T> | string,
  connectionName?: string,
): MethodDecorator => {
  return (target: Record<string, any>, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const connection = connectionName ?? (typeof optionsOrConnection === 'string' ? optionsOrConnection : AMQP_DEFAULT_CONNECTION_TOKEN);
    const options = typeof optionsOrConnection === 'object' ? optionsOrConnection : {};

    const metadata = new ListenerMetadata<T>({
      source,
      options,
      connection,
      targetName: target.constructor.name,
      target: target.constructor,
      callback: descriptor.value,
      callbackName: typeof propertyKey === 'string' ? propertyKey : propertyKey.toString(),
    });

    SetMetadata<string, ListenerMetadata<T>>(QUEUE_LISTEN_METADATA_KEY, metadata)(target, propertyKey, descriptor);
  };
};
