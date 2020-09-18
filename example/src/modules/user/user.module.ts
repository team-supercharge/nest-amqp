import { Module } from '@nestjs/common';

import { UserController } from './user.controller';
import { UserListener } from './user.listener';

@Module({
  controllers: [UserController],
  providers: [UserListener],
})
export class UserModule {}
