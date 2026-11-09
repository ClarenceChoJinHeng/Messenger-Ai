import type { PoolConfig } from 'mariadb';

// Turns DATABASE_URL into connection settings for the MariaDB/MySQL driver.
// Locally: mysql://root:@localhost:3306/messenger_ai (no encryption needed).
// Hosted databases (e.g. Aiven) require an encrypted (SSL/TLS) connection. That's switched on when the
// URL asks for it (?ssl-mode=REQUIRED or ?sslaccept=...) or DATABASE_SSL=true.
// If DATABASE_CA_CERT holds the provider's CA certificate (PEM text), the server's identity is verified too.
export function dbConfig(url = process.env.DATABASE_URL): PoolConfig {
  if (!url) throw new Error('DATABASE_URL is missing. Put it in .env (locally) or the host\'s environment settings.');
  const u = new URL(url);
  const params = u.searchParams;
  const wantsSsl =
    process.env.DATABASE_SSL === 'true' ||
    params.has('sslaccept') ||
    /^(required|verify_ca|verify_identity)$/i.test(params.get('ssl-mode') ?? '') ||
    params.get('ssl') === 'true';

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n'); // allow a one-line value with \n
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    ...(wantsSsl && { ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false } }),
  };
}
