import 'dotenv/config'; // line 1: copy .env into process.env before anything else loads
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Only the Next.js frontend may call this API from a browser
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' });

  // Check every request body against its DTO, and drop fields the DTO doesn't list
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
