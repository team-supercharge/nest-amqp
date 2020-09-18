import { Injectable } from '@nestjs/common';
import { Injectable as InjectableInterface } from '@nestjs/common/interfaces';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

import { ListenerMetadata } from '../domain';

export const QUEUE_LISTEN_METADATA_KEY = 'queue-listener';

/**
 * Iterates through the @Listen() decorators and creates the necessary queues
 * based on the decorator options.
 *
 * @publicApi
 */
@Injectable()
export class ListenerExplorer {
  constructor(private readonly modulesContainer: ModulesContainer, private readonly metadataScanner: MetadataScanner) {}

  /**
   * Traverse all providers and collect listener options which has method or
   * methods with @Listen() decorator.
   *
   * @return {ListenerMetadata<T>[]} Listener metadata list.
   */
  public explore<T = any>(): Array<ListenerMetadata<T>> {
    // find all the providers
    const modules = [...this.modulesContainer.values()];
    const providersMap = modules.filter(({ providers }) => providers.size > 0).map(({ providers }) => providers);

    // munge the instance wrappers into a nice format
    const instanceWrappers: Array<InstanceWrapper<InjectableInterface>> = [];
    providersMap.forEach(map => {
      const mapKeys = [...map.keys()];
      instanceWrappers.push(
        ...mapKeys.map(key => {
          return map.get(key);
        }),
      );
    });

    // find the handlers marked with @Listen
    return instanceWrappers
      .filter(({ instance }) => {
        return instance && instance !== null;
      })
      .map(({ instance }) => {
        const instancePrototype = Object.getPrototypeOf(instance);

        return this.metadataScanner.scanFromPrototype(instance, instancePrototype, method =>
          this.exploreMethodMetadata<T>(instance, instancePrototype, method),
        );
      })
      .reduce((prev, curr) => {
        return prev.concat(curr);
      });
  }

  private exploreMethodMetadata<T>(_: unknown, instancePrototype: Record<string, unknown>, methodKey: string): ListenerMetadata<T> | null {
    const targetCallback = instancePrototype[methodKey];
    const handler = Reflect.getMetadata('queue-listener', targetCallback);

    if (!handler) {
      return null;
    }

    return handler;
  }
}
