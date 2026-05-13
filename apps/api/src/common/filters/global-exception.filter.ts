import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const requestId =
      (request.headers['x-request-id'] as string) ?? crypto.randomUUID()

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let error = 'Internal Server Error'
    let message = 'An unexpected error occurred'
    let details: unknown = undefined

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>
        message = (resp['message'] as string) ?? message
        error = (resp['error'] as string) ?? exception.name
        details = resp['details']
      }
      error = error !== 'Internal Server Error' ? error : exception.name
    } else if (exception instanceof Error) {
      message = exception.message
      this.logger.error(exception.message, exception.stack)
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      details,
      requestId,
    })
  }
}
