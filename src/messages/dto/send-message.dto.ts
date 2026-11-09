import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { REACTIONS } from '../messages.service.js';

// The text part of a message. It may be empty when a photo/video/voice note is attached
// (the service checks that at least one of the two is there).
export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Message cannot be more than 2000 characters!' })
  content?: string;

  // The message this one replies to. Sent as text, because file uploads (multipart forms) only carry text.
  @IsOptional()
  @Matches(/^\d+$/, { message: 'Invalid reply.' })
  replyToId?: string;
}

// PATCH /messages/item/:id
export class EditMessageDto {
  @IsString()
  @MaxLength(2000, { message: 'Message cannot be more than 2000 characters!' })
  content: string;
}

// PUT /messages/item/:id/reaction
export class ReactDto {
  @IsIn(REACTIONS, { message: 'Pick one of the reaction emojis.' })
  emoji: string;
}
