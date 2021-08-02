import { SetMetadata } from '@nestjs/common';
import { QUEUE_LISTEN_METADATA_KEY } from '../constant';

import { ListenerMetadata } from '../domain';
import { ListenOptions } from '../interface';

/**
 * Decorator for adding handler to a queue's messages
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
 * @public
 */
export const Listen = <T>(source: string, options?: ListenOptions<T>) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const metadata = new ListenerMetadata<T>();

    metadata.source = source;
    metadata.options = options;

    metadata.targetName = target.constructor.name;
    metadata.target = target.constructor;

    metadata.callback = descriptor.value;
    metadata.callbackName = propertyKey;

    SetMetadata<string, ListenerMetadata<T>>(QUEUE_LISTEN_METADATA_KEY, metadata)(target, propertyKey, descriptor);
  };
};
