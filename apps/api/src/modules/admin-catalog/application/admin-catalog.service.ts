import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@srs/shared-types';
import { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- токен Nest DI
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateFaqItemDto } from '../presentation/dto/create-faq-item.dto';
import type { CreateHealthConcernDto } from '../presentation/dto/create-health-concern.dto';
import type { CreateStudioDirectionDto } from '../presentation/dto/create-studio-direction.dto';
import type { CreateNetworkDto } from '../presentation/dto/create-network.dto';
import type { CreateStudioDto } from '../presentation/dto/create-studio.dto';
import type { ListStudiosQueryDto } from '../presentation/dto/list-studios.query.dto';
import type { UpdateFaqItemDto } from '../presentation/dto/update-faq-item.dto';
import type { UpdateHealthConcernDto } from '../presentation/dto/update-health-concern.dto';
import type { UpdateStudioDirectionDto } from '../presentation/dto/update-studio-direction.dto';
import type { UpdateNetworkDto } from '../presentation/dto/update-network.dto';
import type { UpdateStudioDto } from '../presentation/dto/update-studio.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function isFkViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';
}

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private isElevated(user: JwtAccessPayload): boolean {
    return user.role === UserRole.SuperAdmin || user.role === UserRole.NetworkOwner;
  }

  private assertElevatedCatalog(user: JwtAccessPayload): void {
    if (!this.isElevated(user)) {
      throw new ForbiddenException('Только SuperAdmin или NetworkOwner');
    }
  }

  private async getStudioAdminStudioNetwork(userId: string): Promise<{ studioId: string; networkId: string }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studioId: true, studio: { select: { networkId: true } } },
    });
    const studioId = u?.studioId;
    const networkId = u?.studio?.networkId;
    if (!studioId || !networkId) {
      throw new ForbiddenException('Администратору студии не назначена студия или сеть');
    }
    return { studioId, networkId };
  }

  // --- Networks ---

  async listNetworks(user: JwtAccessPayload) {
    if (user.role === UserRole.StudioAdmin) {
      const { networkId } = await this.getStudioAdminStudioNetwork(user.sub);
      const row = await this.prisma.network.findUnique({ where: { id: networkId } });
      return row ? [row] : [];
    }
    return this.prisma.network.findMany({ orderBy: { name: 'asc' } });
  }

  async getNetwork(user: JwtAccessPayload, id: string) {
    const row = await this.prisma.network.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Сеть ${id} не найдена`);
    if (user.role === UserRole.StudioAdmin) {
      const { networkId } = await this.getStudioAdminStudioNetwork(user.sub);
      if (networkId !== id) throw new ForbiddenException();
    }
    return row;
  }

  async createNetwork(user: JwtAccessPayload, dto: CreateNetworkDto) {
    this.assertElevatedCatalog(user);
    try {
      return await this.prisma.network.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          logoUrl: dto.logoUrl ?? null,
          physicalGoodCategories: {
            create: [
              { slug: 'care', name: 'Уход', sortOrder: 0, isActive: true },
              { slug: 'tools', name: 'Инструменты', sortOrder: 10, isActive: true },
              { slug: 'creams', name: 'Кремы', sortOrder: 20, isActive: true },
            ],
          },
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Сеть с таким slug уже существует');
      }
      throw e;
    }
  }

  async updateNetwork(user: JwtAccessPayload, id: string, dto: UpdateNetworkDto) {
    this.assertElevatedCatalog(user);
    await this.getNetwork(user, id);
    try {
      return await this.prisma.network.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Сеть ${id} не найдена`);
      }
      if (isUniqueViolation(e)) {
        throw new ConflictException('Сеть с таким slug уже существует');
      }
      throw e;
    }
  }

  async deleteNetwork(user: JwtAccessPayload, id: string) {
    this.assertElevatedCatalog(user);
    await this.getNetwork(user, id);
    const studios = await this.prisma.studio.count({ where: { networkId: id } });
    if (studios > 0) {
      throw new ConflictException('Нельзя удалить сеть с привязанными студиями');
    }
    await this.prisma.network.delete({ where: { id } });
    return { ok: true };
  }

  // --- Studios ---

  async listStudios(user: JwtAccessPayload, q: ListStudiosQueryDto) {
    if (user.role === UserRole.StudioAdmin) {
      const { studioId } = await this.getStudioAdminStudioNetwork(user.sub);
      return this.prisma.studio.findMany({
        where: { id: studioId },
        orderBy: { name: 'asc' },
      });
    }
    const where: Prisma.StudioWhereInput = {};
    if (q.networkId) where.networkId = q.networkId;
    return this.prisma.studio.findMany({
      where,
      orderBy: [{ networkId: 'asc' }, { name: 'asc' }],
    });
  }

  async getStudio(user: JwtAccessPayload, id: string) {
    const row = await this.prisma.studio.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Студия ${id} не найдена`);
    if (user.role === UserRole.StudioAdmin) {
      const { studioId } = await this.getStudioAdminStudioNetwork(user.sub);
      if (studioId !== id) throw new ForbiddenException();
    }
    return row;
  }

  async createStudio(user: JwtAccessPayload, dto: CreateStudioDto) {
    this.assertElevatedCatalog(user);
    await this.assertNetworkExists(dto.networkId);
    try {
      return await this.prisma.studio.create({
        data: {
          networkId: dto.networkId,
          name: dto.name,
          address: dto.address,
          city: dto.city,
          timezone: dto.timezone ?? 'Europe/Moscow',
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          description: dto.description ?? null,
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          openingHours: dto.openingHours as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new NotFoundException(`Сеть ${dto.networkId} не найдена`);
      }
      throw e;
    }
  }

  async updateStudio(user: JwtAccessPayload, id: string, dto: UpdateStudioDto) {
    const existing = await this.getStudio(user, id);

    if (user.role === UserRole.StudioAdmin) {
      if (dto.networkId !== undefined && dto.networkId !== existing.networkId) {
        throw new ForbiddenException('Нельзя перенести студию в другую сеть');
      }
    } else {
      this.assertElevatedCatalog(user);
      if (dto.networkId !== undefined) {
        await this.assertNetworkExists(dto.networkId);
      }
    }

    try {
      return await this.prisma.studio.update({
        where: { id },
        data: {
          ...(dto.networkId !== undefined && { networkId: dto.networkId }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.timezone !== undefined && { timezone: dto.timezone }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.openingHours !== undefined && {
            openingHours: dto.openingHours as Prisma.InputJsonValue,
          }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Студия ${id} не найдена`);
      }
      if (isFkViolation(e)) {
        throw new NotFoundException('Указанная сеть не найдена');
      }
      throw e;
    }
  }

  async deleteStudio(user: JwtAccessPayload, id: string) {
    this.assertElevatedCatalog(user);
    await this.getStudio(user, id);
    try {
      await this.prisma.studio.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      if (isFkViolation(e)) {
        throw new ConflictException('Нельзя удалить студию: есть связанные записи');
      }
      throw e;
    }
  }

  private async assertNetworkExists(networkId: string): Promise<void> {
    const n = await this.prisma.network.findUnique({ where: { id: networkId }, select: { id: true } });
    if (!n) throw new NotFoundException(`Сеть ${networkId} не найдена`);
  }

  // --- Health concerns ---

  async listHealthConcerns() {
    return this.prisma.healthConcern.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async getHealthConcern(id: string) {
    const row = await this.prisma.healthConcern.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Жалоба ${id} не найдена`);
    return row;
  }

  async createHealthConcern(user: JwtAccessPayload, dto: CreateHealthConcernDto) {
    this.assertElevatedCatalog(user);
    try {
      return await this.prisma.healthConcern.create({
        data: {
          slug: dto.slug,
          title: dto.title,
          description: dto.description ?? null,
          iconUrl: dto.iconUrl ?? null,
          sortOrder: dto.sortOrder ?? 0,
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Запись с таким slug уже есть');
      }
      throw e;
    }
  }

  async updateHealthConcern(user: JwtAccessPayload, id: string, dto: UpdateHealthConcernDto) {
    this.assertElevatedCatalog(user);
    await this.getHealthConcern(id);
    try {
      return await this.prisma.healthConcern.update({
        where: { id },
        data: {
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Жалоба ${id} не найдена`);
      }
      if (isUniqueViolation(e)) {
        throw new ConflictException('Запись с таким slug уже есть');
      }
      throw e;
    }
  }

  async deleteHealthConcern(user: JwtAccessPayload, id: string) {
    this.assertElevatedCatalog(user);
    await this.getHealthConcern(id);
    await this.prisma.healthConcern.delete({ where: { id } });
    return { ok: true };
  }

  // --- Studio directions (главный экран приложения) ---

  async listStudioDirections() {
    return this.prisma.studioDirection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async getStudioDirection(id: string) {
    const row = await this.prisma.studioDirection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Направление ${id} не найдено`);
    return row;
  }

  async createStudioDirection(user: JwtAccessPayload, dto: CreateStudioDirectionDto) {
    this.assertElevatedCatalog(user);
    try {
      return await this.prisma.studioDirection.create({
        data: {
          slug: dto.slug,
          title: dto.title,
          description: dto.description ?? null,
          iconKey: dto.iconKey,
          sortOrder: dto.sortOrder ?? 0,
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Запись с таким slug уже есть');
      }
      throw e;
    }
  }

  async updateStudioDirection(user: JwtAccessPayload, id: string, dto: UpdateStudioDirectionDto) {
    this.assertElevatedCatalog(user);
    await this.getStudioDirection(id);
    try {
      return await this.prisma.studioDirection.update({
        where: { id },
        data: {
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.iconKey !== undefined && { iconKey: dto.iconKey }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Направление ${id} не найдено`);
      }
      if (isUniqueViolation(e)) {
        throw new ConflictException('Запись с таким slug уже есть');
      }
      throw e;
    }
  }

  async deleteStudioDirection(user: JwtAccessPayload, id: string) {
    this.assertElevatedCatalog(user);
    await this.getStudioDirection(id);
    await this.prisma.studioDirection.delete({ where: { id } });
    return { ok: true };
  }

  // --- FAQ ---

  async listFaqItems() {
    return this.prisma.faqItem.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { question: 'asc' }],
    });
  }

  async getFaqItem(id: string) {
    const row = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`FAQ ${id} не найден`);
    return row;
  }

  async createFaqItem(user: JwtAccessPayload, dto: CreateFaqItemDto) {
    this.assertElevatedCatalog(user);
    return this.prisma.faqItem.create({
      data: {
        category: dto.category,
        question: dto.question,
        answer: dto.answer,
        sortOrder: dto.sortOrder ?? 0,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async updateFaqItem(user: JwtAccessPayload, id: string, dto: UpdateFaqItemDto) {
    this.assertElevatedCatalog(user);
    await this.getFaqItem(id);
    try {
      return await this.prisma.faqItem.update({
        where: { id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.question !== undefined && { question: dto.question }),
          ...(dto.answer !== undefined && { answer: dto.answer }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`FAQ ${id} не найден`);
      }
      throw e;
    }
  }

  async deleteFaqItem(user: JwtAccessPayload, id: string) {
    this.assertElevatedCatalog(user);
    await this.getFaqItem(id);
    await this.prisma.faqItem.delete({ where: { id } });
    return { ok: true };
  }
}
