import { SetMetadata } from '@nestjs/common';

import { ListenerMetadata } from '../domain';
import { QUEUE_LISTEN_METADATA_KEY } from '../explorer';
import { ListenOptions } from '../interface';

/**
 * Decorator to a queue's messages and handle they.
 *
 * ```ts
 * @Listen('test-queue', { type: TestDto })
 * public async listenForTestQueue(data: TestDto, control: MessageControl): Promise<void> {
 *    console.log('Message arrived on test-queue with data:', data);
 *    control.accept();
 *  }
 * ```
 *
 * @param {string} source The name of the queue which will listen to.
 * @param {object} [options] Options for the queue listening.
 * @publicApi
 */
export const Listen = <T>(source: string, options?: ListenOptions<T>) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const metadata = new ListenerMetadata<T>();

    metadata.source = source;
    metadata.options = options;

    metadata.targetName = target.constructor.name;

    metadata.callback = descriptor.value;
    metadata.callbackName = propertyKey;

    SetMetadata<string, ListenerMetadata<T>>(QUEUE_LISTEN_METADATA_KEY, metadata)(target, propertyKey, descriptor);
  };
};
