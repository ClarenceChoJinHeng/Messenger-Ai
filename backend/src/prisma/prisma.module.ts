import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// @Global: every module can inject PrismaService without importing this module again.
// Nest builds ONE PrismaService (one database connection pool) and shares it everywhere.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
