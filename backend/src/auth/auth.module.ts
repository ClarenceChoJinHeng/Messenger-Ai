import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { getSecret } from '../config/secrets.js';

@Module({
  imports: [
    // global: true, so the AuthGuard can use JwtService in every module.
    // The secret comes from .env (or a saved development key), so it survives restarts.
    JwtModule.register({ global: true, secret: getSecret('JWT_SECRET'), signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
