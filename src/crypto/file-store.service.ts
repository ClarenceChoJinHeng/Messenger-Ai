import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { CryptoService } from './crypto.service.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];

// What Nest's FileInterceptor hands us for an uploaded file
export interface UploadedFileData {
  buffer: Buffer;
  size: number;
  mimetype?: string; // what the browser CLAIMS it is (only used to tell a voice note from a video)
}

// Saves uploaded files encrypted on disk under random names, and reads them back decrypted.
@Injectable()
export class FileStoreService {
  constructor(private readonly crypto: CryptoService) {}

  // Checks the real file type from its bytes, then stores it encrypted. Throws a 400 if not allowed.
  async save(file: UploadedFileData, allowed: string[], notAllowedMessage: string) {
    const found = await fileTypeFromBuffer(file.buffer);
    let mime = found?.mime as string | undefined;
    // Browser recordings are WebM, which some tools report as its parent format, Matroska
    if (mime === 'video/x-matroska') mime = 'video/webm';
    // A WebM/Ogg/MP4 file can hold just sound: trust the browser's "audio/..." only when the bytes agree on the container
    if (file.mimetype?.startsWith('audio/') && mime && ['video/webm', 'audio/webm', 'video/mp4', 'audio/ogg', 'audio/mp4'].includes(mime)) {
      mime = mime.replace('video/', 'audio/');
    }
    if (!mime || !allowed.includes(mime)) throw new BadRequestException(notAllowedMessage);

    // A random name: the user's file name never touches the disk (no path tricks)
    const fileName = `${randomUUID()}.bin`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, fileName), this.crypto.encryptBuffer(file.buffer));
    return { fileName, mime, size: file.size };
  }

  async read(fileName: string): Promise<Buffer> {
    return this.crypto.decryptBuffer(await readFile(join(UPLOAD_DIR, fileName)));
  }

  async remove(fileName: string | null | undefined) {
    if (fileName) await rm(join(UPLOAD_DIR, fileName), { force: true });
  }
}
