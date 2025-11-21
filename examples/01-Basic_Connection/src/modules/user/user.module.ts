import { Module } from '@nestjs/common';
import { ListenerModule } from '@team-supercharge/nest-amqp';

import { UserController } from './user.controller';
import { UserListener } from './user.listener';

@Module({
  controllers: [UserController],
  providers: [UserListener],
  imports: [ListenerModule],
})
export class UserModule {}
