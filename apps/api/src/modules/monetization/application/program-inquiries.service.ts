import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProgramInquiryStatus, type Prisma } from '@prisma/client';
import { UserRole } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { MonetizationAccessService } from './monetization-access.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateProgramInquiryDto } from '../presentation/dto/create-program-inquiry.dto';
import type { PatchProgramInquiryDto } from '../presentation/dto/patch-program-inquiry.dto';

type ActivityEntry = { at: string; userId: string; action: string; note?: string };

@Injectable()
export class ProgramInquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MonetizationAccessService,
  ) {}

  async createForClient(userId: string, dto: CreateProgramInquiryDto) {
    const program = await this.prisma.program.findUnique({
      where: { id: dto.programId },
      select: { id: true, networkId: true, isPublished: true, title: true },
    });
    if (!program || !program.isPublished) {
      throw new NotFoundException('Программа не найдена или не опубликована');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, phone: true, email: true, role: true },
    });
    if (!user || user.role !== UserRole.Client) {
      throw new ForbiddenException('Доступно только клиентам');
    }

    const firstName = (dto.firstName ?? user.firstName).trim();
    const phone = (dto.phone ?? user.phone).trim();
    if (!firstName || !phone) {
      throw new BadRequestException('Укажите имя и телефон');
    }

    return this.prisma.programInquiry.create({
      data: {
        networkId: program.networkId,
        programId: program.id,
        clientUserId: user.id,
        firstName,
        phone,
        email: dto.email?.trim() || user.email,
        message: dto.message?.trim() || null,
        status: ProgramInquiryStatus.NEW,
      },
    });
  }

  async listMine(userId: string) {
    return this.prisma.programInquiry.findMany({
      where: { clientUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: { program: { select: { id: true, title: true, slug: true } } },
    });
  }

  async listForStaff(actor: JwtAccessPayload, params: { networkId?: string; status?: ProgramInquiryStatus }) {
    const where: Prisma.ProgramInquiryWhereInput = {};
    if (params.status) {
      where.status = params.status;
    }
    if (actor.role === UserRole.SuperAdmin) {
      if (params.networkId) {
        where.networkId = params.networkId;
      }
    } else {
      const actorUser = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { studio: { select: { networkId: true } } },
      });
      const nid = actorUser?.studio?.networkId;
      if (!nid) {
        throw new ForbiddenException('Пользователь не привязан к сети');
      }
      if (params.networkId && params.networkId !== nid) {
        throw new ForbiddenException('Нет доступа к этой сети');
      }
      where.networkId = nid;
    }

    return this.prisma.programInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        program: { select: { id: true, title: true, slug: true } },
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async patchForStaff(actor: JwtAccessPayload, id: string, dto: PatchProgramInquiryDto) {
    const inquiry = await this.prisma.programInquiry.findUnique({
      where: { id },
      include: { program: { select: { networkId: true } } },
    });
    if (!inquiry) {
      throw new NotFoundException('Заявка не найдена');
    }
    await this.access.assertStaffForNetwork(actor, inquiry.program.networkId);

    const log = [...((inquiry.activityLog as unknown as ActivityEntry[]) ?? [])];
    if (dto.note?.trim()) {
      log.push({
        at: new Date().toISOString(),
        userId: actor.sub,
        action: 'note',
        note: dto.note.trim(),
      });
    }
    if (dto.status !== undefined && dto.status !== inquiry.status) {
      log.push({
        at: new Date().toISOString(),
        userId: actor.sub,
        action: `status:${dto.status}`,
      });
    }
    if (dto.assignedUserId !== undefined && dto.assignedUserId !== inquiry.assignedUserId) {
      log.push({
        at: new Date().toISOString(),
        userId: actor.sub,
        action: dto.assignedUserId ? `assign:${dto.assignedUserId}` : 'unassign',
      });
    }

    return this.prisma.programInquiry.update({
      where: { id },
      data: {
        status: dto.status,
        assignedUserId: dto.assignedUserId === undefined ? undefined : dto.assignedUserId,
        activityLog: log as Prisma.InputJsonValue,
        ...(dto.status === ProgramInquiryStatus.CONVERTED ? { convertedAt: new Date() } : {}),
      },
    });
  }
}
