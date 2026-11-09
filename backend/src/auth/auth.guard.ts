import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyAccessToken, type JwtUser } from './verify-token.js';

export type { JwtUser } from './verify-token.js';

// The bouncer: routes marked @UseGuards(AuthGuard) only let in requests with a valid token
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();

    // The frontend sends: Authorization: Bearer <token>
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Please log in first.');
    }

    const user = await verifyAccessToken(this.jwt, this.prisma, token);
    if (!user) throw new UnauthorizedException('Your session expired. Please log in again.');

    request.user = user;
    return true;
  }
}
