import { Module } from '@nestjs/common';

import { ObjectValidator } from './object-validator';

@Module({
  exports: [ObjectValidator],
  providers: [ObjectValidator],
})
export class UtilModule {}
