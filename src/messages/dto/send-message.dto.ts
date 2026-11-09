import { IsString, MaxLength, Matches } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Matches(/\S/, { message: 'Message cannot be empty!' }) // at least one non-space character
  @MaxLength(2000, { message: 'Message cannot be more than 2000 characters!' })
  content: string;
}
