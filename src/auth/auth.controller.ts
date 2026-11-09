import { Controller, Post, Body } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { AuthService } from './auth.service.js';

// @Controller('auth')
// export class AuthController {
//   // @Post is a decorator from nestjs/common
//   constructor(private readonly authService: AuthService) {}
//   @Post('register')
//   register(@Body() body: RegisterDto) {
//     console.log(body);
//     return this.authService.register(body);
//   }
// }

@Controller('auth')
export class AuthController {
  // Constructor is used to pass an object, so now we can take the service object and return it to the frontend
  constructor(private readonly authService: AuthService) {} 
  @Post('register')
  register(@Body() body: RegisterDto) {
    console.log(body);
    return this.authService.register(body); // <-- Passing the value of the http body request into the serviec method
  }
}