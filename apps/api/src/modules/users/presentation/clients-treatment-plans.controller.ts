/* eslint-disable import/order */
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { TreatmentPlansService } from '../application/treatment-plans.service';
// Nest ValidationPipe relies on runtime metadata for DTO classes.
// `import type` breaks `design:paramtypes`, causing whitelist validation to reject all properties.
import { CreateTreatmentPlanDto } from './dto/create-treatment-plan.dto';
import { UpdateTreatmentPlanDto } from './dto/update-treatment-plan.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsTreatmentPlansController {
  constructor(private readonly treatmentPlansService: TreatmentPlansService) {}

  @Post(':id/treatment-plans')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Создать план лечения клиенту.' })
  create(
    @Param('id') clientId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: CreateTreatmentPlanDto,
  ) {
    return this.treatmentPlansService.createForClient(clientId, user, body);
  }

  @Patch(':id/treatment-plans/:planId')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Обновить план лечения клиента и создать ревизию.' })
  update(
    @Param('id') clientId: string,
    @Param('planId') planId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() body: UpdateTreatmentPlanDto,
  ) {
    return this.treatmentPlansService.updateForClient(clientId, planId, user, body);
  }

  @Get(':id/treatment-plans')
  @Roles(UserRole.Specialist, UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Список планов лечения клиента с историей версий.' })
  list(@Param('id') clientId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.treatmentPlansService.listForClient(clientId, user);
  }
}
