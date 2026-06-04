import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
import { COMMERCE_STAFF_ROLES } from '../monetization.constants';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { OrdersService } from '../application/orders.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PaymentsService } from '../application/payments.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { ShipmentsService } from '../application/shipments.service';
import type { CheckoutOrderDto } from './dto/checkout-order.dto';
import type { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import type { CreateVisitInvoiceDto } from './dto/create-visit-invoice.dto';
import type { PatchShipmentDto } from './dto/patch-shipment.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly shipmentsService: ShipmentsService,
  ) {}

  @Post('checkout')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Оформить заказ' })
  checkout(@CurrentUser() user: JwtAccessPayload, @Body() body: CheckoutOrderDto) {
    return this.ordersService.checkout(user.sub, body);
  }

  @Post('visit-invoice')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Счёт после приёма: услуги и товары (оплата в студии)' })
  createVisitInvoice(@CurrentUser() user: JwtAccessPayload, @Body() body: CreateVisitInvoiceDto) {
    return this.ordersService.createVisitInvoice(user, body);
  }

  @Post(':orderId/visit-payments/cash')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Отметить оплату наличными (счёт после приёма)' })
  recordVisitCash(
    @CurrentUser() user: JwtAccessPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.recordVisitCashPayment(user, orderId);
  }

  @Post(':orderId/visit-payments/tinkoff-init')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Инициировать оплату картой через Тинькофф (терминал / эквайринг)' })
  initVisitTinkoff(
    @CurrentUser() user: JwtAccessPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.createTinkoffVisitPayment(user, orderId);
  }

  @Get('mine')
  @Roles(UserRole.Client)
  listMine(@CurrentUser() user: JwtAccessPayload) {
    return this.ordersService.listMine(user.sub);
  }

  @Get('visit-sale-catalog')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Услуги и товары студии для счёта после приёма (касса)' })
  visitSaleCatalog(
    @CurrentUser() user: JwtAccessPayload,
    @Query('studioId', new ParseUUIDPipe({ version: '4' })) studioId: string,
  ) {
    return this.ordersService.getVisitSaleCatalog(user, studioId);
  }

  @Get('visit-invoice/by-appointment/:appointmentId')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Активный счёт после приёма по визиту (если выставлен)' })
  getVisitInvoiceByAppointment(
    @CurrentUser() user: JwtAccessPayload,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
  ) {
    return this.ordersService
      .getVisitInvoiceOrderForAppointment(user, appointmentId)
      .then((order) => ({ order }));
  }

  @Get(':orderId')
  @Roles(UserRole.Client)
  getOne(@CurrentUser() user: JwtAccessPayload, @Param('orderId') orderId: string) {
    return this.ordersService.getMine(user.sub, orderId);
  }

  @Post(':orderId/payments')
  @Roles(UserRole.Client)
  createPayment(
    @CurrentUser() user: JwtAccessPayload,
    @Param('orderId') orderId: string,
    @Body() body: CreateOrderPaymentDto,
  ) {
    return this.paymentsService.createPaymentForOrder(user, orderId, body);
  }

  @Patch(':orderId/shipment')
  @Roles(...COMMERCE_STAFF_ROLES)
  @ApiOperation({ summary: 'Обновить статус доставки по заказу' })
  patchShipment(
    @CurrentUser() user: JwtAccessPayload,
    @Param('orderId') orderId: string,
    @Body() body: PatchShipmentDto,
  ) {
    return this.shipmentsService.patchForOrder(user, orderId, body);
  }
}
