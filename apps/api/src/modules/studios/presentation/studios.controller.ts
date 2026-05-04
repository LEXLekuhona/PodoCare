import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { StudiosService } from '../application/studios.service';

@ApiTags('studios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('studios')
export class StudiosController {
  constructor(private readonly studiosService: StudiosService) {}

  @Get()
  @ApiOperation({ summary: 'Список активных студий для выбора на устройстве.' })
  list() {
    return this.studiosService.list();
  }

  @Get(':studioId/specialists')
  @ApiOperation({
    summary: 'Специалисты студии (для записи).',
    description:
      'Необязательный query `serviceId`: только специалисты, которые оказывают эту услугу в данной студии.',
  })
  listSpecialists(@Param('studioId') studioId: string, @Query('serviceId') serviceId?: string) {
    return this.studiosService.listSpecialists(studioId, serviceId);
  }

  @Get(':studioId/specialists/:specialistId/services')
  @ApiOperation({ summary: 'Услуги, доступные у специалиста в студии (для записи).' })
  listSpecialistServices(
    @Param('studioId') studioId: string,
    @Param('specialistId') specialistId: string,
  ) {
    return this.studiosService.listSpecialistServices(studioId, specialistId);
  }

  @Get(':studioId/services')
  @ApiOperation({ summary: 'Активные услуги студии.' })
  listServices(@Param('studioId') studioId: string) {
    return this.studiosService.listServices(studioId);
  }
}

