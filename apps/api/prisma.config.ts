import path from 'path'
import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// Load .env.local then .env so DATABASE_URL is available to the Prisma CLI
config({ path: path.join(__dirname, '.env.local') })
config({ path: path.join(__dirname, '.env') })

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env['DATABASE_URL'],
  },
  migrations: {
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  migrate: {
    async adapter() {
      const { Pool } = await import('pg')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const connectionString = process.env['DATABASE_URL']
      if (!connectionString) throw new Error('DATABASE_URL is not set')
      const pool = new Pool({ connectionString })
      return new PrismaPg(pool)
    },
  },
})
