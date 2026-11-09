import { IsOptional, IsString, MaxLength } from 'class-validator';

// The text part of a message. It may be empty when a photo/video is attached
// (the service checks that at least one of the two is there).
export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Message cannot be more than 2000 characters!' })
  content?: string;
}
