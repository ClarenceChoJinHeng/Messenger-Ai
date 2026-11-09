import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { getSecret } from '../config/secrets.js';

// Encryption at rest: messages and uploaded files are stored scrambled with AES-256-GCM.
// Anyone who gets a copy of the database or the uploads folder sees only noise without the key.
// GCM also adds an "auth tag", so tampered data fails to decrypt instead of returning garbage.
const PREFIX = 'enc:v1:'; // marks encrypted text, so older plain messages still display

@Injectable()
export class CryptoService {
  // The key must be exactly 32 bytes. Hashing whatever is configured guarantees that length.
  private readonly key = createHash('sha256').update(getSecret('MESSAGE_ENCRYPTION_KEY')).digest();

  encryptBuffer(plain: Buffer): Buffer {
    const iv = randomBytes(12); // a fresh random IV for every message: same text ≠ same output
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]); // [12 iv][16 tag][data]
  }

  decryptBuffer(stored: Buffer): Buffer {
    const iv = stored.subarray(0, 12);
    const tag = stored.subarray(12, 28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(stored.subarray(28)), decipher.final()]);
  }

  encryptText(text: string): string {
    return PREFIX + this.encryptBuffer(Buffer.from(text, 'utf8')).toString('base64');
  }

  decryptText(stored: string): string {
    if (!stored.startsWith(PREFIX)) return stored; // a message saved before encryption existed
    try {
      return this.decryptBuffer(Buffer.from(stored.slice(PREFIX.length), 'base64')).toString('utf8');
    } catch {
      return '[This message could not be decrypted]';
    }
  }
}
