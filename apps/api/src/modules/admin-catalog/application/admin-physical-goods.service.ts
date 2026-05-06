import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@srs/shared-types';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreatePhysicalGoodCategoryDto } from '../presentation/dto/create-physical-good-category.dto';
import type { CreatePhysicalGoodDto } from '../presentation/dto/create-physical-good.dto';
import type { UpdatePhysicalGoodCategoryDto } from '../presentation/dto/update-physical-good-category.dto';
import type { UpdatePhysicalGoodDto } from '../presentation/dto/update-physical-good.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Injectable()
export class AdminPhysicalGoodsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStudioAdminNetworkId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studio: { select: { networkId: true } } },
    });
    const networkId = user?.studio?.networkId;
    if (!networkId) {
      throw new ForbiddenException('Администратору студии не назначена сеть');
    }
    return networkId;
  }

  private async assertCanAccessNetwork(user: JwtAccessPayload, networkId: string): Promise<void> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      select: { id: true },
    });
    if (!network) {
      throw new NotFoundException(`Сеть ${networkId} не найдена`);
    }
    if (user.role === UserRole.StudioAdmin) {
      const myNetworkId = await this.getStudioAdminNetworkId(user.sub);
      if (myNetworkId !== networkId) throw new ForbiddenException();
      return;
    }
    if (user.role !== UserRole.SuperAdmin && user.role !== UserRole.NetworkOwner) {
      throw new ForbiddenException();
    }
  }

  private normalizeString(value: string): string {
    return value.trim();
  }

  private normalizeOptionalString(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    const next = value.trim();
    return next === '' ? null : next;
  }

  private async assertCategoryBelongsNetwork(networkId: string, categoryId: string): Promise<void> {
    const row = await this.prisma.physicalGoodCategory.findFirst({
      where: { id: categoryId, networkId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Категория товара не найдена в этой сети');
    }
  }

  // --- Categories ---

  async listCategories(user: JwtAccessPayload, networkId: string) {
    await this.assertCanAccessNetwork(user, networkId);
    return this.prisma.physicalGoodCategory.findMany({
      where: { networkId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(user: JwtAccessPayload, networkId: string, dto: CreatePhysicalGoodCategoryDto) {
    await this.assertCanAccessNetwork(user, networkId);
    try {
      return await this.prisma.physicalGoodCategory.create({
        data: {
          networkId,
          slug: this.normalizeString(dto.slug),
          name: this.normalizeString(dto.name),
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Категория с таким slug или названием уже существует');
      }
      throw e;
    }
  }

  async updateCategory(
    user: JwtAccessPayload,
    networkId: string,
    categoryId: string,
    dto: UpdatePhysicalGoodCategoryDto,
  ) {
    await this.assertCanAccessNetwork(user, networkId);
    const existing = await this.prisma.physicalGoodCategory.findFirst({
      where: { id: categoryId, networkId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Категория товара не найдена в этой сети');
    }

    const data: Prisma.PhysicalGoodCategoryUpdateInput = {};
    if (dto.slug !== undefined) data.slug = this.normalizeString(dto.slug);
    if (dto.name !== undefined) data.name = this.normalizeString(dto.name);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      return await this.prisma.physicalGoodCategory.update({
        where: { id: categoryId },
        data,
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Категория с таким slug или названием уже существует');
      }
      throw e;
    }
  }

  async deleteCategory(user: JwtAccessPayload, networkId: string, categoryId: string) {
    await this.assertCanAccessNetwork(user, networkId);
    const existing = await this.prisma.physicalGoodCategory.findFirst({
      where: { id: categoryId, networkId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Категория товара не найдена в этой сети');
    }
    const linkedGoods = await this.prisma.physicalGood.count({
      where: { networkId, categoryId },
    });
    if (linkedGoods > 0) {
      throw new ConflictException('Нельзя удалить категорию: к ней привязаны товары');
    }
    await this.prisma.physicalGoodCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  }

  async list(user: JwtAccessPayload, networkId: string) {
    await this.assertCanAccessNetwork(user, networkId);
    return this.prisma.physicalGood.findMany({
      where: { networkId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });
  }

  async getById(user: JwtAccessPayload, networkId: string, goodId: string) {
    await this.assertCanAccessNetwork(user, networkId);
    const row = await this.prisma.physicalGood.findFirst({
      where: { id: goodId, networkId },
      include: {
        category: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Товар ${goodId} не найден в этой сети`);
    }
    return row;
  }

  async create(user: JwtAccessPayload, networkId: string, dto: CreatePhysicalGoodDto) {
    await this.assertCanAccessNetwork(user, networkId);
    await this.assertCategoryBelongsNetwork(networkId, dto.categoryId);
    try {
      return await this.prisma.physicalGood.create({
        data: {
          networkId,
          categoryId: dto.categoryId,
          sku: this.normalizeString(dto.sku),
          slug: this.normalizeString(dto.slug),
          name: this.normalizeString(dto.name),
          description: this.normalizeOptionalString(dto.description),
          brand: this.normalizeOptionalString(dto.brand),
          imageUrls: dto.imageUrls ?? [],
          priceMinor: dto.priceRubles * 100,
          currency: this.normalizeString(dto.currency ?? 'RUB') || 'RUB',
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Товар с таким SKU или slug уже существует');
      }
      throw e;
    }
  }

  async update(user: JwtAccessPayload, networkId: string, goodId: string, dto: UpdatePhysicalGoodDto) {
    await this.getById(user, networkId, goodId);
    if (dto.categoryId !== undefined) {
      await this.assertCategoryBelongsNetwork(networkId, dto.categoryId);
    }
    const data: Prisma.PhysicalGoodUpdateInput = {};
    if (dto.sku !== undefined) data.sku = this.normalizeString(dto.sku);
    if (dto.slug !== undefined) data.slug = this.normalizeString(dto.slug);
    if (dto.name !== undefined) data.name = this.normalizeString(dto.name);
    if (dto.description !== undefined) data.description = this.normalizeOptionalString(dto.description);
    if (dto.brand !== undefined) data.brand = this.normalizeOptionalString(dto.brand);
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.imageUrls !== undefined) data.imageUrls = dto.imageUrls;
    if (dto.priceRubles !== undefined) data.priceMinor = dto.priceRubles * 100;
    if (dto.currency !== undefined) data.currency = this.normalizeString(dto.currency) || 'RUB';
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      return await this.prisma.physicalGood.update({
        where: { id: goodId },
        data,
        include: {
          category: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Товар ${goodId} не найден`);
      }
      if (isUniqueViolation(e)) {
        throw new ConflictException('Товар с таким SKU или slug уже существует');
      }
      throw e;
    }
  }

  async delete(user: JwtAccessPayload, networkId: string, goodId: string) {
    await this.getById(user, networkId, goodId);
    await this.prisma.physicalGood.delete({ where: { id: goodId } });
    return { ok: true };
  }
}
