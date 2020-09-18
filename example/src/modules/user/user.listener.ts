import { Injectable, Logger } from '@nestjs/common';
import { Listen } from '@team-supercharge/nest-amqp';

import { UserQueue } from './user.queue';
import { UserDto } from './user.dto';

@Injectable()
export class UserListener {
  @Listen(UserQueue.ADD_USER, { type: UserDto })
  public async listenForAddUser(userData: UserDto): Promise<void> {
    logger.log(`add new user: ${JSON.stringify(userData)}`);
  }
}
const logger = new Logger(UserListener.name);
