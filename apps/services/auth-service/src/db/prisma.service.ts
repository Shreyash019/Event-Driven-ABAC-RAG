import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { DbConfig } from '../config/configuration';

/**
 * Prisma client wired into Nest's lifecycle: connect on boot, disconnect on shutdown.
 * The connection string is taken from validated config (single source of truth) rather
 * than left to Prisma's implicit DATABASE_URL pickup.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({ datasourceUrl: config.getOrThrow<DbConfig>('db').databaseUrl });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
