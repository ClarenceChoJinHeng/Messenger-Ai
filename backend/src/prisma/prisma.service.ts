import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { dbConfig } from '../config/db-config.js';

@Injectable() // so Nest can hand it out
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // the "cable" to MySQL. dbConfig() reads DATABASE_URL, and turns on encryption for hosted databases
    const adapter = new PrismaMariaDb(dbConfig());
    super({ adapter });
  }

  // app starting: connect now, so a dead database shows up at startup
  async onModuleInit() {
    await this.$connect();
  }

  // app stopping: close the connection politely
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
