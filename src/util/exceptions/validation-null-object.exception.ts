export class ValidationNullObjectException extends Error {
  constructor(type: string) {
    super(`null received for validation for ${type}`);
  }
}
