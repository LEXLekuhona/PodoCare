import { randomBytes } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- токен Nest DI
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateContentItemDto } from '../presentation/dto/create-content-item.dto';
import type { CreateContentSeriesDto } from '../presentation/dto/create-content-series.dto';
import type { CreateProgramDto } from '../presentation/dto/create-program.dto';
import type { ListContentItemQueryDto } from '../presentation/dto/list-content-item.query.dto';
import type { ListContentSeriesQueryDto } from '../presentation/dto/list-content-series.query.dto';
import type { ListProgramQueryDto } from '../presentation/dto/list-program.query.dto';
import type { UpdateContentItemDto } from '../presentation/dto/update-content-item.dto';
import type { UpdateContentSeriesDto } from '../presentation/dto/update-content-series.dto';
import type { UpdateProgramDto } from '../presentation/dto/update-program.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function slugBaseFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return base.length > 0 ? base : 'series';
}

function makeUniqueSlugPart(): string {
  return randomBytes(4).toString('hex');
}

@Injectable()
export class AdminEducationService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertNetworkExists(networkId: string): Promise<void> {
    const n = await this.prisma.network.findUnique({ where: { id: networkId }, select: { id: true } });
    if (!n) {
      throw new NotFoundException(`Сеть ${networkId} не найдена`);
    }
  }

  private async getStudioAdminNetworkId(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studio: { select: { networkId: true } } },
    });
    const nid = u?.studio?.networkId;
    if (!nid) {
      throw new ForbiddenException('Администратору студии не назначена студия или сеть');
    }
    return nid;
  }

  /** Для операций с явным networkId (create и т.д.). */
  private async assertNetworkScope(user: JwtAccessPayload, networkId: string): Promise<void> {
    if (user.role === UserRole.StudioAdmin) {
      const allowed = await this.getStudioAdminNetworkId(user.sub);
      if (allowed !== networkId) {
        throw new ForbiddenException('Недостаточно прав для этой сети');
      }
      return;
    }
    if (
      user.role === UserRole.SuperAdmin ||
      user.role === UserRole.NetworkOwner ||
      user.role === UserRole.ContentAuthor
    ) {
      return;
    }
    throw new ForbiddenException();
  }

  private async resolveListNetworkId(
    user: JwtAccessPayload,
    requested?: string,
  ): Promise<string | undefined> {
    if (user.role === UserRole.StudioAdmin) {
      return await this.getStudioAdminNetworkId(user.sub);
    }
    return requested;
  }

  // --- ContentSeries ---

  async listSeries(user: JwtAccessPayload, q: ListContentSeriesQueryDto) {
    const networkId = await this.resolveListNetworkId(user, q.networkId);
    const where: Prisma.ContentSeriesWhereInput = {};
    if (networkId) where.networkId = networkId;
    if (q.audience !== undefined) where.audience = q.audience;
    if (q.isPublished !== undefined) where.isPublished = q.isPublished;

    const [items, total] = await Promise.all([
      this.prisma.contentSeries.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: q.skip,
        take: q.take,
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.contentSeries.count({ where }),
    ]);
    return { items, total, skip: q.skip, take: q.take };
  }

  async getSeries(user: JwtAccessPayload, id: string) {
    const row = await this.prisma.contentSeries.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Серия не найдена');
    await this.assertNetworkScope(user, row.networkId);
    return row;
  }

  async createSeries(user: JwtAccessPayload, dto: CreateContentSeriesDto) {
    await this.assertNetworkExists(dto.networkId);
    await this.assertNetworkScope(user, dto.networkId);

    const slug =
      dto.slug?.trim() ??
      `${slugBaseFromTitle(dto.title)}-${makeUniqueSlugPart()}`;

    const isPub = dto.isPublished ?? false;
    try {
      return await this.prisma.contentSeries.create({
        data: {
          networkId: dto.networkId,
          authorUserId: user.sub,
          slug,
          title: dto.title,
          subtitle: dto.subtitle,
          description: dto.description,
          coverImageUrl: dto.coverImageUrl,
          audience: dto.audience,
          tags: dto.tags ?? [],
          priceMinor: dto.priceMinor ?? 0,
          currency: dto.currency ?? 'RUB',
          sortOrder: dto.sortOrder ?? 0,
          isPublished: isPub,
          publishedAt: isPub ? new Date() : null,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Серия с таким slug уже существует');
      }
      throw e;
    }
  }

  async updateSeries(user: JwtAccessPayload, id: string, dto: UpdateContentSeriesDto) {
    const existing = await this.prisma.contentSeries.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Серия не найдена');
    await this.assertNetworkScope(user, existing.networkId);

    const data: Prisma.ContentSeriesUpdateInput = {
      ...(dto.slug !== undefined && { slug: dto.slug.trim() }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
      ...(dto.audience !== undefined && { audience: dto.audience }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.priceMinor !== undefined && { priceMinor: dto.priceMinor }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
    };
    if (dto.isPublished === true && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
    if (dto.isPublished === false) {
      data.publishedAt = null;
    }

    try {
      return await this.prisma.contentSeries.update({
        where: { id },
        data,
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Серия с таким slug уже существует');
      }
      throw e;
    }
  }

  async deleteSeries(user: JwtAccessPayload, id: string) {
    const existing = await this.prisma.contentSeries.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Серия не найдена');
    await this.assertNetworkScope(user, existing.networkId);
    await this.prisma.contentSeries.delete({ where: { id } });
    return { ok: true as const };
  }

  // --- ContentItem ---

  async listItems(user: JwtAccessPayload, q: ListContentItemQueryDto) {
    const networkId = await this.resolveListNetworkId(user, q.networkId);
    const where: Prisma.ContentItemWhereInput = {};
    if (networkId) where.networkId = networkId;
    if (q.seriesId) where.seriesId = q.seriesId;
    if (q.format !== undefined) where.format = q.format;
    if (q.audience !== undefined) where.audience = q.audience;
    if (q.isPublished !== undefined) where.isPublished = q.isPublished;

    const [items, total] = await Promise.all([
      this.prisma.contentItem.findMany({
        where,
        orderBy: [{ seriesId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.contentItem.count({ where }),
    ]);
    return { items, total, skip: q.skip, take: q.take };
  }

  async getItem(user: JwtAccessPayload, id: string) {
    const row = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Материал не найден');
    await this.assertNetworkScope(user, row.networkId);
    return row;
  }

  async createItem(user: JwtAccessPayload, dto: CreateContentItemDto) {
    await this.assertNetworkExists(dto.networkId);
    await this.assertNetworkScope(user, dto.networkId);

    const series = await this.prisma.contentSeries.findUnique({ where: { id: dto.seriesId } });
    if (!series) throw new NotFoundException('Серия не найдена');
    if (series.networkId !== dto.networkId) {
      throw new ConflictException('Серия принадлежит другой сети');
    }

    const slug =
      dto.slug?.trim() ??
      `${slugBaseFromTitle(dto.title)}-${makeUniqueSlugPart()}`;

    const isPub = dto.isPublished ?? false;
    try {
      return await this.prisma.contentItem.create({
        data: {
          networkId: dto.networkId,
          seriesId: dto.seriesId,
          authorUserId: user.sub,
          slug,
          title: dto.title,
          description: dto.description,
          format: dto.format,
          audience: dto.audience ?? series.audience,
          body: dto.body,
          coverImageUrl: dto.coverImageUrl,
          durationSeconds: dto.durationSeconds,
          sortOrder: dto.sortOrder ?? 0,
          isFreePreview: dto.isFreePreview ?? false,
          tags: dto.tags ?? [],
          isPublished: isPub,
          publishedAt: isPub ? new Date() : null,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Материал с таким slug уже существует');
      }
      throw e;
    }
  }

  async updateItem(user: JwtAccessPayload, id: string, dto: UpdateContentItemDto) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Материал не найден');
    await this.assertNetworkScope(user, existing.networkId);

    try {
      return await this.prisma.contentItem.update({
        where: { id },
        data: {
          ...(dto.slug !== undefined && { slug: dto.slug.trim() }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.format !== undefined && { format: dto.format }),
          ...(dto.audience !== undefined && { audience: dto.audience }),
          ...(dto.body !== undefined && { body: dto.body }),
          ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
          ...(dto.durationSeconds !== undefined && { durationSeconds: dto.durationSeconds }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isFreePreview !== undefined && { isFreePreview: dto.isFreePreview }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
          ...(dto.isPublished === true && !existing.publishedAt ? { publishedAt: new Date() } : {}),
          ...(dto.isPublished === false ? { publishedAt: null } : {}),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Материал с таким slug уже существует');
      }
      throw e;
    }
  }

  async deleteItem(user: JwtAccessPayload, id: string) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Материал не найден');
    await this.assertNetworkScope(user, existing.networkId);
    await this.prisma.contentItem.delete({ where: { id } });
    return { ok: true as const };
  }

  // --- Program ---

  async listPrograms(user: JwtAccessPayload, q: ListProgramQueryDto) {
    const networkId = await this.resolveListNetworkId(user, q.networkId);
    const where: Prisma.ProgramWhereInput = {};
    if (networkId) where.networkId = networkId;
    if (q.isPublished !== undefined) where.isPublished = q.isPublished;

    const [items, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.program.count({ where }),
    ]);
    return { items, total, skip: q.skip, take: q.take };
  }

  async getProgram(user: JwtAccessPayload, id: string) {
    const row = await this.prisma.program.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Программа не найдена');
    await this.assertNetworkScope(user, row.networkId);
    return row;
  }

  async createProgram(user: JwtAccessPayload, dto: CreateProgramDto) {
    await this.assertNetworkExists(dto.networkId);
    await this.assertNetworkScope(user, dto.networkId);

    const slug = dto.slug?.trim() ?? `${slugBaseFromTitle(dto.title)}-${makeUniqueSlugPart()}`;
    const isPub = dto.isPublished ?? false;

    try {
      return await this.prisma.program.create({
        data: {
          networkId: dto.networkId,
          authorUserId: user.sub,
          slug,
          title: dto.title,
          subtitle: dto.subtitle,
          description: dto.description,
          durationDays: dto.durationDays,
          priceMinor: dto.priceMinor,
          currency: dto.currency ?? 'RUB',
          installmentAvailable: dto.installmentAvailable ?? true,
          coverImageUrl: dto.coverImageUrl,
          inclusions: dto.inclusions,
          stages: dto.stages,
          faq: dto.faq ?? Prisma.JsonNull,
          isPublished: isPub,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Программа с таким slug уже существует');
      }
      throw e;
    }
  }

  async updateProgram(user: JwtAccessPayload, id: string, dto: UpdateProgramDto) {
    const existing = await this.prisma.program.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Программа не найдена');
    await this.assertNetworkScope(user, existing.networkId);

    try {
      return await this.prisma.program.update({
        where: { id },
        data: {
          ...(dto.slug !== undefined && { slug: dto.slug.trim() }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
          ...(dto.priceMinor !== undefined && { priceMinor: dto.priceMinor }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.installmentAvailable !== undefined && { installmentAvailable: dto.installmentAvailable }),
          ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
          ...(dto.inclusions !== undefined && { inclusions: dto.inclusions }),
          ...(dto.stages !== undefined && { stages: dto.stages }),
          ...(dto.faq !== undefined && {
            faq: dto.faq === null ? Prisma.JsonNull : dto.faq,
          }),
          ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Программа с таким slug уже существует');
      }
      throw e;
    }
  }

  async deleteProgram(user: JwtAccessPayload, id: string) {
    const existing = await this.prisma.program.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Программа не найдена');
    await this.assertNetworkScope(user, existing.networkId);
    await this.prisma.program.delete({ where: { id } });
    return { ok: true as const };
  }
}
