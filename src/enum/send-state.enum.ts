export enum SendState {
  /**
   * Message was sent successfully
   */
  Success,
  /**
   * Message failed to send, Broker did not accept the message
   */
  Failed,
}
