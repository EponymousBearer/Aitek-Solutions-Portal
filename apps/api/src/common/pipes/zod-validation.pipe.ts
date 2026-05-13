import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      })
    }
    return result.data
  }
}
