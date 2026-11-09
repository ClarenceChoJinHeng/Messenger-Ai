import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service.js';

// Global, like PrismaModule: any service can inject CryptoService
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
