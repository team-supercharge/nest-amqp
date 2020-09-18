import { Injectable } from '@nestjs/common';
import { ClassTransformOptions, plainToClass } from 'class-transformer';
import { validate, ValidationError, ValidatorOptions } from 'class-validator';

import { ValidationNullObjectException } from '../exceptions';

export interface ObjectValidationOptions {
  transformerOptions?: ClassTransformOptions;
  validatorOptions?: ValidatorOptions;
}

/**
 * Class to validate an object or an array of objects.
 */
@Injectable()
export class ObjectValidator {
  /**
   * Validate and transform a source object by a decorated class. It works with
   * the `class-validator` and the `class-transformer` packages.
   *
   * @param {new (...params: any[]) => T} type Class with validation and transformation decorators.
   * @param {any} attributes Source object what will be transformed and validated.
   * @param {ObjectValidationOptions} options Transformation and validations options.
   * @return {Promise<T>} options Validated and transformed object.
   * {@link https://www.npmjs.com/package/class-transformer class-transformer}
   * {@link https://www.npmjs.com/package/class-validator class-validator}
   */
  public async validate<T>(type: new (...params: any[]) => T, attributes: any, options?: ObjectValidationOptions): Promise<T> {
    const transformerOptions = options && options.transformerOptions ? options.transformerOptions : {};
    const validatorOptions = options && options.validatorOptions ? options.validatorOptions : {};

    if (attributes === null || attributes === undefined) {
      throw new ValidationNullObjectException(type.name);
    }

    const object: T = plainToClass<T, any>(type, attributes, {
      strategy: 'excludeAll',
      ...transformerOptions,
    });
    const errors = await validate(object, validatorOptions);

    if (errors.length !== 0) {
      throw new Error(JSON.stringify(errors));
    }

    return object;
  }

  /**
   * Validate and transform a list of objects by a decorated class. It works
   * with the `class-validator` and the `class-transformer` packages.
   *
   * @param {new (...params: any[]) => T} type Class with validation and transformation decorators.
   * @param {any[]} attributes Source object what will be transformed and validated.
   * @param {ObjectValidationOptions} options Transformation and validations options.
   * @return {Promise<T[]>} options Validated and transformed object.
   * {@link https://www.npmjs.com/package/class-transformer class-transformer}
   * {@link https://www.npmjs.com/package/class-validator class-validator}
   */
  public async validateArray<T>(type: new (...params: any[]) => T, attributes: any[], options?: ObjectValidationOptions): Promise<T[]> {
    const transformerOptions = options && options.transformerOptions ? options.transformerOptions : {};
    const validatorOptions = options && options.validatorOptions ? options.validatorOptions : {};
    const objects: T[] = plainToClass<T, any>(type, attributes, {
      strategy: 'excludeAll',
      ...transformerOptions,
    });
    const errors: ValidationError[] = [];

    for (const object of objects) {
      errors.push(...(await validate(object, validatorOptions)));
    }

    if (errors.length !== 0) {
      throw new Error(JSON.stringify(errors));
    }

    return objects;
  }
}
