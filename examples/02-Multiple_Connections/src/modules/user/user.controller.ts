import { Body, Controller, Post } from '@nestjs/common';
import { QueueService } from '@team-supercharge/nest-amqp';

import { UserQueue } from './user.queue';
import { UserDto } from './user.dto';
import { ConnectionName } from '../../constant';

@Controller('user')
export class UserController {
  constructor(private readonly queueService: QueueService) {}

  @Post('connection-a')
  public async sendAddUserMessageOnA(@Body() body: UserDto): Promise<string> {
    await this.queueService.send<UserDto>(UserQueue.ADD_USER, body, ConnectionName.A);

    return 'Add user event sent';
  }

  @Post('connection-b')
  public async sendAddUserMessageOnB(@Body() body: UserDto): Promise<string> {
    await this.queueService.send<UserDto>(UserQueue.ADD_USER, body, ConnectionName.B);

    return 'Add user event sent';
  }
}
