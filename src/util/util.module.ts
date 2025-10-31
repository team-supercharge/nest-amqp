import { Module } from '@nestjs/common';
import { MessageCodec } from './message-codec.util';
import { MessageFactory } from './message-factory.util';
import { ObjectValidatorService } from './object-validator.util';

@Module({
  providers: [MessageCodec, MessageFactory, ObjectValidatorService],
  exports: [MessageCodec, MessageFactory, ObjectValidatorService],
})
export class UtilModule {}
