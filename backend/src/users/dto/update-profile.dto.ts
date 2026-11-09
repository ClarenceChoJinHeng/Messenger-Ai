import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// What the profile form sends. Every field is optional: only the ones sent get changed.
export class UpdateProfileDto {
  // Same rules as when registering
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username cannot be less then 3 characters!' })
  @MaxLength(20, { message: 'Username cannot be more then 20 characters!' })
  @Matches(/^\S+$/, { message: 'Username cannot have space!' })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'Display name cannot be more than 40 characters!' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'Bio cannot be more than 280 characters!' })
  bio?: string;

  @IsOptional()
  @IsIn(['grey', 'black'], { message: 'Theme must be grey or black.' })
  theme?: 'grey' | 'black';

  @IsOptional()
  @IsIn(['auto', 'online', 'away', 'offline'], { message: 'Status must be auto, online, away or offline.' })
  statusMode?: 'auto' | 'online' | 'away' | 'offline';
}
