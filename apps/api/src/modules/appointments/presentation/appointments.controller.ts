import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@srs/shared-types'
/* eslint-disable import/order */

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator'
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard'
import { Roles } from '../../auth/infrastructure/roles.decorator'
import { RolesGuard } from '../../auth/infrastructure/roles.guard'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { AppointmentsService } from '../application/appointments.service'
// Nest ValidationPipe relies on runtime metadata for DTO classes.
// `import type` breaks `design:paramtypes`, causing whitelist validation to reject all properties.
/* eslint-disable @typescript-eslint/consistent-type-imports -- DTO classes for @Body() / @Query() metadata */
import { BookingSlotsQueryDto } from './dto/booking-slots-query.dto'
import { CancelByClientDto } from './dto/cancel-by-client.dto'
import { CancelByStudioDto } from './dto/cancel-by-studio.dto'
import { CreateAppointmentProtocolDto } from './dto/create-appointment-protocol.dto'
import { CreateAppointmentDto } from './dto/create-appointment.dto'
import { CreateWalkInClientDto } from './dto/create-walk-in-client.dto'
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto'
import { SearchWalkInClientsQueryDto } from './dto/search-walk-in-clients.query.dto'
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto'
import { UpdateAppointmentProtocolDto } from './dto/update-appointment-protocol.dto'
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy'

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('next')
  @ApiOperation({
    summary:
      'Ближайшая предстоящая запись текущего клиента (опционально с фильтром по студии).',
  })
  nextForClient(@CurrentUser() user: JwtAccessPayload, @Query('studioId') studioId?: string) {
    return this.appointmentsService.nextForClient(user.sub, studioId);
  }

  @Get('booking-slots')
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

  @Get('walk-in-clients')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Поиск walk-in клиентов студии по телефону или ФИО.' })
  searchWalkInClients(@Query() query: SearchWalkInClientsQueryDto, @CurrentUser() user: JwtAccessPayload) {
    return this.appointmentsService.searchWalkInClients(user, query.studioId, query.q);
  }

  @Post('walk-in-clients')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Создать карточку клиента без приложения (walk-in).' })
  createWalkInClient(@Body() body: CreateWalkInClientDto, @CurrentUser() user: JwtAccessPayload) {
    return this.appointmentsService.createWalkInClient(user, body);
  }

  @Post()
  @Roles(
    UserRole.Client,
    UserRole.Specialist,
    UserRole.StudioAdmin,
    UserRole.NetworkOwner,
    UserRole.SuperAdmin,
  )
  @ApiOperation({ summary: 'Создаёт запись на приём с проверкой смены и пересечений.' })
  create(@Body() body: CreateAppointmentDto, @CurrentUser() user: JwtAccessPayload) {
    if (user.role === UserRole.Client) {
      if (body.walkInClientId) {
        throw new ForbiddenException('Клиент не может создавать запись для walk-in клиента');
      }
      if (body.clientUserId && body.clientUserId !== user.sub) {
        throw new ForbiddenException('Клиент может создавать запись только для себя');
      }
      return this.appointmentsService.create({
        ...body,
        clientUserId: user.sub,
      });
    }
    return this.appointmentsService.create(body, user);
  }

  @Get()
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Список записей по фильтрам.' })
  list(@Query() query: ListAppointmentsQueryDto, @CurrentUser() user: JwtAccessPayload) {
    return this.appointmentsService.list(query, user);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Подтверждает запись.' })
  confirm(@Param('id') id: string, @CurrentUser() user: JwtAccessPayload) {
    return this.appointmentsService.confirm(id, user);
  }

  @Patch(':id/cancel-by-studio')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Отмена записи студией.' })
  cancelByStudio(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: CancelByStudioDto,
  ) {
    return this.appointmentsService.cancelByStudio(id, user, body.reason);
  }

  @Patch(':id/reschedule')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Перенос записи на новое время с пересчётом напоминаний.' })
  reschedule(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(id, user, body);
  }
  @Patch(':id/cancel-by-client')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Отмена записи клиентом.' })
  cancelByClient(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: CancelByClientDto,
  ) {
    return this.appointmentsService.cancelByClient(id, user.sub, body.reason);
  }

  @Post(':id/protocol')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Создание протокола визита специалистом/администратором.' })
  createProtocol(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: CreateAppointmentProtocolDto,
  ) {
    return this.appointmentsService.createProtocol(id, user, body);
  }

  @Patch(':id/protocol')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Редактирование протокола визита с аудитом изменений.' })
  updateProtocol(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: UpdateAppointmentProtocolDto,
  ) {
    return this.appointmentsService.updateProtocol(id, user, body);
  }
}
