import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationChannel, NotificationTemplateKey } from '@podocare/shared-types';
import { IsBooleanString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { NotificationsService } from '../application/notifications.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { CreateReminderPolicyDto } from './dto/create-reminder-policy.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { UpsertNotificationPreferenceDto } from './dto/upsert-notification-preference.dto';
import { UpsertPushDeviceDto } from './dto/upsert-push-device.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { UpdateReminderPolicyDto } from './dto/update-reminder-policy.dto';

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
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('templates')
  @ApiOperation({ summary: 'Создаёт шаблон уведомления (NotificationTemplate).' })
  createTemplate(@Body() body: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(body);
  }

  @Get('templates')
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
  @ApiOperation({ summary: 'Обновляет шаблон уведомления.' })
  updateTemplate(@Param('id') id: string, @Body() body: UpdateNotificationTemplateDto) {
    return this.notificationsService.updateTemplate(id, body);
  }

  @Post('reminder-policies')
  @ApiOperation({ summary: 'Создаёт ReminderPolicy для автопланирования напоминаний.' })
  createReminderPolicy(@Body() body: CreateReminderPolicyDto) {
    return this.notificationsService.createReminderPolicy(body);
  }

  @Get('reminder-policies')
  @ApiOperation({ summary: 'Список ReminderPolicy.' })
  listReminderPolicies(@Query() query: ListPoliciesQueryDto) {
    return this.notificationsService.listReminderPolicies({
      networkId: query.networkId,
      activeOnly: query.activeOnly === 'true',
    });
  }

  @Patch('reminder-policies/:id')
  @ApiOperation({ summary: 'Обновляет ReminderPolicy.' })
  updateReminderPolicy(@Param('id') id: string, @Body() body: UpdateReminderPolicyDto) {
    return this.notificationsService.updateReminderPolicy(id, body);
  }

  @Post('send-sms')
  @ApiOperation({ summary: 'Ставит SMS в BullMQ очередь и возвращает job id.' })
  sendSms(@Body() body: SendSmsDto) {
    return this.notificationsService.enqueueSms(body);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Возвращает NotificationPreference пользователя.' })
  getPreference(@Query() query: PreferenceQueryDto) {
    return this.notificationsService.getPreference(query.userId);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Создаёт/обновляет NotificationPreference пользователя.' })
  upsertPreference(@Body() body: UpsertNotificationPreferenceDto) {
    return this.notificationsService.upsertPreference(body);
  }

  @Post('push-devices')
  @ApiOperation({ summary: 'Регистрирует или обновляет push device token пользователя.' })
  upsertPushDevice(@Body() body: UpsertPushDeviceDto) {
    return this.notificationsService.upsertPushDevice(body);
  }
}
