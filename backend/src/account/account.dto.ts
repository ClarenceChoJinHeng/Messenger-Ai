import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// POST /account/email
export class ChangeEmailDto {
  @IsEmail({}, { message: 'Please enter a valid email.' })
  @MaxLength(191)
  newEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Please enter your current password.' })
  password: string; // proves it's really you, even on a computer someone left logged in
}

// POST /account/password
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter your current password.' })
  currentPassword: string;

  // Same rules as sign-up
  @IsString()
  @MinLength(8, { message: 'Password cannot be less than 8 characters!' })
  @MaxLength(72, { message: 'Password cannot be more than 72 characters!' }) // bcrypt only reads 72 bytes
  @Matches(/^\S+$/, { message: 'Password cannot have space!' })
  newPassword: string;
}

// POST /account/confirm
export class ConfirmChangeDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
