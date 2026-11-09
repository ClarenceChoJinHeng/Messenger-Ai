import { IsOptional, IsString, MaxLength } from 'class-validator';

// What the profile form sends. Both fields are optional.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'Display name cannot be more than 40 characters!' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'Bio cannot be more than 280 characters!' })
  bio?: string;
}
