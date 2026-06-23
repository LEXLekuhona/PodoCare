import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ProductType,
  type Prisma,
} from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { MonetizationAccessService } from './monetization-access.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { CryptoService } from '../../../infrastructure/crypto/crypto.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateOrderPaymentDto } from '../presentation/dto/create-order-payment.dto';
import type { RefundPaymentDto } from '../presentation/dto/refund-payment.dto';

type YooNotification = {
  type?: string;
  event?: string;
  object?: { id?: string; status?: string; amount?: { value?: string; currency?: string } };
};

/** Подпись запроса/уведомления Т‑Банк (эквайринг): SHA-256 от конкатенации значений по алфавиту ключей + Password. */
export function buildTinkoffToken(payload: Record<string, unknown>, password: string): string {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'Token') continue;
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'object') continue;
    flat[k] = String(v);
  }
  flat.Password = password;
  const keys = Object.keys(flat).sort();
  const concatenated = keys.map((k) => flat[k]).join('');
  return createHash('sha256').update(concatenated).digest('hex');
}

type TinkoffInitResponse = {
  Success?: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  TerminalKey?: string;
  Amount?: number;
  OrderId?: string;
  PaymentId?: string;
  PaymentURL?: string;
  Status?: string;
};

type TinkoffNotificationBody = {
  TerminalKey?: string;
  OrderId?: string;
  Success?: boolean;
  Status?: string;
  PaymentId?: string;
  Amount?: number;
  ErrorCode?: string;
  Message?: string;
  Token?: string;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MonetizationAccessService,
    private readonly crypto: CryptoService,
  ) {}

  /** Приоритет: терминал студии → платформенный → переменные окружения. */
  private async resolveTinkoffCredentials(studioId: string | null): Promise<{
    terminalKey: string;
    password: string;
    notificationUrl?: string;
    deviceDataJson?: string;
  } | null> {
    const fromDbStudio = studioId
      ? await this.prisma.acquiringTerminal.findFirst({
          where: { provider: PaymentProvider.TINKOFF, isActive: true, studioId },
          orderBy: { updatedAt: 'desc' },
        })
      : null;
    const fromDbPlatform = await this.prisma.acquiringTerminal.findFirst({
      where: { provider: PaymentProvider.TINKOFF, isActive: true, studioId: null },
      orderBy: { updatedAt: 'desc' },
    });
    const row = fromDbStudio ?? fromDbPlatform;
    if (row) {
      const password = this.crypto.decrypt({
        cipherText: Buffer.from(row.secretCipherText),
        iv: Buffer.from(row.secretIv),
        authTag: Buffer.from(row.secretAuthTag),
        keyVersion: 1,
      });
      const notificationUrl =
        row.notificationUrl?.trim() || process.env.TINKOFF_NOTIFICATION_URL?.trim() || undefined;
      const deviceDataJson =
        row.deviceDataJson?.trim() || process.env.TINKOFF_TERMINAL_DATA_JSON?.trim() || undefined;
      return {
        terminalKey: row.publicId.trim(),
        password,
        notificationUrl,
        deviceDataJson,
      };
    }
    const terminalKey = process.env.TINKOFF_TERMINAL_KEY?.trim();
    const password = process.env.TINKOFF_PASSWORD;
    if (terminalKey && password) {
      return {
        terminalKey,
        password,
        notificationUrl: process.env.TINKOFF_NOTIFICATION_URL?.trim(),
        deviceDataJson: process.env.TINKOFF_TERMINAL_DATA_JSON?.trim(),
      };
    }
    return null;
  }

  private async isTinkoffWebhookTokenValid(body: TinkoffNotificationBody): Promise<boolean> {
    if (!body.Token) {
      return true;
    }
    const terminalKey = body.TerminalKey != null ? String(body.TerminalKey) : '';
    const payload = body as Record<string, unknown>;
    if (terminalKey) {
      const rows = await this.prisma.acquiringTerminal.findMany({
        where: { provider: PaymentProvider.TINKOFF, isActive: true, publicId: terminalKey },
      });
      for (const row of rows) {
        try {
          const password = this.crypto.decrypt({
            cipherText: Buffer.from(row.secretCipherText),
            iv: Buffer.from(row.secretIv),
            authTag: Buffer.from(row.secretAuthTag),
            keyVersion: 1,
          });
          if (buildTinkoffToken(payload, password) === body.Token) {
            return true;
          }
        } catch {
          /* неверный ключ шифрования / данные */
        }
      }
    }
    const envPass = process.env.TINKOFF_PASSWORD;
    const envKey = process.env.TINKOFF_TERMINAL_KEY?.trim();
    if (envPass && envKey && terminalKey === envKey) {
      return buildTinkoffToken(payload, envPass) === body.Token;
    }
    return false;
  }

  async createPaymentForOrder(actor: JwtAccessPayload, orderId: string, dto: CreateOrderPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        totalMinor: true,
        currency: true,
        orderNumber: true,
        studioId: true,
        appointmentId: true,
      },
    });
    if (!order || order.userId !== actor.sub) {
      throw new NotFoundException('Заказ не найден');
    }
    if (order.appointmentId) {
      throw new BadRequestException('Счёт после приёма оплачивается в студии');
    }
    if (order.status !== OrderStatus.AWAITING_PAYMENT && order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Заказ не ожидает оплаты');
    }

    const idempotencyKey = dto.idempotencyKey?.trim() || `order-pay-${orderId}-${randomUUID()}`;

    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId,
        idempotencyKey,
      },
    });
    if (existing && existing.status === PaymentStatus.SUCCEEDED) {
      return existing;
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secret = process.env.YOOKASSA_SECRET_KEY;

    if (shopId && secret && dto.method !== PaymentMethod.IN_STUDIO) {
      const basic = Buffer.from(`${shopId}:${secret}`).toString('base64');
      const value = (order.totalMinor / 100).toFixed(2);
      const returnUrl = process.env.YOOKASSA_RETURN_URL ?? 'https://example.com/pay/done';
      const res = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotencyKey,
        },
        body: JSON.stringify({
          amount: { value, currency: order.currency || 'RUB' },
          capture: true,
          confirmation: { type: 'redirect', return_url: returnUrl },
          description: `Заказ ${order.orderNumber}`,
          metadata: { orderId: order.id },
        }),
      });
      const json = (await res.json()) as {
        id?: string;
        status?: string;
        confirmation?: { confirmation_url?: string };
        description?: string;
      };
      if (!res.ok) {
        this.logger.warn(`YooKassa create payment failed: ${JSON.stringify(json)}`);
        throw new BadRequestException(json.description ?? 'Не удалось создать платёж');
      }
      return this.prisma.payment.create({
        data: {
          orderId,
          provider: PaymentProvider.YOOKASSA,
          method: dto.method,
          status:
            json.status === 'pending'
              ? PaymentStatus.PROCESSING
              : json.status === 'succeeded'
                ? PaymentStatus.SUCCEEDED
                : PaymentStatus.PENDING,
          amountMinor: order.totalMinor,
          currency: order.currency || 'RUB',
          providerTxId: json.id,
          confirmationUrl: json.confirmation?.confirmation_url,
          idempotencyKey,
          providerPayload: json as Prisma.InputJsonValue,
          completedAt: json.status === 'succeeded' ? new Date() : null,
        },
      });
    }

    const providerTxId = randomUUID();
    return this.prisma.payment.create({
      data: {
        orderId,
        provider: PaymentProvider.MANUAL,
        method: dto.method,
        status: PaymentStatus.PENDING,
        amountMinor: order.totalMinor,
        currency: order.currency || 'RUB',
        providerTxId,
        idempotencyKey,
      },
    });
  }

  async handleYooKassaWebhook(rawBody: unknown): Promise<{ ok: true; duplicate?: boolean }> {
    const body = rawBody as YooNotification;
    if (body?.type !== 'notification' || !body.event || !body.object?.id) {
      return { ok: true };
    }

    const externalId = `${body.event}:${body.object.id}`;
    try {
      await this.prisma.processedProviderWebhook.create({
        data: {
          provider: PaymentProvider.YOOKASSA,
          externalId,
        },
      });
    } catch {
      return { ok: true, duplicate: true };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { provider: PaymentProvider.YOOKASSA, providerTxId: body.object.id },
      include: { order: true },
    });
    if (!payment) {
      this.logger.warn(`YooKassa webhook: payment not found for ${body.object.id}`);
      return { ok: true };
    }

    if (body.event === 'payment.succeeded' && body.object.status === 'succeeded') {
      await this.finalizeSuccessfulPayment(payment.id);
    }
    if (body.event === 'payment.canceled') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELLED, completedAt: new Date() },
      });
    }

    return { ok: true };
  }

  private async finalizeSuccessfulPayment(paymentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { orderId: true },
      });
      if (!existing) {
        return;
      }
      const orderRow = await tx.order.findUnique({
        where: { id: existing.orderId },
        select: { status: true },
      });
      const alreadyPaid = orderRow?.status === OrderStatus.PAID;

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCEEDED,
          completedAt: new Date(),
        },
      });
      if (alreadyPaid) {
        return;
      }
      await tx.order.update({
        where: { id: existing.orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
        },
      });
      await this.consumePhysicalGoodsStockTx(tx, existing.orderId);
    });
  }

  private async consumePhysicalGoodsStockTx(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        studioId: true,
        items: {
          where: { productType: ProductType.PHYSICAL_GOOD },
          select: { quantity: true, physicalGoodId: true },
        },
      },
    });
    if (!order?.studioId) {
      return;
    }
    for (const item of order.items) {
      if (!item.physicalGoodId) continue;
      const inv = await tx.physicalGoodStudioInventory.findUnique({
        where: {
          goodId_studioId: { goodId: item.physicalGoodId, studioId: order.studioId },
        },
      });
      if (inv?.stock != null) {
        await tx.physicalGoodStudioInventory.update({
          where: { id: inv.id },
          data: { stock: { decrement: item.quantity } },
        });
      } else {
        const good = await tx.physicalGood.findUnique({
          where: { id: item.physicalGoodId },
          select: { stock: true },
        });
        if (good?.stock != null) {
          await tx.physicalGood.update({
            where: { id: item.physicalGoodId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
    }
  }

  async recordVisitCashPayment(actor: JwtAccessPayload, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        studioId: true,
        appointmentId: true,
        status: true,
        totalMinor: true,
        currency: true,
        appointment: { select: { studioId: true, specialistId: true } },
      },
    });
    if (!order?.appointmentId) {
      throw new BadRequestException('Это не счёт после приёма');
    }
    if (order.appointment) {
      await this.access.assertStaffCanIssueVisitInvoice(actor, order.appointment);
    } else {
      await this.access.assertStaffForOrderStudio(actor, order.studioId);
    }
    if (order.status !== OrderStatus.AWAITING_PAYMENT && order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Заказ не ожидает оплаты');
    }
    const existingPaid = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: PaymentStatus.SUCCEEDED },
      select: { id: true },
    });
    if (existingPaid) {
      throw new BadRequestException('Заказ уже оплачен');
    }

    const pay = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.MANUAL,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCEEDED,
        amountMinor: order.totalMinor,
        currency: order.currency || 'RUB',
        providerTxId: randomUUID(),
        completedAt: new Date(),
      },
    });
    await this.finalizeSuccessfulPayment(pay.id);
    return this.prisma.payment.findUnique({ where: { id: pay.id } });
  }

  async createTinkoffVisitPayment(actor: JwtAccessPayload, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        studioId: true,
        appointmentId: true,
        status: true,
        totalMinor: true,
        currency: true,
        orderNumber: true,
        appointment: { select: { studioId: true, specialistId: true } },
      },
    });
    if (!order?.appointmentId) {
      throw new BadRequestException('Это не счёт после приёма');
    }
    if (order.appointment) {
      await this.access.assertStaffCanIssueVisitInvoice(actor, order.appointment);
    } else {
      await this.access.assertStaffForOrderStudio(actor, order.studioId);
    }
    if (order.status !== OrderStatus.AWAITING_PAYMENT && order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Заказ не ожидает оплаты');
    }

    const inflight = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        provider: PaymentProvider.TINKOFF,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      },
    });
    if (inflight) {
      return inflight;
    }

    const existingPaid = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: PaymentStatus.SUCCEEDED },
      select: { id: true },
    });
    if (existingPaid) {
      throw new BadRequestException('Заказ уже оплачен');
    }

    const studioForTerminal = order.studioId ?? order.appointment?.studioId ?? null;
    const creds = await this.resolveTinkoffCredentials(studioForTerminal);
    if (!creds) {
      throw new BadRequestException(
        'Тинькофф Эквайринг не настроен: добавьте терминал в админке (SuperAdmin) или задайте TINKOFF_TERMINAL_KEY / TINKOFF_PASSWORD',
      );
    }
    const { terminalKey, password, notificationUrl, deviceDataJson: deviceData } = creds;

    const body: Record<string, unknown> = {
      TerminalKey: terminalKey,
      Amount: order.totalMinor,
      OrderId: order.id,
      Description: `Счёт ${order.orderNumber}`,
      PayType: 'O',
      Language: 'ru',
    };
    if (notificationUrl) {
      body.NotificationURL = notificationUrl;
    }
    if (deviceData) {
      body.DATA = deviceData;
    }
    body.Token = buildTinkoffToken(body, password);

    const res = await fetch('https://securepay.tinkoff.ru/v2/Init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as TinkoffInitResponse;
    if (!res.ok || json.Success === false) {
      this.logger.warn(`Tinkoff Init failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(json.Message ?? json.Details ?? 'Не удалось создать платёж Тинькофф');
    }
    if (!json.PaymentId) {
      throw new BadRequestException('Тинькофф не вернул PaymentId');
    }

    const status =
      json.Status === 'CONFIRMED'
        ? PaymentStatus.SUCCEEDED
        : json.Status === 'REJECTED'
          ? PaymentStatus.FAILED
          : PaymentStatus.PROCESSING;

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.TINKOFF,
        method: PaymentMethod.CARD,
        status,
        amountMinor: order.totalMinor,
        currency: order.currency || 'RUB',
        providerTxId: String(json.PaymentId),
        confirmationUrl: json.PaymentURL ?? null,
        providerPayload: json as Prisma.InputJsonValue,
        completedAt: status === PaymentStatus.SUCCEEDED ? new Date() : null,
      },
    });

    if (status === PaymentStatus.SUCCEEDED) {
      await this.finalizeSuccessfulPayment(payment.id);
    }

    return this.prisma.payment.findUnique({ where: { id: payment.id } });
  }

  async handleTinkoffWebhook(rawBody: unknown): Promise<{ ok: true; duplicate?: boolean }> {
    const body = rawBody as TinkoffNotificationBody;
    if (!body?.PaymentId || !body.TerminalKey) {
      return { ok: true };
    }

    const tokenOk = await this.isTinkoffWebhookTokenValid(body);
    if (!tokenOk) {
      this.logger.warn('Tinkoff webhook: invalid or missing token');
      return { ok: true };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { provider: PaymentProvider.TINKOFF, providerTxId: String(body.PaymentId) },
      include: { order: true },
    });
    if (!payment) {
      this.logger.warn(`Tinkoff webhook: payment not found for ${body.PaymentId}`);
      return { ok: true };
    }

    if (body.Success === false || body.Status === 'REJECTED' || body.Status === 'CANCELED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          completedAt: new Date(),
          errorCode: body.ErrorCode ?? null,
          errorMessage: body.Message ?? null,
        },
      });
      return { ok: true };
    }

    if (body.Status !== 'CONFIRMED') {
      return { ok: true };
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      return { ok: true };
    }

    const externalId = `tinkoff:confirmed:${body.PaymentId}`;
    try {
      await this.prisma.processedProviderWebhook.create({
        data: {
          provider: PaymentProvider.TINKOFF,
          externalId,
        },
      });
    } catch {
      return { ok: true, duplicate: true };
    }

    await this.finalizeSuccessfulPayment(payment.id);
    return { ok: true };
  }

  async refund(actor: JwtAccessPayload, paymentId: string, dto: RefundPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) {
      throw new NotFoundException('Платёж не найден');
    }
    await this.access.assertStaffForOrderStudio(actor, payment.order.studioId);

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException('Возможен возврат только успешного платежа');
    }

    const remaining = payment.amountMinor - payment.refundedMinor;
    const amount = dto.amountMinor ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException('Некорректная сумма возврата');
    }

    const nextRefunded = payment.refundedMinor + amount;
    const nextPaymentStatus =
      nextRefunded >= payment.amountMinor ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          refundedMinor: nextRefunded,
          status: nextPaymentStatus,
        },
      });
      if (nextPaymentStatus === PaymentStatus.REFUNDED) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.REFUNDED },
        });
      }
    });

    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }
}
