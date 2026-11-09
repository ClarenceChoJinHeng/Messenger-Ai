import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { CryptoService } from './crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Where uploads live: "disk" (the uploads/ folder, default) or "database" (the StoredFile table).
// Free hosts wipe their disk on every restart, so online we use the database.
const IN_DATABASE = process.env.FILE_STORAGE === 'database';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];

// What Nest's FileInterceptor hands us for an uploaded file
export interface UploadedFileData {
  buffer: Buffer;
  size: number;
  mimetype?: string; // what the browser CLAIMS it is (only used to tell a voice note from a video)
}

// Saves uploaded files encrypted under random names (on disk or in the database), and reads them back decrypted.
@Injectable()
export class FileStoreService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly prisma: PrismaService,
  ) {}

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

    // A random name: the user's file name is never used (no path tricks)
    const fileName = `${randomUUID()}.bin`;
    const encrypted = this.crypto.encryptBuffer(file.buffer);
    if (IN_DATABASE) {
      await this.prisma.storedFile.create({ data: { name: fileName, data: new Uint8Array(encrypted) } });
    } else {
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(join(UPLOAD_DIR, fileName), encrypted);
    }
    return { fileName, mime, size: file.size };
  }

  async read(fileName: string): Promise<Buffer> {
    if (IN_DATABASE) {
      const row = await this.prisma.storedFile.findUnique({ where: { name: fileName } });
      if (!row) throw new NotFoundException('File not found.');
      return this.crypto.decryptBuffer(Buffer.from(row.data));
    }
    return this.crypto.decryptBuffer(await readFile(join(UPLOAD_DIR, fileName)));
  }

  async remove(fileName: string | null | undefined) {
    if (!fileName) return;
    if (IN_DATABASE) await this.prisma.storedFile.deleteMany({ where: { name: fileName } });
    else await rm(join(UPLOAD_DIR, fileName), { force: true });
  }
}
