import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env['DATABASE_URL'] ?? ''
    // Type mismatch between root @types/pg and adapter-pg's bundled @types/pg; cast resolves it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaPg(new Pool({ connectionString }) as any)
    super({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
