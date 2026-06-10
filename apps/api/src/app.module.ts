import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import * as Joi from 'joi'

import { ClerkAuthGuard } from './common/guards/clerk-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { StorageModule } from './common/storage/storage.module'
import { AuthModule } from './modules/auth/auth.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { CustomRequestsModule } from './modules/custom-requests/custom-requests.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { HealthModule } from './modules/health/health.module'
import { KycModule } from './modules/kyc/kyc.module'
import { MessagesModule } from './modules/messages/messages.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { OnboardingModule } from './modules/onboarding/onboarding.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { QuestionnaireModule } from './modules/questionnaire/questionnaire.module'
import { ServicesModule } from './modules/services/services.module'
import { TeamModule } from './modules/team/team.module'
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
    StorageModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    ServicesModule,
    QuestionnaireModule,
    OnboardingModule,
    KycModule,
    CustomRequestsModule,
    ProjectsModule,
    TeamModule,
    MessagesModule,
    NotificationsModule,
    DocumentsModule,
  ],
  providers: [
    // Global guards. ClerkAuthGuard needs DI (Prisma) so it can't be
    // instantiated manually in main.ts the way it was before.
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
