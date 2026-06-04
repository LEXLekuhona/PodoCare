import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
import { COMMERCE_STAFF_ROLES } from '../monetization.constants';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { InstallmentRequestsService } from '../application/installment-requests.service';
import type { CreateInstallmentRequestDto } from './dto/create-installment-request.dto';
import type { PatchInstallmentRequestDto } from './dto/patch-installment-request.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@ApiTags('installment-requests')
@Controller('installment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InstallmentRequestsController {
  constructor(private readonly installmentRequestsService: InstallmentRequestsService) {}

  @Post()
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Заявка на рассрочку' })
  create(@CurrentUser() user: JwtAccessPayload, @Body() body: CreateInstallmentRequestDto) {
    return this.installmentRequestsService.createForClient(user.sub, body);
  }

  @Get('mine')
  @Roles(UserRole.Client)
  listMine(@CurrentUser() user: JwtAccessPayload) {
    return this.installmentRequestsService.listMine(user.sub);
  }

  @Get()
  @Roles(...COMMERCE_STAFF_ROLES)
  listForStaff(@CurrentUser() user: JwtAccessPayload, @Query('networkId') networkId?: string) {
    return this.installmentRequestsService.listForStaff(user, networkId);
  }

  @Patch(':id')
  @Roles(...COMMERCE_STAFF_ROLES)
  patch(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() body: PatchInstallmentRequestDto) {
    return this.installmentRequestsService.patchForStaff(user, id, body);
  }
}
