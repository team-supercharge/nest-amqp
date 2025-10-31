import { Module } from '@nestjs/common';
import { QueueModule, ListenerModule } from '@team-supercharge/nest-amqp';

import { AppController } from './app.controller';
import { UserModule } from '../modules/user/user.module';

import { ConnectionName, CONNECTION_A_URI, CONNECTION_B_URI } from '../constant';

@Module({
  imports: [
    QueueModule.register({ name: ConnectionName.A, connectionUri: CONNECTION_A_URI }),
    QueueModule.register({ name: ConnectionName.B, connectionUri: CONNECTION_B_URI }),
    ListenerModule,
    UserModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
