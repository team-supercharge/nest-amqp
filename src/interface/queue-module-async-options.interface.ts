import { Abstract, ModuleMetadata, Type } from '@nestjs/common';

import { QueueModuleOptions } from './index';

export interface QueueModuleOptionsFactory {
  createQueueModuleOptions(): Promise<QueueModuleOptions> | QueueModuleOptions;
}

export interface QueueModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Marks Module as Global module in NestJS
   */
  isGlobal?: boolean;

  /**
   * Create Provider with factory function
   *
   * Will be tried 1st
   */
  useFactory?: (...args: any[]) => Promise<QueueModuleOptions> | QueueModuleOptions;

  /**
   * List of Providers to inject into the Factory function
   */
  inject?: (string | symbol | ((...args: unknown[]) => unknown | Promise<unknown>) | Type<any> | Abstract<any>)[];

  /**
   * Create Provider by instantiating the correct service class
   *
   * Will be tried 2nd
   */
  useClass?: Type<QueueModuleOptionsFactory>;

  /**
   * Create alias for existing Provider
   *
   * Will be tried last
   */
  useExisting?: Type<QueueModuleOptionsFactory>;
}
