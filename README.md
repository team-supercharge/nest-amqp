# Nest AMQP

[![Build Status](https://github.com/team-supercharge/nest-amqp/actions/workflows/main-branch.yml/badge.svg)](https://github.com/team-supercharge/nest-amqp/actions/workflows/main-branch.yml)
<a href="https://www.npmjs.com/@team-supercharge/nest-amqp" target="_blank"><img src="https://img.shields.io/npm/v/@team-supercharge/nest-amqp.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/@team-supercharge/nest-amqp" target="_blank"><img src="https://img.shields.io/npm/l/@team-supercharge/nest-amqp.svg" alt="Package License" /></a>

## Description

AMQP 1.0 module for [Nest](https://github.com/nestjs/nest). It is based on the
[rhea-promise](https://www.npmjs.com/package/rhea-promise) package. This package is for
working with a message broker with extra data validation functionality. It uses the
[class-transformer](https://www.npmjs.com/package/class-transformer) and
[class-validator](https://www.npmjs.com/package/class-validator) packages to transform
and validate the payload of the messages. With this we can easily verify the message's
payload structure and its data types with Data Transfer Objects. Besides, it gives
control over the message how to handle it: accept, reject or release.

## Installation

```bash
$ npm install --save @team-supercharge/nest-amqp
```

To use the library, the peer dependencies must also be installed:
```bash
$ npm install --save class-transformer class-validator
```

## 4.x - What changed

This major release targets NestJS v10 and Node 20+, simplifies configuration and improves testability.

- One-connection-per-module: import `QueueModule.register({ name, connectionUri })` once per connection
- Optional `ListenerModule` to enable `@Listen()` scanning (kept as sugar)
- Per-connection `QueueClient` tokens via `getQueueClientToken(name)` for explicit usage
- Testing utilities: in-memory broker and `createTestingQueue`

Quick start:
```ts
import { Module, Inject } from '@nestjs/common';
import { QueueModule, ListenerModule, getQueueClientToken, QueueClient } from '@team-supercharge/nest-amqp';

@Module({
  imports: [
    QueueModule.register({ name: 'default', connectionUri: 'amqp://user:pass@localhost:5672' }),
    ListenerModule,
  ],
})
export class AppModule {}

export class Producer {
  constructor(@Inject(getQueueClientToken('default')) private readonly queue: QueueClient) {}
  async run() { await this.queue.send('queue-name', { hello: 'world' }); }
}
```

## Usage (4.x)

### Enable one or more connections

```ts
import { Module } from '@nestjs/common';
import { QueueModule, ListenerModule } from '@team-supercharge/nest-amqp';

@Module({
  imports: [
    QueueModule.register({ name: 'default', connectionUri: 'amqp://user:pass@localhost:5672' }),
    ListenerModule,
  ],
})
export class AppModule {}
```

### Inject a per-connection client and send

```ts
import { Inject, Injectable } from '@nestjs/common';
import { getQueueClientToken, QueueClient } from '@team-supercharge/nest-amqp';

@Injectable()
export class ProducerService {
  constructor(@Inject(getQueueClientToken('default')) private readonly queue: QueueClient) {}

  async send(): Promise<void> {
    await this.queue.send('queue-name', { hello: 'world' });
  }
}
```

### Using ListenerModule and @Listen()

```ts
import { Injectable } from '@nestjs/common';
import { Listen } from '@team-supercharge/nest-amqp';

@Injectable()
export class ExampleListener {
  @Listen('queue-name', { /* type, skipValidation, etc. */ })
  async onMessage(payload: any): Promise<void> {
    // handle message
  }
}
```

### Programmatic listeners (no decorators)

```ts
import { Inject, OnModuleInit } from '@nestjs/common';
import { getQueueClientToken, QueueClient } from '@team-supercharge/nest-amqp';

export class Bootstrap implements OnModuleInit {
  constructor(@Inject(getQueueClientToken('default')) private readonly queue: QueueClient) {}

  async onModuleInit(): Promise<void> {
    await this.queue.listen('queue-name', async (payload) => {
      // handle message
    });
  }
}
```

## Migration guide (3.x -> 4.x)

- Replace `QueueModule.forRoot(...)`/`forRootAsync(...)` with `QueueModule.register({ name, connectionUri, ... })`/`registerAsync({ name, ... })`.
- Replace `QueueModule.forFeature()` with importing `ListenerModule` to enable `@Listen()` scanning; or use programmatic `QueueClient.listen(...)`.
- Replace `QueueService` injection for sending/listening with per-connection `QueueClient` via `@Inject(getQueueClientToken(name))`.
- Remove any reliance on static storages; connections are managed internally and per-connection clients encapsulate usage.
- Config interfaces were flattened; use `QueueModuleOptions` directly without inheritance.

---

## v3.x setup documentation

For v3.x setup and configuration, please see the latest v3 README: https://github.com/team-supercharge/nest-amqp/blob/v3.6.4/README.md

## Core usage (applies to v3 and v4)

The following sections describe sending, listening, message control, and validation. These concepts are unchanged between v3 and v4; only the setup differs.

### Send a message

#### Single connection
You can send messages with the `QueueService`. First you have to inject the service instance in the constructor, then you can use it to
send a message. Here is an example:

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '@team-supercharge/nest-amqp';

@Injectable()
export class TestService {
  constructor(private readonly queueService: QueueService) {}

  public async sendMessage(): Promise<void> {
    const payload = { text: 'hello world', date: new Date() };
    await this.queueService.send<TestDto>('example', payload);
  }
}
```

In the example we send a message to the `example` queue with an object payload. The `QueueService` will stringify the object and send the
message with the stringified object as payload. You can add a DTO class as generic type to the `send<T>()` method and TypeScript will
check that the second argument is matches with the DTO class.

> Note: the `send<T>()` method won't validate and transform the payload, it only stringifies the payload to a string value and send objects
> as string payload.

The `send<T>()` method's third parameter is the options which is an optional object. You can set here the
[rhea connection options](https://github.com/amqp/rhea/blob/2cbe55795b86a43375111f2f446089f55b948ecf/typings/connection.d.ts#L525)
as well. Other custom available options:
* **schedule.divideMinute**?: Send the message multiple times a minute given by this number.
* **schedule.cron**?: Send the message multiple times given by this standard cron string.
* **schedule.afterSeconds**?: Message sending delay in seconds.

#### Multiple connections

Sending messages with multiple connections works mostly the same, the only difference is that we need to define to which connection do we want to send the message. Here is an example:

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '@team-supercharge/nest-amqp';

import { Connections } from './constants';

@Injectable()
export class TestService {
  constructor(private readonly queueService: QueueService) {}

  public async sendMessage(): Promise<void> {
    const payload = { text: 'hello world', date: new Date() };

    await this.queueService.send<TestDto>('example', payload, Connections.TEST);
  }

  public async sendDelayedMessage(): Promise<void> {
    const payload = { text: 'hello world', date: new Date() };
    const sendOptions = { schedule: { afterSeconds: 10 } };

    await this.queueService.send<TestDto>('example', payload, sendOptions, Connections.TEST);
  }
}
```

> Note: It is assumed that there is an enum named `Connections`, and
the connections defined in the `forRoot` method contains a connection named `Connections.TEST`.

> Note: If you leave out the name of the connection, it will be sent a to the default connection (if exists).

### Listen to a queue

#### Single connection

If you want to receive the messages which arrive at a queue then you have to listen on the specific queue. You can do this with the
`@Listen()` decorator which you can add to a method of a class which has the `@Injectable()` decorator. Here is an example:

```typescript
@Injectable()
export class ExampleListener {
  @Listen('example', { type: PayloadDto })
  public async listenForQueueMessages(data: PayloadDto, control: MessageControl): Promise<void> {
    console.log('new message arrived on the "example" queue:', data);
  }
}
```

The `@Listen()` decorator's first parameter is the name of the queue, which we are listening to. When a new message arrives, this method
will be invoked with 2 arguments in order: `message payload` and `message control`. The `message payload` is a Data Transfer Object (DTO)
class's instance. The task of this DTO class is to describe the payload's data structure for validation and transformation. We do this with
decorators. The second argument is the `message control` object which gives control how to handle the message transfer.

The `@Listen()` decorator has a second argument which is the options object. The options object can have these **optional** properties:
* **type**?: A class reference which is decorated with [class-transformer](https://www.npmjs.com/package/class-transformer) and
  [class-validator](https://www.npmjs.com/package/class-validator) decorators. The data validation and transformation will be done
  with this class.
  > Note: if `type` is not provided, the incoming message will not be processed, and the handler will not receive the message, but `null` instead
* **skipValidation**?: if it is `true` then the message payload won't be validated and transformed by the `type` property's value. The
  default value is `false`.
* **acceptValidationNullObjectException**?: A boolean value. If it's `true` then QueueModule will accept the message when a
`ValidationNullObjectException` error is thrown during message transformation and validation. (`ValidationNullObjectException` will be thrown when message body is null). Otherwise the
message will be rejected on `ValidationNullObjectException` error. Default value is `false`.
* **parallelMessageProcessing**?: The most number of messages that should be processed at the same time. The default value is `1`.
* **transformerOptions**?: [class-transformer options](https://github.com/typestack/class-transformer/blob/develop/src/interfaces/class-transformer-options.interface.ts)
* **validatorOptions**?: [class-validator options](https://github.com/typestack/class-validator#passing-options)

#### Multiple connections

Listening for messages with multiple connections works mostly the same, the only difference is that we need to define on which connection are we listening for messages. Here is an example:

```typescript
@Injectable()
export class ExampleListener {
  @Listen('example', Connections.INTERNAL)
  public async listenForInternalTicks(_tick: unknown, control: MessageControl): Promise<void> {
    console.log(`new tick arrived on the "example" queue on connection ${Connections.INTERNAL}:`, data);
  }

  @Listen('example', { type: PayloadDto }, Connections.WORKER)
  public async listenForWorkerMessages(data: PayloadDto, control: MessageControl): Promise<void> {
    console.log(`new message arrived on the "example" queue on connection ${Connections.WORKER}:`, data);
  }
}
```

> Note: It is assumed that there is an enum named `Connections`, and
the connections defined in the `forRoot` method contains a connection named `Connections.INTERNAL` and `Connections.WORKER`.

> Note: If you leave out the name of the connection, the listener will be attached to the default connection (if exists).


### Removing a listener

If you want to remove a listener, you can use the `removeListener()` method of the `QueueService`. The method's first parameter is the name string or `Source` object of the queue, and the second (optional) parameter is the connection name if you have set it up. Here is an example:

```typescript
// with the default connection
await this.queueService.removeListener('example');
```

```typescript
// with named connection
await this.queueService.removeListener('example', Connections.TEST);
```

### Message control

When a new message arrives at a queue, the assigned method with `@Listen()` decorator receives the transformed and validated message body
and the message control. The latter object is to control the message transfer. It is possible to accept, reject or release the transfer.
Here are the examples:

```typescript
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
message will not be removed from the queue but will be processed by another consumer.

> If the message was not handled manually and the method with `@Listen()` decorator executed successfully then the message
will be accepted. If the message was not handled manually and there was an `Error` or `Exception` then the message will be rejected
automatically.

> Note relating to ActiveMQ: Active MQ current version (5.16.2 as of this writing) does not differentiate between `release` and `reject`, both will be understood as `release`.

### Payload validation and transformation

The module provides an opportunity for adding transformation and validation process to the message payload.
With transformation, we can set what properties are important for us and what properties should be skipped during the transformation.
With validation, we can check that the payload has the expected properties with valid values.

Here is an example DTO class:

```typescript
import { Exclude, Expose, Transform } from 'class-transformer';
import { IsIn, IsDateString, IsString } from 'class-validator';

@Exclude()
export class LogEntryDto {
  @Expose()
  @IsString()
  public readonly message: string;

  @Expose()
  @IsDateString()
  @Transform(value => new Date(value), { toClassOnly: true })
  public readonly date: Date;

  @Expose()
  @IsIn([1, 2, 3, 4, 5])
  public readonly level: number;

  constructor(props: Partial<LogEntryDto>) {
    Object.assign(this, props);
  }
}
```

The `@Expose()` decorator says that after the transformation, the properties with this decorator should stay in the `LogEntryDto` class
instance. The DTO class has an `@Exclude()` decorator which means that the properties that are not described in the class definition or
don't have `@Expose()` decorator will be removed from the resulting instance during the transformation . With these 2 decorators we can specify which
properties we want from the payload when the message arrives at the consumer side.

The `@Transform()` decorator is to manually cast or transform a value during the transformation process. In the example we can see that when the message arrives, the body will contain a JSON object which is converted to string.
The stringified JSON object has only primitive values so the `date` property will be a string
date. We want it as a `Date` object instance, so we manually transform it into a Date object with the `@Transform()` decorator. We have to notice that only when the payload will be transformed to the DTO object (i.e. when the message arrives at the consumer side) and not when
the object will be transformed to a string (i.e. before the sending on the producer side), because the DTO object will be represented as
a string in the message payload. The other decorators are to validate the property values.

An object payload's lifetime during the whole sending-receiving process:
```
                                        send                               receive
Message's way:     sender (producer)  --------->  queue (message broker)  --------->  receiver (consumer)
                                      transform                           transform
Payload's format:   DTO instance or   --------->          string          --------->     DTO instance
                   JavaScript object
```

You can see that the sender sends a DTO object instance or a plain object which will be converted to string and the message broker receives this string as message body.
When the consumer gets the message, the body is a string and the transformation process will transform it into a DTO instance.
Only one thing left: set this DTO class as message payload:

```typescript
@Listen('logsQueue', { type: LogEntryDto })
public async listenForLogsQueueMessages(data: LogEntryDto): Promise<void> {
  console.log('log entry:', data);
}
```

You can send any other primitive values as message payload but in this case you have to take care to disable the validation and
transformation process. Here is the example:

```typescript
@Listen('stringQueue', { type: String, skipValidation: true })
public async listenForStringQueueMessages(data: string): Promise<void> {
  console.log('message payload:', data);
}
```

> Note: Defining `type` is required if we want to receive primitive values as the message.
### Module logs

The module uses [debug](https://www.npmjs.com/package/debug) package for logging. If you start the Nest application with the `DEBUG`
environment variable, then you can set the level of logging:

```bash
# log everything
$ DEBUG=nest-amqp:* nest start

# log only the errors
$ DEBUG=nest-amqp:error:* nest start
```

### Shutdown

If you stop your application, then Nest will wait for the end of the currently processing messages and will exit after the processes
finished.

## Example

First you have to import the Queue module into the app module. The `QueueModule.forRoot()` method's first parameter
is the connection URI for the message broker server:

> Note: the `QueueModule.forRoot()` can be added only to the application's root module and only once

```typescript
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

Then create a `user.module.ts` feature module what will give all the functionality which belongs to the users.

> Note: the `QueueModule.forFeature()` module must be imported to each feature module of the application.

```typescript
import { Module } from '@nestjs/common';
import { QueueModule } from '@team-supercharge/nest-amqp';

@Module({
  imports: [QueueModule.forFeature()],
  controllers: [],
  providers: [],
})
export class UserModule {}
```

Import this `UserModule` in the `AppModule`.

After that create the `user.dto.ts` file and add a data transfer object (DTO) class to it which will be sent as body in the queue message.
The [class-transformer](https://www.npmjs.com/package/class-transformer) package is used to transform (rename, remove, alter type, etc...) the object properties before sending it to / after receiving it from the queue and
the [class-validator](https://www.npmjs.com/package/class-validator) package is used to validate the received object on the consumer side:

```typescript
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

> Note: you can add the `@Listen()` decorator for any class which have the `@Injectable()` decorator.

```typescript
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

Then we create a `user.controller.ts` file and add a HTTP endpoint which will send the message to the queue with the payload what it gets as HTTP body:

```typescript
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

We can see that the `send()` method is responsible to add a message to the given queue.

The last thing is to add this controller to the corresponding module:

```typescript
import { UserController } from './user.controller';
import { UserListener } from './user.listener';
// ...

@Module({
  controllers: [UserController],
  providers: [UserListener],
})
export class UserModule {}
```

Finally, start the app with `npm run start` and it will listen on http://localhost:4444 URL. You can test the functionality with sample HTTP requests which are in the `examples/01-Basic_Connection/http-requests/add-user.http` file.

## License

@team-supercharge/nest-amqp is [MIT licensed](LICENSE).
