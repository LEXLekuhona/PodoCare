import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InstallmentRequestStatus, type Prisma } from '@prisma/client';
import { UserRole } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { MonetizationAccessService } from './monetization-access.service';

import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateInstallmentRequestDto } from '../presentation/dto/create-installment-request.dto';
import type { PatchInstallmentRequestDto } from '../presentation/dto/patch-installment-request.dto';

@Injectable()
export class InstallmentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MonetizationAccessService,
  ) {}

  async createForClient(userId: string, dto: CreateInstallmentRequestDto) {
    if (!dto.programId && !dto.orderId) {
      throw new BadRequestException('Нужен programId или orderId');
    }
    if (dto.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: dto.programId },
        select: { id: true, installmentAvailable: true, isPublished: true, priceMinor: true },
      });
      if (!program || !program.isPublished) {
        throw new NotFoundException('Программа не найдена');
      }
      if (!program.installmentAvailable) {
        throw new BadRequestException('Рассрочка для этой программы недоступна');
      }
    }
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: { id: true, userId: true },
      });
      if (!order || order.userId !== userId) {
        throw new NotFoundException('Заказ не найден');
      }
    }

    return this.prisma.installmentRequest.create({
      data: {
        userId,
        programId: dto.programId ?? null,
        orderId: dto.orderId ?? null,
        provider: dto.provider,
        amountMinor: dto.amountMinor,
        termMonths: dto.termMonths,
        status: InstallmentRequestStatus.SUBMITTED,
        monthlyPaymentMinor: Math.ceil(dto.amountMinor / dto.termMonths),
      },
    });
  }

  async listMine(userId: string) {
    return this.prisma.installmentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { program: { select: { id: true, title: true } } },
    });
  }

  async listForStaff(actor: JwtAccessPayload, networkIdParam?: string) {
    const buildWhere = (networkId: string): Prisma.InstallmentRequestWhereInput => ({
      program: { networkId },
    });

    if (actor.role === UserRole.SuperAdmin) {
      if (!networkIdParam) {
        return this.prisma.installmentRequest.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            program: { select: { id: true, title: true, networkId: true } },
          },
        });
      }
      return this.prisma.installmentRequest.findMany({
        where: buildWhere(networkIdParam),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          program: { select: { id: true, title: true, networkId: true } },
        },
      });
    }

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { studio: { select: { networkId: true } } },
    });
    const nid = networkIdParam ?? actorUser?.studio?.networkId;
    if (!nid) {
      throw new ForbiddenException('Пользователь не привязан к сети');
    }
    if (networkIdParam && networkIdParam !== actorUser?.studio?.networkId) {
      throw new ForbiddenException('Нет доступа к этой сети');
    }

    return this.prisma.installmentRequest.findMany({
      where: buildWhere(nid),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        program: { select: { id: true, title: true, networkId: true } },
      },
    });
  }

  async patchForStaff(actor: JwtAccessPayload, id: string, dto: PatchInstallmentRequestDto) {
    const row = await this.prisma.installmentRequest.findUnique({
      where: { id },
      include: { program: { select: { networkId: true } } },
    });
    if (!row) {
      throw new NotFoundException('Заявка не найдена');
    }
    if (row.program?.networkId) {
      await this.access.assertStaffForNetwork(actor, row.program.networkId);
    } else if (row.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: row.orderId },
        select: { studioId: true },
      });
      await this.access.assertStaffForOrderStudio(actor, order?.studioId ?? null);
    } else if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Нет данных для проверки доступа');
    }

    const now = new Date();
    return this.prisma.installmentRequest.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason: dto.rejectionReason === undefined ? undefined : dto.rejectionReason,
        providerRequestId: dto.providerRequestId === undefined ? undefined : dto.providerRequestId,
        approvedAt: dto.status === InstallmentRequestStatus.APPROVED ? now : undefined,
        activatedAt: dto.status === InstallmentRequestStatus.ACTIVE ? now : undefined,
        completedAt: dto.status === InstallmentRequestStatus.COMPLETED ? now : undefined,
      },
    });
  }
}
