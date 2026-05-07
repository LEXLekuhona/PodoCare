/* eslint-disable import/order */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateStudioServiceDto } from '../presentation/dto/create-studio-service.dto';
import type { UpdateStudioServiceDto } from '../presentation/dto/update-studio-service.dto';

function isFkViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';
}

@Injectable()
export class AdminStudioServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStudioAdminStudioId(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studioId: true },
    });
    if (!u?.studioId) {
      throw new ForbiddenException('Администратору студии не назначена студия');
    }
    return u.studioId;
  }

  private async assertCanAccessStudio(user: JwtAccessPayload, studioId: string): Promise<void> {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId }, select: { id: true } });
    if (!studio) {
      throw new NotFoundException(`Студия ${studioId} не найдена`);
    }
    if (user.role === UserRole.StudioAdmin) {
      const my = await this.getStudioAdminStudioId(user.sub);
      if (my !== studioId) throw new ForbiddenException();
    } else if (user.role !== UserRole.SuperAdmin && user.role !== UserRole.NetworkOwner) {
      throw new ForbiddenException();
    }
  }

  async list(user: JwtAccessPayload, studioId: string) {
    await this.assertCanAccessStudio(user, studioId);
    return this.prisma.service.findMany({
      where: { studioId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(user: JwtAccessPayload, studioId: string, serviceId: string) {
    await this.assertCanAccessStudio(user, studioId);
    const row = await this.prisma.service.findFirst({
      where: { id: serviceId, studioId },
    });
    if (!row) throw new NotFoundException(`Услуга ${serviceId} не найдена в этой студии`);
    return row;
  }

  async create(user: JwtAccessPayload, studioId: string, dto: CreateStudioServiceDto) {
    await this.assertCanAccessStudio(user, studioId);
    const currency = (dto.currency ?? 'RUB').trim() || 'RUB';
    const prepaymentRequired = dto.prepaymentRequired ?? false;
    const prepaymentMinor =
      prepaymentRequired && dto.prepaymentRubles != null ? dto.prepaymentRubles * 100 : null;

    // Проверяем существование категории, если указана
    if (dto.categoryId) {
      const cat = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!cat) throw new NotFoundException(`Категория ${dto.categoryId} не найдена`);
    }

    return this.prisma.service.create({
      data: {
        studioId,
        categoryId: dto.categoryId ?? null,
        name: dto.name.trim(),
        description: dto.description?.trim() ? dto.description.trim() : null,
        durationMinutes: dto.durationMinutes,
        priceMinor: dto.priceRubles * 100,
        currency,
        prepaymentRequired,
        prepaymentMinor,
        imageUrl: dto.imageUrl?.trim() ? dto.imageUrl.trim() : null,
        requiresConsultation: dto.requiresConsultation ?? false,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(user: JwtAccessPayload, studioId: string, serviceId: string, dto: UpdateStudioServiceDto) {
    await this.getById(user, studioId, serviceId);

    // Проверяем существование категории, если указана
    if (dto.categoryId) {
      const cat = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!cat) throw new NotFoundException(`Категория ${dto.categoryId} не найдена`);
    }

    const data: Prisma.ServiceUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) {
      data.description = dto.description.trim() === '' ? null : dto.description.trim();
    }
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.priceRubles !== undefined) data.priceMinor = dto.priceRubles * 100;
    if (dto.currency !== undefined) data.currency = dto.currency.trim() || 'RUB';
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl.trim() === '' ? null : dto.imageUrl.trim();
    }
    if (dto.requiresConsultation !== undefined) data.requiresConsultation = dto.requiresConsultation;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true };
    }

    if (dto.prepaymentRequired !== undefined) {
      data.prepaymentRequired = dto.prepaymentRequired;
      if (!dto.prepaymentRequired) {
        data.prepaymentMinor = null;
      }
    }
    if (dto.prepaymentRubles !== undefined) {
      data.prepaymentMinor = dto.prepaymentRubles * 100;
    }

    try {
      return await this.prisma.service.update({
        where: { id: serviceId },
        data,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Услуга ${serviceId} не найдена`);
      }
      throw e;
    }
  }

  async delete(user: JwtAccessPayload, studioId: string, serviceId: string) {
    await this.getById(user, studioId, serviceId);
    try {
      await this.prisma.service.delete({ where: { id: serviceId } });
      return { ok: true };
    } catch (e) {
      if (isFkViolation(e)) {
        throw new ConflictException('Нельзя удалить услугу: есть связанные записи');
      }
      throw e;
    }
  }
}
