import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { PaymentsService } from '../application/payments.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class YookassaWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('yookassa')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook ЮKassa (идемпотентная обработка)' })
  yookassa(@Body() body: unknown) {
    return this.paymentsService.handleYooKassaWebhook(body);
  }
}
