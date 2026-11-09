import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service.js';
import { FileStoreService } from './file-store.service.js';

// Global, like PrismaModule: any service can inject CryptoService and FileStoreService
@Global()
@Module({
  providers: [CryptoService, FileStoreService],
  exports: [CryptoService, FileStoreService],
})
export class CryptoModule {}
