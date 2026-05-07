/* eslint-disable import/order */
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
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

  @Get(':studioId/products')
  @ApiOperation({ summary: 'Активные товары сети выбранной студии.' })
  listProducts(@Param('studioId') studioId: string) {
    return this.studiosService.listProducts(studioId);
  }

  @Get('health-concerns')
  @ApiOperation({ summary: 'Активные карточки блока "Что вас беспокоит".' })
  listHealthConcerns() {
    return this.studiosService.listHealthConcerns();
  }

  @Get('health-concerns/:slug')
  @ApiOperation({ summary: 'Карточка "Что вас беспокоит" по slug.' })
  getHealthConcern(@Param('slug') slug: string) {
    return this.studiosService.getHealthConcernBySlug(slug);
  }

  @Get('studio-directions')
  @ApiOperation({ summary: 'Активные направления студии (блок на главной).' })
  listStudioDirections() {
    return this.studiosService.listStudioDirections();
  }

  @Get('studio-directions/:slug')
  @ApiOperation({ summary: 'Направление студии по slug (экран с описанием).' })
  getStudioDirection(@Param('slug') slug: string) {
    return this.studiosService.getStudioDirectionBySlug(slug);
  }
}

