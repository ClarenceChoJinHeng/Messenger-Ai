import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// POST /contacts: add someone by their exact username
export class AddContactDto {
  @IsString()
  @MinLength(1, { message: 'Type a username to add.' })
  @MaxLength(20, { message: 'Usernames are at most 20 characters.' })
  @Matches(/^@?\S+$/, { message: 'Usernames have no spaces.' })
  username: string; // a leading "@" is allowed and ignored
}
