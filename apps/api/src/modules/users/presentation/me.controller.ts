import { Body, Controller, ForbiddenException, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import { MeService } from '../application/me.service';
import { RecordConsentsDto } from './dto/record-consents.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @ApiOperation({ summary: 'Текущий пользователь.' })
  getMe(@CurrentUser() user: JwtAccessPayload) {
    return this.meService.get(user.sub);
  }

  @Get('medical-card')
  @ApiOperation({ summary: 'Сводка медкарты текущего пользователя.' })
  getMedicalCard(@CurrentUser() user: JwtAccessPayload) {
    return this.meService.getMedicalCard(user.sub);
  }

  @Get('treatment-plans')
  @ApiOperation({ summary: 'Планы лечения текущего клиента.' })
  getTreatmentPlans(@CurrentUser() user: JwtAccessPayload) {
    return this.meService.getTreatmentPlans(user.sub);
  }

  @Patch('medical-card')
  @ApiOperation({
    summary:
      'Изменение медкарты из клиентского приложения запрещено. Заполнение — специалистом, редактирование — в админ-панели.',
  })
  updateMedicalCardForbidden() {
    throw new ForbiddenException(
      'Изменение медкарты недоступно: клиент может только просматривать карту в мобильном приложении.',
    );
  }

  @Patch()
  @ApiOperation({ summary: 'Обновление профиля текущего пользователя.' })
  patchMe(@CurrentUser() user: JwtAccessPayload, @Body() body: UpdateMeDto) {
    return this.meService.update(user.sub, body);
  }

  @Get('consents')
  @ApiOperation({
    summary: 'Подписанные согласия клиента (активные, без отзыва). Архив не возвращается.',
  })
  listConsents(@CurrentUser() user: JwtAccessPayload) {
    return this.meService.listConsents(user.sub);
  }

  @Post('consents')
  @ApiOperation({ summary: 'Зафиксировать подписание одного или нескольких документов.' })
  recordConsents(@CurrentUser() user: JwtAccessPayload, @Body() body: RecordConsentsDto) {
    return this.meService.recordConsents(user.sub, body.items);
  }
}

