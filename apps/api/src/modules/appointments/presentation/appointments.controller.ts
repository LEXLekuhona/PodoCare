import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import { AppointmentsService } from '../application/appointments.service';
import { BookingSlotsQueryDto } from './dto/booking-slots-query.dto';
import { CancelByStudioDto } from './dto/cancel-by-studio.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelByClientDto } from './dto/cancel-by-client.dto';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('next')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Ближайшая предстоящая запись текущего клиента (опционально с фильтром по студии).',
  })
  nextForClient(@CurrentUser() user: JwtAccessPayload, @Query('studioId') studioId?: string) {
    return this.appointmentsService.nextForClient(user.sub, studioId);
  }

  @Get('booking-slots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  /** Клиенты (Expo Router и др.) могут добавлять служебные query-параметры — не падаем на forbidNonWhitelisted. */
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  @ApiOperation({
    summary: 'Слоты для записи (дни + сетка времени с учётом смен, занятости и часов студии).',
  })
  bookingSlots(@Query() query: BookingSlotsQueryDto) {
    return this.appointmentsService.bookingSlots(query);
  }

  @Post()
  @ApiOperation({ summary: 'Создаёт запись на приём с проверкой смены и пересечений.' })
  create(@Body() body: CreateAppointmentDto) {
    return this.appointmentsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Список записей по фильтрам.' })
  list(@Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.list(query);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Подтверждает запись.' })
  confirm(@Param('id') id: string) {
    return this.appointmentsService.confirm(id);
  }

  @Patch(':id/cancel-by-client')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отмена записи клиентом.' })
  cancelByClient(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: CancelByClientDto,
  ) {
    return this.appointmentsService.cancelByClient(id, user.sub, body.reason);
  }

  @Patch(':id/cancel-by-studio')
  @ApiOperation({ summary: 'Отмена записи студией.' })
  cancelByStudio(@Param('id') id: string, @Body() body: CancelByStudioDto) {
    return this.appointmentsService.cancelByStudio(id, body.reason);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Перенос записи на новое время с пересчётом напоминаний.' })
  reschedule(@Param('id') id: string, @Body() body: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(id, body);
  }
}
