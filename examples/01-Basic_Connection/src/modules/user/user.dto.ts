import { Expose } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';

@Expose()
export class UserDto {
  @IsString()
  public readonly name: string;

  @IsInt()
  public readonly age: number;

  constructor(userData: UserDto) {
    Object.assign(this, userData);
  }
}
