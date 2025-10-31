import { Injectable } from '@nestjs/common';

/**
 * Handles encoding and decoding of AMQP message bodies.
 * Abstracts message serialization logic from QueueService.
 *
 * @public
 */
@Injectable()
export class MessageCodec {
  private readonly toString = Object.prototype.toString;

  /**
   * Encodes a message payload to JSON string.
   *
   * @param message The message to encode
   * @returns JSON string representation
   *
   * TODO: Add support for binary encoding
   */
  public encode(message: unknown): string {
    return JSON.stringify(message);
  }

  /**
   * Decodes a message from various formats (string, object, Buffer) to a typed value.
   *
   * @param message The message body in various formats
   * @returns Decoded message of type T
   * @throws Error if message cannot be parsed
   */
  public decode<T>(message: unknown): T {
    if (this.toString.call(message) === '[object Object]') {
      return message as T;
    }

    const objectLike: string =
      message instanceof Buffer ? message.toString() : (message as string);

    return JSON.parse(objectLike);
  }
}
