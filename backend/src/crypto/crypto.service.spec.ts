import { CryptoService } from './crypto.service.js';

describe('CryptoService', () => {
  process.env.MESSAGE_ENCRYPTION_KEY = 'test-key-only-for-unit-tests';
  const crypto = new CryptoService();

  it('encrypts text so the stored value does not contain it, and decrypts it back', () => {
    const stored = crypto.encryptText('meet me at 5 😀');
    expect(stored).not.toContain('meet');
    expect(crypto.decryptText(stored)).toBe('meet me at 5 😀');
  });

  it('gives a different result each time for the same text (random IV)', () => {
    expect(crypto.encryptText('same')).not.toBe(crypto.encryptText('same'));
  });

  it('refuses tampered data', () => {
    const stored = crypto.encryptText('original');
    const bytes = Buffer.from(stored.slice('enc:v1:'.length), 'base64');
    bytes[bytes.length - 1] ^= 1; // flip one bit
    expect(crypto.decryptText('enc:v1:' + bytes.toString('base64'))).toBe('[This message could not be decrypted]');
  });

  it('shows old unencrypted messages as they are', () => {
    expect(crypto.decryptText('hello from before')).toBe('hello from before');
  });
});
