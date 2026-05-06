import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationChannel, NotificationTemplateKey, UserRole } from '@srs/shared-types';
import { IsBooleanString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
import { NotificationsService } from '../application/notifications.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { CreateReminderPolicyDto } from './dto/create-reminder-policy.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { UpsertNotificationPreferenceDto } from './dto/upsert-notification-preference.dto';
import { UpsertPushDeviceDto } from './dto/upsert-push-device.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { UpdateReminderPolicyDto } from './dto/update-reminder-policy.dto';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

class ListTemplatesQueryDto {
  @IsOptional()
  @IsUUID()
  networkId?: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationTemplateKey)
  key?: NotificationTemplateKey;

  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}

class ListPoliciesQueryDto {
  @IsOptional()
  @IsUUID()
  networkId?: string;

  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}

class PreferenceQueryDto {
  @IsUUID()
  userId!: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('templates')
  @Roles(UserRole.NetworkOwner, UserRole.StudioAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Создаёт шаблон уведомления (NotificationTemplate).' })
  createTemplate(@Body() body: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(body);
  }

  @Get('templates')
  @Roles(UserRole.NetworkOwner, UserRole.StudioAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Список шаблонов уведомлений с фильтрами.' })
  listTemplates(@Query() query: ListTemplatesQueryDto) {
    return this.notificationsService.listTemplates({
      networkId: query.networkId,
      channel: query.channel,
      key: query.key,
      activeOnly: query.activeOnly === 'true',
    });
  }

  @Patch('templates/:id')
  @Roles(UserRole.NetworkOwner, UserRole.StudioAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Обновляет шаблон уведомления.' })
  updateTemplate(@Param('id') id: string, @Body() body: UpdateNotificationTemplateDto) {
    return this.notificationsService.updateTemplate(id, body);
  }

  @Post('reminder-policies')
  @Roles(UserRole.NetworkOwner, UserRole.StudioAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Создаёт ReminderPolicy для автопланирования напоминаний.' })
  createReminderPolicy(@Body() body: CreateReminderPolicyDto) {
    return this.notificationsService.createReminderPolicy(body);
  }

  @Get('reminder-policies')
  @Roles(UserRole.NetworkOwner, UserRole.StudioAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Список ReminderPolicy.' })
  listReminderPolicies(@Query() query: ListPoliciesQueryDto) {
    return this.notificationsService.listReminderPolicies({
      networkId: query.networkId,
      activeOnly: query.activeOnly === 'true',
    });
  }

  @Patch('reminder-policies/:id')
  @Roles(UserRole.NetworkOwner, UserRole.StudioAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Обновляет ReminderPolicy.' })
  updateReminderPolicy(@Param('id') id: string, @Body() body: UpdateReminderPolicyDto) {
    return this.notificationsService.updateReminderPolicy(id, body);
  }

  @Post('send-sms')
  @Roles(UserRole.NetworkOwner, UserRole.StudioAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Ставит SMS в BullMQ очередь и возвращает job id.' })
  sendSms(@Body() body: SendSmsDto) {
    return this.notificationsService.enqueueSms(body);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Возвращает NotificationPreference пользователя.' })
  getPreference(@CurrentUser() user: JwtAccessPayload, @Query() query: PreferenceQueryDto) {
    this.assertCanManageUserPreference(user, query.userId);
    return this.notificationsService.getPreference(query.userId);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Создаёт/обновляет NotificationPreference пользователя.' })
  upsertPreference(@CurrentUser() user: JwtAccessPayload, @Body() body: UpsertNotificationPreferenceDto) {
    this.assertCanManageUserPreference(user, body.userId);
    return this.notificationsService.upsertPreference(body);
  }

  @Post('push-devices')
  @ApiOperation({ summary: 'Регистрирует или обновляет push device token пользователя.' })
  upsertPushDevice(@CurrentUser() user: JwtAccessPayload, @Body() body: UpsertPushDeviceDto) {
    this.assertCanManageUserPreference(user, body.userId);
    return this.notificationsService.upsertPushDevice(body);
  }

  private assertCanManageUserPreference(user: JwtAccessPayload, targetUserId: string): void {
    if (user.sub === targetUserId) {
      return;
    }
    const elevatedRoles = new Set<UserRole>([
      UserRole.NetworkOwner,
      UserRole.StudioAdmin,
      UserRole.SuperAdmin,
    ]);
    if (elevatedRoles.has(user.role as UserRole)) {
      return;
    }
    throw new ForbiddenException('Недостаточно прав для управления предпочтениями другого пользователя');
  }
}
