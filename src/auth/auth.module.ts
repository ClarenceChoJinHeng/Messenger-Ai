import { randomBytes } from 'node:crypto';
import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

// The secret that signs login tokens. It belongs in .env as JWT_SECRET.
// Without it we make a random one each start (it works, but everyone gets logged out on restart).
const jwtSecret = process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  new Logger('AuthModule').warn('JWT_SECRET is not set in .env, using a temporary secret');
}

@Module({
  imports: [
    // global: true, so the AuthGuard can use JwtService in every module
    JwtModule.register({ global: true, secret: jwtSecret, signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
