import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  OrderStatus,
  ProductType,
  ShipmentStatus,
  type Prisma,
} from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { MonetizationAccessService } from './monetization-access.service';

import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CheckoutOrderDto } from '../presentation/dto/checkout-order.dto';
import type { CreateVisitInvoiceDto } from '../presentation/dto/create-visit-invoice.dto';

function makeOrderNumber(): string {
  return `SR-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();
}

const VISIT_INVOICE_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_CLIENT,
  AppointmentStatus.CANCELLED_BY_STUDIO,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.DRAFT,
];

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MonetizationAccessService,
  ) {}

  async checkout(userId: string, dto: CheckoutOrderDto) {
    if (!dto.items.length) {
      throw new BadRequestException('Корзина пуста');
    }

    let subtotalMinor = 0;
    const lineCreates: Prisma.OrderItemCreateWithoutOrderInput[] = [];

    for (const line of dto.items) {
      if (line.productType === ProductType.PHYSICAL_GOOD) {
        if (!line.physicalGoodId) {
          throw new BadRequestException('Для физического товара нужен physicalGoodId');
        }
        if (!dto.studioId) {
          throw new BadRequestException('Для физического товара укажите studioId');
        }
        const good = await this.prisma.physicalGood.findUnique({
          where: { id: line.physicalGoodId },
          select: {
            id: true,
            name: true,
            priceMinor: true,
            isActive: true,
            networkId: true,
          },
        });
        if (!good || !good.isActive) {
          throw new NotFoundException('Товар не найден');
        }
        const studio = await this.prisma.studio.findUnique({
          where: { id: dto.studioId },
          select: { id: true, networkId: true },
        });
        if (!studio || studio.networkId !== good.networkId) {
          throw new BadRequestException('Товар недоступен в выбранной студии');
        }
        const unit = good.priceMinor;
        const total = unit * line.quantity;
        subtotalMinor += total;
        lineCreates.push({
          productType: ProductType.PHYSICAL_GOOD,
          physicalGood: { connect: { id: good.id } },
          nameSnapshot: good.name,
          quantity: line.quantity,
          unitPriceMinor: unit,
          totalMinor: total,
        });
      } else {
        throw new BadRequestException('В checkout пока поддерживаются только физические товары');
      }
    }

    const shippingMinor = dto.shippingMinor ?? 0;
    const discountMinor = 0;
    const totalMinor = subtotalMinor - discountMinor + shippingMinor;

    const order = await this.prisma.order.create({
      data: {
        userId,
        studioId: dto.studioId ?? null,
        orderNumber: makeOrderNumber(),
        status: OrderStatus.AWAITING_PAYMENT,
        subtotalMinor,
        discountMinor,
        shippingMinor,
        totalMinor,
        deliveryMethod: dto.deliveryMethod ?? null,
        shippingAddressId: dto.shippingAddressId ?? null,
        appliedPromoCodeId: dto.appliedPromoCodeId ?? null,
        items: { create: lineCreates },
      },
      include: { items: true },
    });

    if (dto.deliveryMethod && dto.studioId) {
      await this.prisma.shipment.create({
        data: {
          orderId: order.id,
          method: dto.deliveryMethod,
          status: ShipmentStatus.NEW,
        },
      });
    }

    return order;
  }

  async createVisitInvoice(actor: JwtAccessPayload, dto: CreateVisitInvoiceDto) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        studioId: true,
        specialistId: true,
        clientUserId: true,
        walkInClientId: true,
        status: true,
      },
    });
    if (!appt) {
      throw new NotFoundException('Приём не найден');
    }
    if (!appt.clientUserId && !appt.walkInClientId) {
      throw new BadRequestException('У приёма должен быть клиент приложения или walk-in карточка');
    }
    if (appt.clientUserId && appt.walkInClientId) {
      throw new BadRequestException('Некорректные данные приёма: два типа клиента');
    }
    if (VISIT_INVOICE_BLOCKING_STATUSES.includes(appt.status)) {
      throw new BadRequestException('По этому приёму нельзя выставить счёт');
    }

    await this.access.assertStaffCanIssueVisitInvoice(actor, {
      studioId: appt.studioId,
      specialistId: appt.specialistId,
    });

    const existingActive = await this.prisma.order.findFirst({
      where: {
        appointmentId: appt.id,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
      select: { id: true },
    });
    if (existingActive) {
      throw new ConflictException('По этому приёму уже есть активный счёт');
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: appt.studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }

    let subtotalMinor = 0;
    const lineCreates: Prisma.OrderItemCreateWithoutOrderInput[] = [];

    for (const line of dto.items) {
      if (line.productType === ProductType.SERVICE) {
        if (!line.serviceId) {
          throw new BadRequestException('Для услуги укажите serviceId');
        }
        const service = await this.prisma.service.findUnique({
          where: { id: line.serviceId },
          select: {
            id: true,
            name: true,
            studioId: true,
            priceMinor: true,
            isActive: true,
          },
        });
        if (!service || !service.isActive) {
          throw new NotFoundException('Услуга не найдена');
        }
        if (service.studioId !== appt.studioId) {
          throw new BadRequestException('Услуга недоступна в студии этого приёма');
        }
        const unit = service.priceMinor;
        const total = unit * line.quantity;
        subtotalMinor += total;
        lineCreates.push({
          productType: ProductType.SERVICE,
          service: { connect: { id: service.id } },
          nameSnapshot: service.name,
          quantity: line.quantity,
          unitPriceMinor: unit,
          totalMinor: total,
        });
      } else if (line.productType === ProductType.PHYSICAL_GOOD) {
        if (!line.physicalGoodId) {
          throw new BadRequestException('Для товара укажите physicalGoodId');
        }
        const good = await this.prisma.physicalGood.findUnique({
          where: { id: line.physicalGoodId },
          select: {
            id: true,
            name: true,
            priceMinor: true,
            isActive: true,
            networkId: true,
            stock: true,
          },
        });
        if (!good || !good.isActive) {
          throw new NotFoundException('Товар не найден');
        }
        if (good.networkId !== studio.networkId) {
          throw new BadRequestException('Товар недоступен в этой студии');
        }
        const inv = await this.prisma.physicalGoodStudioInventory.findUnique({
          where: {
            goodId_studioId: { goodId: good.id, studioId: appt.studioId },
          },
          select: { isAvailable: true, stock: true, priceMinor: true },
        });
        if (inv && !inv.isAvailable) {
          throw new BadRequestException(`Товар «${good.name}» недоступен в студии`);
        }
        const unit = inv?.priceMinor ?? good.priceMinor;
        const total = unit * line.quantity;
        const stockEffective = inv?.stock ?? good.stock ?? null;
        if (stockEffective !== null && stockEffective < line.quantity) {
          throw new BadRequestException(`Недостаточно остатка: ${good.name}`);
        }
        subtotalMinor += total;
        lineCreates.push({
          productType: ProductType.PHYSICAL_GOOD,
          physicalGood: { connect: { id: good.id } },
          nameSnapshot: good.name,
          quantity: line.quantity,
          unitPriceMinor: unit,
          totalMinor: total,
        });
      }
    }

    const discountMinor = 0;
    const shippingMinor = 0;
    const totalMinor = subtotalMinor - discountMinor + shippingMinor;

    return this.prisma.order.create({
      data: {
        userId: appt.clientUserId,
        walkInClientId: appt.walkInClientId,
        studioId: appt.studioId,
        appointmentId: appt.id,
        staffInvoiceAuthorUserId: actor.sub,
        orderNumber: makeOrderNumber(),
        status: OrderStatus.AWAITING_PAYMENT,
        subtotalMinor,
        discountMinor,
        shippingMinor,
        totalMinor,
        customerNote: dto.customerNote?.trim() || null,
        items: { create: lineCreates },
      },
      include: { items: true },
    });
  }

  async getMine(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
        shipment: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }
    return order;
  }

  async listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, shipment: true },
    });
  }

  async getVisitSaleCatalog(actor: JwtAccessPayload, studioId: string) {
    await this.access.assertStaffForOrderStudio(actor, studioId);
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    const services = await this.prisma.service.findMany({
      where: { studioId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, priceMinor: true, durationMinutes: true },
    });
    const goods = await this.prisma.physicalGood.findMany({
      where: { networkId: studio.networkId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        priceMinor: true,
        stock: true,
        studioInventory: {
          where: { studioId },
          select: { stock: true, isAvailable: true, priceMinor: true },
        },
      },
    });
    const physicalGoods = goods
      .map((g) => {
        const inv = g.studioInventory[0];
        if (inv && !inv.isAvailable) {
          return null;
        }
        const unit = inv?.priceMinor ?? g.priceMinor;
        const stockEffective = inv?.stock ?? g.stock ?? null;
        if (stockEffective !== null && stockEffective < 1) {
          return null;
        }
        return {
          id: g.id,
          name: g.name,
          priceMinor: unit,
          stock: stockEffective,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
    return { services, physicalGoods };
  }

  async getVisitInvoiceOrderForAppointment(actor: JwtAccessPayload, appointmentId: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { studioId: true, specialistId: true },
    });
    if (!appt) {
      throw new NotFoundException('Приём не найден');
    }
    await this.access.assertStaffCanIssueVisitInvoice(actor, {
      studioId: appt.studioId,
      specialistId: appt.specialistId,
    });
    return this.prisma.order.findFirst({
      where: { appointmentId, status: { in: ACTIVE_ORDER_STATUSES } },
      include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 8 } },
    });
  }

}
