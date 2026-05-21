import { ClassSerializerInterceptor } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import helmet from 'helmet'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression') as () => ReturnType<typeof import('compression')>

import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'
import { ClerkAuthGuard } from './common/guards/clerk-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })

  const reflector = app.get(Reflector)

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
  app.use(compression())

  app.setGlobalPrefix('api/v1')

  app.useGlobalFilters(new GlobalExceptionFilter())
  app.useGlobalInterceptors(
    new ResponseTransformInterceptor(),
    new ClassSerializerInterceptor(reflector),
  )
  app.useGlobalGuards(new ClerkAuthGuard(reflector), new RolesGuard(reflector))

  app.enableCors({
    origin: process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
    credentials: true,
  })

  const port = parseInt(process.env['PORT'] ?? '3001', 10)
  await app.listen(port)
  console.warn(`API running on http://localhost:${port}/api/v1`)
}

bootstrap()
