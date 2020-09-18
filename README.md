# Nest AMQP 1.0 Module

[![Build Status](https://api.travis-ci.org/team-supercharge/nest-amqp.svg?branch=master)](https://travis-ci.org/github/team-supercharge/nest-amqp)
[![Coverage Status](https://codecov.io/github/team-supercharge/nest-amqp/coverage.svg?branch=master)](https://codecov.io/github/team-supercharge/nest-amqp)
<a href="https://www.npmjs.com/@team-supercharge/nest-amqp" target="_blank"><img src="https://img.shields.io/npm/v/@team-supercharge/nest-amqp.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/@team-supercharge/nest-amqp" target="_blank"><img src="https://img.shields.io/npm/l/@team-supercharge/nest-amqp.svg" alt="Package License" /></a>

## Description

AMQP 1.0 module for [Nest](https://github.com/nestjs/nest). It is based on the 
[rhea-promise](https://www.npmjs.com/package/rhea-promise) package.

## Installation

```bash
$ npm install --save @team-supercharge/nest-amqp
```

## Usage

First you have to import the Queue module into the app module. The `QueueModule.forRoot()` method's first parameter 
is the connection URI for the message broker server:

> Note: the `QueueModule.forRoot()` can be added only to the application's root module and only once because multiple
> message broker connections are not supported!

```javascript
import { QueueModule } from '@team-supercharge/nest-amqp';
// ...

@Module({
  imports: [
    QueueModule.forRoot('amqp://user:password@localhost:5672'),
    // ...
  ],
})
export class AppModule {} 
```

Then create a `user.module.ts` feature module what will give all the functionality which belongs to the users:

```javascript
import { Module } from '@nestjs/common';

@Module({
  controllers: [],
  providers: [],
})
export class UserModule {}
```

Import this `UserModule` in the `AppModule`.

After that create `user.dto.ts` file and add a data transfer object (DTO) class to it, which will be sent as
body in the queue message. The [class-transformer](https://www.npmjs.com/package/class-transformer) package 
is used to remove or not touch the object properties before send it to the queue and the
[class-validator](https://www.npmjs.com/package/class-validator) package is used to validate the received object
on the consumer side:

```javascript
import { Expose } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';

@Expose()
export class AddUserDto {
  @IsString()
  public readonly name: string;

  @IsInt()
  public readonly age: number;

  constructor(userData: AddUserDto) {
    Object.assign(this, userData);
  }
}
```

After that create the `user.listener.ts` file and add  a new listener class to it which has a method 
with the `@Listen()` decorator to listen the specified queue's messages:

```javascript
import { Injectable } from '@nestjs/common';
import { Listen, MessageControl } from '@team-supercharge/nest-amqp';

import { AddUserDto } from './user.dto';

@Injectable()
export class UserListener {
  @Listen('addUser', { type: AddUserDto })
  public async listenForQueueNameMessages(data: AddUserDto, control: MessageControl): Promise<void> {
    console.log('new message arrived on the "addUser" queue:', data);
    control.accept();
  }
}
```

Then we create a `user.controller.ts` file and add a HTTP endpoint which will send the message 
to the queue with the payload what it gets as HTTP body:

```javascript
import { Body, Controller, Post } from '@nestjs/common';
import { QueueService } from '@team-supercharge/nest-amqp';

import { AddUserDto } from './user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  public async sendAddUserMessage(@Body() body: AddUserDto): Promise<string> {
    await this.queueService.send<AddUserDto>('addUser', body);

    return 'Add user message sent';
  }
}
```

We can see that the `send()` method is responsible to add message to the given queue. 

And the last thing is to add this controller to the corresponding module:

```javascript
import { UserController } from './user.controller';
import { UserListener } from './user.listener';
// ...

@Module({
  controllers: [UserController],
  providers: [UserListener],
})
export class UserModule {}
```

Finally start the app with `npm run start` and it will listen on http://localhost:4444 URL. You can test the
functionality with sample HTTP requests which are in the `example/http-requests/add-user.http` file.

## Message control

When a new message arrives on a queue, the transformed and validated message body and the message control. The latter object is 
to control the message transfer. It is possible to accept, reject or release the transfer. Here are the examples:

```javascript
// accept the message
control.accept();

// reject the message
control.reject('processing failed');

// release the message
control.release();
```

Use `accept` when message has been handled normally. It will remove the message from the queue.
Use `reject` when message was unprocessable. It contained either malformed or semantically incorrect data. In other words 
it can't be successfully processed in the future without modifications. It will remove the message from the queue.
Use `release` when a temporary problem happened during message handling, e.g. could not save record to DB, 3rd party service 
errored, etc. The message is not malformed and theoretically can be processed at a later time without modifications. The 
message will not be removed but will be processed by another consumer.

## License

@team-supercharge/nest-amqp is [MIT licensed](LICENSE).
