import { Injectable } from '@nestjs/common';
import { ClassTransformOptions, plainToInstance } from 'class-transformer';
import { isDefined, validate, ValidatorOptions } from 'class-validator';

import { ValidationException, ValidationNullObjectException } from '../../util/exceptions';

export interface ObjectValidationOptions {
  transformerOptions?: ClassTransformOptions;
  validatorOptions?: ValidatorOptions;
}

/**
 * Class to validate an object or an array of objects.
 */
@Injectable()
export class ObjectValidatorService {
  /**
   * Transform and validate a source object by a decorated class. It works with
   * the `class-validator` and the `class-transformer` packages.
   *
   * By default, the validator will strip every property that is not explicitly exposed
   *
   * @param {new (...params: unknown[]) => T} type Class with validation and transformation decorators.
   * @param {unknown} plain Source object which will be transformed and validated.
   * @param {ObjectValidationOptions} options Transformation and validations options.
   *
   * @return {Promise<T>} The transformed and validated object.
   *
   * {@link https://www.npmjs.com/package/class-transformer class-transformer}
   * {@link https://www.npmjs.com/package/class-validator class-validator}
   *
   * @public
   */
  public async validate<T>(type: new (...params: unknown[]) => T, plain: unknown, options?: ObjectValidationOptions): Promise<T> {
    if (!isDefined(plain)) {
      throw new ValidationNullObjectException(type.name);
    }

    const transformerOptions = options?.transformerOptions ?? {};
    const validatorOptions = options?.validatorOptions;

    const object: T = plainToInstance<T, unknown>(type, plain, { strategy: 'excludeAll', ...transformerOptions });

    const errors = await validate(object as any, validatorOptions);

    if (errors.length !== 0) {
      throw new ValidationException(errors);
    }

    return object;
  }
}
