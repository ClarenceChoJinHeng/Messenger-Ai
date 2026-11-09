import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service.js';

// What controllers get from @CurrentUser(), and the live connection stores per socket
export interface JwtUser {
  sub: number; // the user's id
  username: string;
}

// What's inside each login token
interface TokenPayload {
  sub: number;
  v: number; // the user's tokenVersion when the token was made
}

// Checks a login token: valid signature, not expired, user still exists, and not from before
// a password change. Used by AuthGuard (normal requests) and the live WebSocket connection.
// Returns null when the token isn't accepted.
export async function verifyAccessToken(jwt: JwtService, prisma: PrismaService, token: string): Promise<JwtUser | null> {
  let payload: TokenPayload;
  try {
    payload = await jwt.verifyAsync<TokenPayload>(token);
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== payload.v) return null;
  return { sub: user.id, username: user.username };
}
