import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
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
    let filterByServiceCategoryId: string | null | undefined;
    const raw = serviceId?.trim();
    if (raw) {
      if (!UUID_QUERY_RE.test(raw)) {
        throw new BadRequestException('Некорректный идентификатор услуги');
      }
      const svc = await this.prisma.service.findFirst({
        where: { id: raw, studioId, isActive: true },
        select: { id: true, categoryId: true },
      });
      if (!svc) {
        throw new BadRequestException('Услуга не найдена в этой студии');
      }
      filterByServiceId = svc.id;
      filterByServiceCategoryId = svc.categoryId;
    }

    const rows = await this.prisma.specialistProfile.findMany({
      where: {
        isAcceptingNew: true,
        studios: { some: { studioId } },
        ...(filterByServiceId
          ? {
              OR: [
                { services: { some: { serviceId: filterByServiceId } } },
                ...(filterByServiceCategoryId
                  ? [{ categories: { some: { categoryId: filterByServiceCategoryId } } }]
                  : []),
              ],
            }
          : {}),
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

  async listProducts(studioId: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    const rows = await this.prisma.physicalGood.findMany({
      where: { networkId: studio.networkId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        brand: true,
        category: { select: { name: true } },
        imageUrls: true,
        priceMinor: true,
        currency: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      category: row.category.name,
    }));
  }

  async listHealthConcerns() {
    return this.prisma.healthConcern.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        iconUrl: true,
      },
    });
  }

  async getHealthConcernBySlug(slug: string) {
    const row = await this.prisma.healthConcern.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        iconUrl: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Жалоба не найдена');
    }
    return row;
  }

  async listStudioDirections() {
    return this.prisma.studioDirection.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        iconKey: true,
      },
    });
  }

  async getStudioDirectionBySlug(slug: string) {
    const row = await this.prisma.studioDirection.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        iconKey: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Направление не найдено');
    }
    return row;
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
    const specialistCapabilities = await this.prisma.specialistProfile.findUnique({
      where: { id: specialistId },
      select: {
        services: { select: { serviceId: true } },
        categories: { select: { categoryId: true } },
      },
    });

    const serviceIds = specialistCapabilities?.services.map((x) => x.serviceId) ?? [];
    const categoryIds = specialistCapabilities?.categories.map((x) => x.categoryId) ?? [];
    if (serviceIds.length === 0 && categoryIds.length === 0) {
      return [];
    }

    return this.prisma.service.findMany({
      where: {
        studioId,
        isActive: true,
        OR: [
          ...(serviceIds.length > 0 ? [{ id: { in: serviceIds } }] : []),
          ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : []),
        ],
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

