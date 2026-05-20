import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import * as Joi from 'joi'

import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        CLERK_SECRET_KEY: Joi.string().required(),
        CLERK_WEBHOOK_SECRET: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        NEXT_PUBLIC_APP_URL: Joi.string().default('http://localhost:3000'),
      }),
      validationOptions: { allowUnknown: true },
    }),
    ThrottlerModule.forRoot([
      { name: 'auth', ttl: 60000, limit: 10 },
      { name: 'upload', ttl: 60000, limit: 30 },
      { name: 'ai', ttl: 60000, limit: 5 },
      { name: 'general', ttl: 60000, limit: 300 },
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
  ],
})
export class AppModule {}
