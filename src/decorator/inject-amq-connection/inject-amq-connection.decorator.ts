import { Inject } from '@nestjs/common';
import { getAMQConnectionToken } from '../../util';

export const InjectAMQConnection = (connection?: string): ParameterDecorator => Inject(getAMQConnectionToken(connection));
