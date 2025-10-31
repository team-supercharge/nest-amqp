import { Module } from '@nestjs/common';
import { QueueModule, ListenerModule } from '@team-supercharge/nest-amqp';

import { AppController } from './app.controller';
import { UserModule } from '../modules/user/user.module';

@Module({
  imports: [
    QueueModule.register({ name: 'default', connectionUri: 'amqp://artemis:secret@localhost:5672' }),
    ListenerModule,
    UserModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
