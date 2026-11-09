import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

// What we put inside each login token
export interface JwtUser {
  sub: number; // the user's id
  username: string;
}

// The bouncer: routes marked @UseGuards(AuthGuard) only let in requests with a valid token
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();

    // The frontend sends: Authorization: Bearer <token>
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Please log in first.');
    }

    try {
      // Checks the signature and the expiry date, then remembers who this is
      request.user = await this.jwt.verifyAsync<JwtUser>(token);
    } catch {
      throw new UnauthorizedException('Your session expired. Please log in again.');
    }
    return true;
  }
}
