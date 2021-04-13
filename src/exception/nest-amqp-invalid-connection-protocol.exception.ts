export class NestAmqpInvalidConnectionProtocolException extends Error {
  constructor(message: string) {
    super(message);
  }
}
