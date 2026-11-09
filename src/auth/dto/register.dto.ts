import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  // @IsString() and @IsEmail is a decorator from class-validator
  @IsString()
  @MinLength(3, { message: 'Username cannot be less then 3 characters!' })
  @MaxLength(20, { message: 'Username cannot be more then 20 characters!' })
  @Matches(/^\S+$/, { message: 'Username cannot have space!' })
  username: string;
  @IsEmail()
  @Matches(/^\S+$/, { message: 'Email cannot have space!' })
  email: string;
  @IsString()
  @MinLength(8, { message: 'Password cannot be less than 8 characters!' })
  @Matches(/^\S+$/, { message: 'Password cannot have space!' })
  password: string;
}
