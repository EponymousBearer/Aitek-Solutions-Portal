import { Controller, Get } from '@nestjs/common'

import { Public } from '../../common/decorators/public.decorator'

import { ServicesService } from './services.service'

@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Get()
  @Public()
  async listCatalog() {
    return this.servicesService.listCatalog()
  }
}
