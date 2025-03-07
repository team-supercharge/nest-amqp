import { Test, TestingModule } from '@nestjs/testing';
import { Expose } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

import { ObjectValidatorService } from './object-validator.service';
import { ValidationNullObjectException } from '../../util/exceptions';

describe('ObjectValidator', () => {
  let service: ObjectValidatorService;

  @Expose()
  class UserDto1 {
    @IsString()
    public name: string;
    @IsNumber()
    public age: number;
  }

  class UserDto2 {
    @Expose()
    @IsString()
    public name: string;
    public age: number;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObjectValidatorService],
    }).compile();
    service = module.get<ObjectValidatorService>(ObjectValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate an object', () => {
    it('should return the valid object', async () => {
      const user = { name: 'Peter', age: 20 };

      await expect(service.validate(UserDto1, user)).resolves.toEqual(user);
    });

    it('should return with validation errors on fail', async () => {
      const user = { name: 'Peter', age: '20' };

      await expect(service.validate(UserDto1, user)).rejects.toThrow('age');
    });

    it('should throw exception on null value', async () => {
      await expect(service.validate(UserDto1, null)).rejects.toThrow(ValidationNullObjectException);
    });

    it('should throw exception on undefined value', async () => {
      await expect(service.validate(UserDto1, undefined)).rejects.toThrow(ValidationNullObjectException);
    });

    it('should remove not exposed properties', async () => {
      const user = { name: 'Peter', age: 20 };

      await expect(service.validate(UserDto2, user)).resolves.toEqual({ name: 'Peter' });
    });

    it('should work with transformer options', async () => {
      const user = { name: 'Peter', age: 20 };

      await expect(service.validate(UserDto2, user, { transformerOptions: { strategy: 'exposeAll' } })).resolves.toEqual(user);
    });

    it('should work with validator options', async () => {
      const user = { name: 'Peter', age: null as any };

      await expect(service.validate(UserDto1, user, { validatorOptions: { skipNullProperties: true } })).resolves.toEqual(user);
    });
  });

  describe('found issues', () => {
    it('should pass receiving a number', async () => {
      await expect(service.validate(Number, 1)).resolves.toEqual(1);
    });
  });
});
