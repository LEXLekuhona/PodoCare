import { Module } from '@nestjs/common';

import { CryptoModule } from '../../infrastructure/crypto/crypto.module';
import { AuthModule } from '../auth/auth.module';
import { AcquiringTerminalsService } from './application/acquiring-terminals.service';
import { InstallmentRequestsService } from './application/installment-requests.service';
import { MonetizationAccessService } from './application/monetization-access.service';
import { OrdersService } from './application/orders.service';
import { PaymentsService } from './application/payments.service';
import { ProgramInquiriesService } from './application/program-inquiries.service';
import { ShipmentsService } from './application/shipments.service';
import { AdminAcquiringTerminalsController } from './presentation/admin-acquiring-terminals.controller';
import { InstallmentRequestsController } from './presentation/installment-requests.controller';
import { OrdersController } from './presentation/orders.controller';
import { PaymentsController } from './presentation/payments.controller';
import { ProgramInquiriesController } from './presentation/program-inquiries.controller';
import { TinkoffWebhookController } from './presentation/tinkoff-webhook.controller';
import { YookassaWebhookController } from './presentation/yookassa-webhook.controller';

@Module({
  imports: [AuthModule, CryptoModule],
  controllers: [
    AdminAcquiringTerminalsController,
    ProgramInquiriesController,
    InstallmentRequestsController,
    OrdersController,
    PaymentsController,
    YookassaWebhookController,
    TinkoffWebhookController,
  ],
  providers: [
    AcquiringTerminalsService,
    MonetizationAccessService,
    ProgramInquiriesService,
    InstallmentRequestsService,
    OrdersService,
    PaymentsService,
    ShipmentsService,
  ],
})
export class MonetizationModule {}
