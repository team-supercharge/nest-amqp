import { Test, TestingModule } from '@nestjs/testing';
import { Expose } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

import { ObjectValidator } from './object-validator';
import { ValidationNullObjectException } from '../exceptions';

describe('ObjectValidator', () => {
  let service: ObjectValidator;

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

  class UserDto3 {
    @Expose()
    @IsNumber()
    public age: number;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObjectValidator],
    }).compile();
    service = module.get<ObjectValidator>(ObjectValidator);
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

  describe('validate array of objects', () => {
    it('should return the valid object', async () => {
      const userList = [
        { name: 'Peter', age: 20 },
        { name: 'Anna', age: 22 },
      ];

      await expect(service.validateArray(UserDto1, userList)).resolves.toEqual(userList);
    });

    it('should return with validation errors on fail', async () => {
      const userList = [
        { name: 'Peter', age: '20' },
        { name: 'Anna', age: '22' },
      ];

      await expect(service.validateArray(UserDto1, userList)).rejects.toThrow('age');
    });

    it('should work with transformer options', async () => {
      const userList = [
        { name: 'Peter', age: '20' },
        { name: 'Anna', age: '22' },
      ];

      await expect(service.validateArray(UserDto3, userList, { transformerOptions: { enableImplicitConversion: true } })).resolves.toEqual([
        { age: 20 },
        { age: 22 },
      ]);
    });

    it('should work with validator options', async () => {
      const userList = [{}, {}];

      await expect(service.validateArray(UserDto1, userList, { validatorOptions: { skipMissingProperties: true } })).resolves.toEqual(
        userList,
      );
    });
  });
});
