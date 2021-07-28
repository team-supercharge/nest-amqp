import { ModuleMetadata, Type } from '@nestjs/common';

import { QueueModuleOptions } from './index';

export interface QueueModuleOptionsFactory {
  createQueueModuleOptions(): Promise<QueueModuleOptions> | QueueModuleOptions;
}

export interface QueueModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  isGlobal?: boolean;
  useExisting?: Type<QueueModuleOptionsFactory>;
  useClass?: Type<QueueModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<QueueModuleOptions> | QueueModuleOptions;
  inject?: any[];
}
