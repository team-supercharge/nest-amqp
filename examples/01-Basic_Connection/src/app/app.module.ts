import { Module } from '@nestjs/common';
import { QueueModule } from '@team-supercharge/nest-amqp';

import { AppController } from './app.controller';
import { UserModule } from '../modules/user/user.module';

@Module({
  imports: [QueueModule.forRoot('amqp://artemis:secret@localhost:5672'), UserModule],
  controllers: [AppController],
})
export class AppModule {}
