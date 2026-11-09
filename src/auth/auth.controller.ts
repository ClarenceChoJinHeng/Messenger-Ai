import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

// The waiter for /auth/...: takes the order (body) and passes it to the chef (AuthService)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register → 201 { id, username, email }
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  // POST /auth/login → 200 { accessToken, user }
  @Post('login')
  @HttpCode(200) // logging in doesn't create anything, so 200 instead of 201
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}
