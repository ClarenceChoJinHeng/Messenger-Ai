import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService, // the database
    private readonly jwt: JwtService, // makes and checks login tokens
  ) {}

  async register(body: RegisterDto) {
    // Same rule as the frontend: never trust that the browser already checked it
    if (body.password === body.username) {
      throw new BadRequestException('Password cannot be the same as your Username!');
    }

    // Is the username or email already taken? → 409 Conflict
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ username: body.username }, { email: body.email }] },
    });
    if (taken) {
      throw new ConflictException(
        taken.username === body.username ? 'That username is already taken!' : 'That email is already registered!',
      );
    }

    // Hash the password: the database only ever sees a scrambled version
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await this.prisma.user.create({
      data: { username: body.username, email: body.email, password: passwordHash },
    });

    // Send back the saved user, never the password
    return { id: user.id, username: user.username, email: user.email };
  }

  async login(body: LoginDto) {
    // "login" can be a username or an email
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: body.login }, { email: body.login }] },
    });

    // Same message for "no such user" and "wrong password", so attackers can't tell which
    const ok = user && !user.isBot && (await bcrypt.compare(body.password, user.password));
    if (!user || !ok) {
      throw new UnauthorizedException('Wrong username/email or password.');
    }

    // The token is the user's "wristband": the frontend sends it with every request
    const accessToken = await this.jwt.signAsync({ sub: user.id, username: user.username });

    return {
      accessToken,
      user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName },
    };
  }
}
