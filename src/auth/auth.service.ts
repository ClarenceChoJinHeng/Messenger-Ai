import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';

@Injectable() // <-- Need this guy to be able to pass it into the constructor
export class AuthService {
  register(body: RegisterDto) {
    // Returning data to controller (nothing is saved yet)
    return {
      username: body.username,
      email: body.email,
    };
  }
}
