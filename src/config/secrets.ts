import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';

// Secrets the app needs. Each one comes from .env first.
// If it's missing (local development), we make a random one ONCE and keep it in
// secrets/dev-keys.json (git-ignored), so restarting the server doesn't log everyone out
// or make old messages unreadable. In production, always set them in the environment.
type SecretName = 'JWT_SECRET' | 'MESSAGE_ENCRYPTION_KEY';

const DEV_FILE = join(process.cwd(), 'secrets', 'dev-keys.json');
const logger = new Logger('Secrets');
let devKeys: Partial<Record<SecretName, string>> | null = null;

function loadDevKeys() {
  if (devKeys) return devKeys;
  devKeys = existsSync(DEV_FILE) ? JSON.parse(readFileSync(DEV_FILE, 'utf8')) : {};
  return devKeys!;
}

export function getSecret(name: SecretName): string {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;

  const keys = loadDevKeys();
  if (!keys[name]) {
    keys[name] = randomBytes(32).toString('base64'); // 32 random bytes = a 256-bit key
    mkdirSync(join(process.cwd(), 'secrets'), { recursive: true });
    writeFileSync(DEV_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
    logger.warn(`${name} is not in .env: created a development key in secrets/dev-keys.json`);
  }
  return keys[name]!;
}
