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
import type { CreateServiceCategoryDto } from '../presentation/dto/create-service-category.dto';
import type { UpdateServiceCategoryDto } from '../presentation/dto/update-service-category.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Injectable()
export class AdminServiceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertElevated(user: JwtAccessPayload): void {
    if (user.role !== UserRole.SuperAdmin && user.role !== UserRole.NetworkOwner) {
      throw new ForbiddenException('Только SuperAdmin или NetworkOwner');
    }
  }

  async list() {
    return this.prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    const row = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Категория ${id} не найдена`);
    return row;
  }

  async create(user: JwtAccessPayload, dto: CreateServiceCategoryDto) {
    this.assertElevated(user);
    try {
      return await this.prisma.serviceCategory.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim().toLowerCase(),
          description: dto.description?.trim() ? dto.description.trim() : null,
          color: dto.color?.trim() ? dto.color.trim() : null,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Категория с таким slug уже существует');
      }
      throw e;
    }
  }

  async update(user: JwtAccessPayload, id: string, dto: UpdateServiceCategoryDto) {
    this.assertElevated(user);
    await this.getById(id);
    const data: Prisma.ServiceCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = dto.slug.trim().toLowerCase();
    if (dto.description !== undefined) {
      data.description = dto.description.trim() === '' ? null : dto.description.trim();
    }
    if (dto.color !== undefined) {
      data.color = dto.color.trim() === '' ? null : dto.color.trim();
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    try {
      return await this.prisma.serviceCategory.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Категория ${id} не найдена`);
      }
      if (isUniqueViolation(e)) {
        throw new ConflictException('Категория с таким slug уже существует');
      }
      throw e;
    }
  }

  async delete(user: JwtAccessPayload, id: string) {
    this.assertElevated(user);
    await this.getById(id);
    try {
      await this.prisma.serviceCategory.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException('Нельзя удалить категорию: есть связанные услуги');
      }
      throw e;
    }
  }
}
