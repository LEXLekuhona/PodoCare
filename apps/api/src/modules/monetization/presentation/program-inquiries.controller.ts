/* eslint-disable @typescript-eslint/consistent-type-imports -- DTO как классы для ValidationPipe */
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
import { ProgramInquiriesService } from '../application/program-inquiries.service';
import { COMMERCE_STAFF_ROLES } from '../monetization.constants';
import { CreateProgramInquiryDto } from './dto/create-program-inquiry.dto';
import { PatchProgramInquiryDto } from './dto/patch-program-inquiry.dto';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { ProgramInquiryStatus } from '@prisma/client';

@ApiTags('program-inquiries')
@Controller('program-inquiries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProgramInquiriesController {
  constructor(private readonly programInquiriesService: ProgramInquiriesService) {}

  @Post()
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Оставить заявку на программу (клиент)' })
  create(@CurrentUser() user: JwtAccessPayload, @Body() body: CreateProgramInquiryDto) {
    return this.programInquiriesService.createForClient(user.sub, body);
  }

  @Get('mine')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Мои заявки' })
  listMine(@CurrentUser() user: JwtAccessPayload) {
    return this.programInquiriesService.listMine(user.sub);
  }

  @Get()
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Список заявок (сотрудники сети)' })
  listForStaff(
    @CurrentUser() user: JwtAccessPayload,
    @Query('networkId') networkId?: string,
    @Query('status') status?: ProgramInquiryStatus,
  ) {
    return this.programInquiriesService.listForStaff(user, { networkId, status });
  }

  @Patch(':id')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Обновить заявку / назначить менеджера' })
  patch(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() body: PatchProgramInquiryDto) {
    return this.programInquiriesService.patchForStaff(user, id, body);
  }
}
