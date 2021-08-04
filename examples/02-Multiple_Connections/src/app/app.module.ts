import { Module } from '@nestjs/common';
import { QueueModule } from '@team-supercharge/nest-amqp';

import { AppController } from './app.controller';
import { UserModule } from '../modules/user/user.module';

import { ConnectionName, CONNECTION_A_URI, CONNECTION_B_URI } from '../constant';

@Module({
  imports: [
    QueueModule.forRoot(
      [
        { connectionUri: CONNECTION_A_URI, name: ConnectionName.A },
        { connectionUri: CONNECTION_B_URI, name: ConnectionName.B },
      ],
      {},
    ),
    UserModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
