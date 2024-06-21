import { Injectable } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { isDefined } from 'class-validator';

import { QUEUE_LISTEN_METADATA_KEY } from '../constant';
import { ListenerMetadata } from '../domain';

/**
 * Iterates through the @Listen() decorators and creates the necessary queues
 * based on the decorator options.
 *
 * @public
 */
@Injectable()
export class ListenerExplorer {
  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly metadataScanner: MetadataScanner,
  ) {}

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

    // transform the instance wrappers into a nice format
    // InstanceWrapper.instance from @nestjs/core/injector/instance-wrapper
    const instanceWrappers: Array<{ instance: unknown }> = [];
    providersMap.forEach(map => {
      instanceWrappers.push(...map.values());
    });

    // find the handlers marked with @Listen
    return instanceWrappers
      .filter(({ instance }) => !!instance)
      .map(({ instance }) => {
        const instancePrototype = Object.getPrototypeOf(instance);

        return this.metadataScanner
          .getAllMethodNames(instancePrototype)
          .map(method => this.exploreMethodMetadata<T>(instancePrototype, method))
          .filter(isDefined);
      })
      .reduce((prev, curr) => {
        return prev.concat(curr);
      });
  }

  private exploreMethodMetadata<T>(instancePrototype: Record<string, unknown>, methodKey: string): ListenerMetadata<T> | null {
    const targetCallback = instancePrototype[methodKey];
    const handler = Reflect.getMetadata(QUEUE_LISTEN_METADATA_KEY, targetCallback);

    return handler ?? null;
  }
}
