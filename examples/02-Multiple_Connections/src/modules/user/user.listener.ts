import { Injectable, Logger } from '@nestjs/common';
import { Listen } from '@team-supercharge/nest-amqp';

import { UserQueue } from './user.queue';
import { UserDto } from './user.dto';
import { ConnectionName } from '../../constant';

@Injectable()
export class UserListener {
  @Listen(UserQueue.ADD_USER, { type: UserDto }, ConnectionName.A)
  public async listenOnAForAddUser(userData: UserDto): Promise<void> {
    logger.log(`add new user: ${JSON.stringify(userData)} on connection ${ConnectionName.A}`);
  }

  @Listen(UserQueue.ADD_USER, { type: UserDto }, ConnectionName.B)
  public async listenOnBForAddUser(userData: UserDto): Promise<void> {
    logger.log(`add new user: ${JSON.stringify(userData)} on connection ${ConnectionName.B}`);
  }
}
const logger = new Logger(UserListener.name);
