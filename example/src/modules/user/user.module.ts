import { Module } from '@nestjs/common';
import { QueueModule } from '@team-supercharge/nest-amqp';

import { UserController } from './user.controller';
import { UserListener } from './user.listener';

@Module({
  controllers: [UserController],
  providers: [UserListener],
  imports: [QueueModule.forFeature()],
})
export class UserModule {}
