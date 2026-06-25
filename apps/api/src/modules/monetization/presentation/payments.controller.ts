import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
import { COMMERCE_STAFF_ROLES } from '../monetization.constants';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PaymentsService } from '../application/payments.service';
import type { RefundPaymentDto } from './dto/refund-payment.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':paymentId/refund')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Базовый возврат (учёт в БД; ЮKassa API — вне MVP)' })
  refund(
    @CurrentUser() user: JwtAccessPayload,
    @Param('paymentId') paymentId: string,
    @Body() body: RefundPaymentDto,
  ) {
    return this.paymentsService.refund(user, paymentId, body);
  }
}
