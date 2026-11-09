import { IsNotEmpty, IsString } from 'class-validator';

// What the login form sends
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Username or email cannot be empty!' })
  login: string; // username OR email

  @IsString()
  @IsNotEmpty({ message: 'Password cannot be empty!' })
  password: string;
}
