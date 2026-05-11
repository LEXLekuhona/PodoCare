import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { PaymentsService } from '../application/payments.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class TinkoffWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('tinkoff')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook Т‑Банк (Тинькофф Эквайринг), идемпотентная обработка CONFIRMED' })
  tinkoff(@Body() body: unknown) {
    return this.paymentsService.handleTinkoffWebhook(body);
  }
}
