/* eslint-disable import/order */
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import {
  BadRequestException,
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
import type { CreatePhysicalGoodCategoryDto } from '../presentation/dto/create-physical-good-category.dto';
import type {
  CreatePhysicalGoodDto,
  PhysicalGoodStudioInventoryDto,
} from '../presentation/dto/create-physical-good.dto';
import type { UpdatePhysicalGoodCategoryDto } from '../presentation/dto/update-physical-good-category.dto';
import type { UpdatePhysicalGoodDto } from '../presentation/dto/update-physical-good.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

type UploadedProductImageFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

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

  private identifierFromName(name: string): string {
    const translit: Record<string, string> = {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'e',
      ж: 'zh',
      з: 'z',
      и: 'i',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'h',
      ц: 'c',
      ч: 'ch',
      ш: 'sh',
      щ: 'sch',
      ъ: '',
      ы: 'y',
      ь: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
    };
    const normalized = name
      .trim()
      .toLowerCase()
      .split('')
      .map((ch) => translit[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return normalized || 'product';
  }

  private async uniqueSlug(raw: string | undefined, name: string, excludeId?: string): Promise<string> {
    const base = this.identifierFromName(raw?.trim() || name);
    for (let i = 0; i < 1000; i += 1) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const existing = await this.prisma.physicalGood.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
    }
    throw new ConflictException('Не удалось автоматически сформировать уникальный slug');
  }

  private async uniqueSku(raw: string | undefined, name: string, excludeId?: string): Promise<string> {
    const slugBase = this.identifierFromName(raw?.trim() || name);
    const base = slugBase.replace(/-/g, '_').toUpperCase().slice(0, 80) || 'PRODUCT';
    for (let i = 0; i < 1000; i += 1) {
      const candidate = i === 0 ? base : `${base}_${i + 1}`;
      const existing = await this.prisma.physicalGood.findUnique({
        where: { sku: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
    }
    throw new ConflictException('Не удалось автоматически сформировать уникальный SKU');
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

  private async assertStudiosBelongNetwork(networkId: string, studioIds: string[]): Promise<void> {
    if (studioIds.length === 0) return;
    const count = await this.prisma.studio.count({
      where: { id: { in: studioIds }, networkId },
    });
    if (count !== new Set(studioIds).size) {
      throw new NotFoundException('Одна или несколько студий не найдены в этой сети');
    }
  }

  private async saveStudioInventory(goodId: string, networkId: string, items: PhysicalGoodStudioInventoryDto[] | undefined) {
    if (items === undefined) return;
    const normalized = items.filter((item, index, all) => all.findIndex((x) => x.studioId === item.studioId) === index);
    await this.assertStudiosBelongNetwork(networkId, normalized.map((item) => item.studioId));
    await this.prisma.$transaction([
      this.prisma.physicalGoodStudioInventory.deleteMany({
        where: {
          goodId,
          studioId: { notIn: normalized.map((item) => item.studioId) },
        },
      }),
      ...normalized.map((item) =>
        this.prisma.physicalGoodStudioInventory.upsert({
          where: { goodId_studioId: { goodId, studioId: item.studioId } },
          create: {
            goodId,
            studioId: item.studioId,
            isAvailable: item.isAvailable ?? true,
            stock: item.stock ?? null,
            priceMinor: item.priceRubles == null ? null : item.priceRubles * 100,
          },
          update: {
            isAvailable: item.isAvailable ?? true,
            stock: item.stock ?? null,
            priceMinor: item.priceRubles == null ? null : item.priceRubles * 100,
          },
        }),
      ),
    ]);
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
        studioInventory: {
          include: {
            studio: { select: { id: true, name: true } },
          },
          orderBy: { studio: { name: 'asc' } },
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
        studioInventory: {
          include: {
            studio: { select: { id: true, name: true } },
          },
          orderBy: { studio: { name: 'asc' } },
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
    await this.assertStudiosBelongNetwork(networkId, (dto.studioInventory ?? []).map((item) => item.studioId));
    const name = this.normalizeString(dto.name);
    const [sku, slug] = await Promise.all([
      this.uniqueSku(dto.sku, name),
      this.uniqueSlug(dto.slug, name),
    ]);
    try {
      const row = await this.prisma.physicalGood.create({
        data: {
          networkId,
          categoryId: dto.categoryId,
          sku,
          slug,
          name,
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
      await this.saveStudioInventory(row.id, networkId, dto.studioInventory);
      return this.getById(user, networkId, row.id);
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
    await this.assertStudiosBelongNetwork(networkId, (dto.studioInventory ?? []).map((item) => item.studioId));
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
      await this.prisma.physicalGood.update({
        where: { id: goodId },
        data,
        include: {
          category: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
      });
      await this.saveStudioInventory(goodId, networkId, dto.studioInventory);
      return this.getById(user, networkId, goodId);
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

  async saveImage(
    user: JwtAccessPayload,
    networkId: string,
    file: UploadedProductImageFile | undefined,
    publicBaseUrl: string,
  ) {
    await this.assertCanAccessNetwork(user, networkId);
    if (!file) {
      throw new BadRequestException('Файл изображения обязателен');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Можно загрузить только изображение');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Изображение должно быть не больше 5 МБ');
    }

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    const relativePath = `products/${networkId}/${filename}`;
    const uploadsRoot = join(process.cwd(), 'uploads');
    const targetDir = join(uploadsRoot, 'products', networkId);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, filename), file.buffer);

    return {
      url: `${publicBaseUrl.replace(/\/$/, '')}/uploads/${relativePath}`,
    };
  }
}
