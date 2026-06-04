import { Injectable, NotFoundException } from '@nestjs/common';
import { ShipmentStatus, type Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { MonetizationAccessService } from './monetization-access.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { PatchShipmentDto } from '../presentation/dto/patch-shipment.dto';

type HistoryEntry = { at: string; status: string; note?: string };

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MonetizationAccessService,
  ) {}

  async patchForOrder(actor: JwtAccessPayload, orderId: string, dto: PatchShipmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: true },
    });
    if (!order?.shipment) {
      throw new NotFoundException('Отправление не найдено');
    }
    await this.access.assertStaffForOrderStudio(actor, order.studioId);

    const history = [...((order.shipment.statusHistory as unknown as HistoryEntry[]) ?? [])];
    if (dto.status && dto.status !== order.shipment.status) {
      history.push({
        at: new Date().toISOString(),
        status: dto.status,
        note: dto.note,
      });
    }

    const now = new Date();
    return this.prisma.shipment.update({
      where: { id: order.shipment.id },
      data: {
        status: dto.status ?? undefined,
        carrier: dto.carrier === undefined ? undefined : dto.carrier,
        trackingNumber: dto.trackingNumber === undefined ? undefined : dto.trackingNumber,
        statusHistory: history as Prisma.InputJsonValue,
        shippedAt:
          dto.status === ShipmentStatus.HANDED_TO_CARRIER || dto.status === ShipmentStatus.IN_TRANSIT
            ? now
            : undefined,
        deliveredAt: dto.status === ShipmentStatus.DELIVERED ? now : undefined,
      },
    });
  }
}
