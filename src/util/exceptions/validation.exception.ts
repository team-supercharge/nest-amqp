import { ValidationError } from 'class-validator';

export class ValidationException extends Error {
  constructor(errors: ValidationError[]) {
    super(JSON.stringify(errors));
  }
}
