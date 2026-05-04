import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/** Как `validator.isUUID(str, 'loose')` — допускает любой 128-bit UUID в текстовой форме (как PostgreSQL). */
const UUID_QUERY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class StudiosService {
  constructor(private readonly prisma: PrismaService) {}

  async listSpecialists(studioId: string, serviceId?: string) {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId }, select: { id: true } });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }

    let filterByServiceId: string | undefined;
    const raw = serviceId?.trim();
    if (raw) {
      if (!UUID_QUERY_RE.test(raw)) {
        throw new BadRequestException('Некорректный идентификатор услуги');
      }
      const svc = await this.prisma.service.findFirst({
        where: { id: raw, studioId, isActive: true },
        select: { id: true },
      });
      if (!svc) {
        throw new BadRequestException('Услуга не найдена в этой студии');
      }
      filterByServiceId = svc.id;
    }

    const rows = await this.prisma.specialistProfile.findMany({
      where: {
        isAcceptingNew: true,
        studios: { some: { studioId } },
        ...(filterByServiceId ? { services: { some: { serviceId: filterByServiceId } } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        specializations: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      title: r.specializations[0] ?? 'Специалист',
    }));
  }

  async listServices(studioId: string) {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId }, select: { id: true } });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    return this.prisma.service.findMany({
      where: { studioId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceMinor: true,
        currency: true,
      },
    });
  }

  /** Услуги, которые указанный специалист выполняет в этой студии. */
  async listSpecialistServices(studioId: string, specialistId: string) {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId }, select: { id: true } });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }

    const specialist = await this.prisma.specialistProfile.findFirst({
      where: {
        id: specialistId,
        studios: { some: { studioId } },
      },
      select: { id: true },
    });
    if (!specialist) {
      throw new NotFoundException('Специалист не найден в указанной студии');
    }
    return this.prisma.service.findMany({
      where: {
        studioId,
        isActive: true,
        specialists: { some: { specialistId } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceMinor: true,
        currency: true,
      },
    });
  }

  async list() {
    const studios = await this.prisma.studio.findMany({
      where: { isActive: true },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
      },
    });
    return studios;
  }
}

