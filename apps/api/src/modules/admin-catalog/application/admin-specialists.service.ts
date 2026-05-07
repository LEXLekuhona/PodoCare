/* eslint-disable import/order */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@srs/shared-types';
import argon2 from 'argon2';

import { normalizePhone, normalizeEmail } from '../../../common/utils/normalize-phone';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateSpecialistDto } from '../presentation/dto/create-specialist.dto';
import type { ListSpecialistsQueryDto } from '../presentation/dto/list-specialists.query.dto';
import type { UpdateSpecialistDto } from '../presentation/dto/update-specialist.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Injectable()
export class AdminSpecialistsService {
  constructor(private readonly prisma: PrismaService) {}

  private async syncSpecialistServicesTx(
    tx: Prisma.TransactionClient,
    specialistProfileId: string,
    serviceIds: string[],
    allowedStudioIds: string[],
  ): Promise<void> {
    const unique = [...new Set(serviceIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) {
      await tx.specialistService.deleteMany({ where: { specialistId: specialistProfileId } });
      return;
    }
    const services = await tx.service.findMany({
      where: { id: { in: unique } },
      select: { id: true, studioId: true },
    });
    if (services.length !== unique.length) {
      throw new BadRequestException('Одна или несколько услуг не найдены');
    }
    const allowed = new Set(allowedStudioIds);
    for (const s of services) {
      if (!allowed.has(s.studioId)) {
        throw new BadRequestException('Услуга не относится к студиям специалиста');
      }
    }
    await tx.specialistService.deleteMany({ where: { specialistId: specialistProfileId } });
    await tx.specialistService.createMany({
      data: unique.map((serviceId) => ({ specialistId: specialistProfileId, serviceId })),
    });
  }

  private async syncSpecialistCategoriesTx(
    tx: Prisma.TransactionClient,
    specialistProfileId: string,
    categoryIds: string[],
  ): Promise<void> {
    const unique = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) {
      await tx.specialistCategory.deleteMany({ where: { specialistId: specialistProfileId } });
      return;
    }
    const categories = await tx.serviceCategory.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (categories.length !== unique.length) {
      throw new BadRequestException('Одна или несколько категорий не найдены');
    }
    await tx.specialistCategory.deleteMany({ where: { specialistId: specialistProfileId } });
    await tx.specialistCategory.createMany({
      data: unique.map((categoryId) => ({ specialistId: specialistProfileId, categoryId })),
    });
  }

  private normalizeSpecializations(raw?: string[]): string[] {
    if (!raw?.length) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const s of raw) {
      const t = s.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= 20) break;
    }
    return out;
  }

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

  private async resolveStudiosForSpecialist(
    actor: JwtAccessPayload,
    studioIdsRaw: string[],
    primaryStudioIdInput: string | undefined,
  ): Promise<{ primaryStudioId: string; uniqueStudioIds: string[] }> {
    const studioIds = [...new Set(studioIdsRaw.map((id) => id.trim()).filter(Boolean))];
    if (studioIds.length === 0) {
      throw new BadRequestException('Укажите хотя бы одну студию');
    }

    const studios = await this.prisma.studio.findMany({
      where: { id: { in: studioIds } },
      select: { id: true, networkId: true },
    });
    if (studios.length !== studioIds.length) {
      throw new BadRequestException('Одна или несколько студий не найдены');
    }

    const networkId = studios[0]!.networkId;
    if (studios.some((s) => s.networkId !== networkId)) {
      throw new BadRequestException('Все студии должны быть из одной сети');
    }

    if (actor.role === UserRole.StudioAdmin) {
      const my = await this.getStudioAdminStudioId(actor.sub);
      if (studioIds.length !== 1 || studioIds[0] !== my) {
        throw new ForbiddenException('Можно назначить только свою студию');
      }
    }

    let primary = primaryStudioIdInput?.trim();
    if (!primary) {
      primary = studioIds[0];
    }
    if (!primary || !studioIds.includes(primary)) {
      throw new BadRequestException('Основная студия должна быть среди выбранных');
    }

    return { primaryStudioId: primary, uniqueStudioIds: studioIds };
  }

  private async assertCanAccessSpecialistRow(actor: JwtAccessPayload, specialistUserId: string): Promise<void> {
    const row = await this.prisma.user.findUnique({
      where: { id: specialistUserId },
      select: {
        role: true,
        specialistProfile: { select: { studios: { select: { studioId: true } } } },
      },
    });
    if (!row || row.role !== UserRole.Specialist || !row.specialistProfile) {
      throw new NotFoundException(`Специалист ${specialistUserId} не найден`);
    }
    if (actor.role === UserRole.SuperAdmin || actor.role === UserRole.NetworkOwner) {
      return;
    }
    if (actor.role === UserRole.StudioAdmin) {
      const my = await this.getStudioAdminStudioId(actor.sub);
      if (row.specialistProfile.studios.some((s) => s.studioId === my)) {
        return;
      }
    }
    throw new ForbiddenException();
  }

  async list(actor: JwtAccessPayload, q: ListSpecialistsQueryDto) {
    let where: Prisma.UserWhereInput = { role: UserRole.Specialist };

    if (actor.role === UserRole.StudioAdmin) {
      const myStudio = await this.getStudioAdminStudioId(actor.sub);
      where = {
        AND: [
          { role: UserRole.Specialist },
          { specialistProfile: { studios: { some: { studioId: myStudio } } } },
        ],
      };
    } else if (q.studioId) {
      const st = await this.prisma.studio.findUnique({ where: { id: q.studioId }, select: { id: true } });
      if (!st) {
        return [];
      }
      where = {
        AND: [
          { role: UserRole.Specialist },
          { specialistProfile: { studios: { some: { studioId: q.studioId } } } },
        ],
      };
    }

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        middleName: true,
        studioId: true,
        isActive: true,
        createdAt: true,
        specialistProfile: {
          select: {
            specializations: true,
            services: { select: { serviceId: true } },
            categories: { select: { categoryId: true } },
            studios: {
              select: {
                studio: { select: { id: true, name: true, city: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((u) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      middleName: u.middleName,
      primaryStudioId: u.studioId,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      specialistProfile: {
        specializations: u.specialistProfile?.specializations ?? [],
        studios: u.specialistProfile?.studios.map((l) => l.studio) ?? [],
        serviceIds: u.specialistProfile?.services.map((x) => x.serviceId) ?? [],
        categoryIds: u.specialistProfile?.categories.map((x) => x.categoryId) ?? [],
      },
    }));
  }

  async getById(actor: JwtAccessPayload, id: string) {
    await this.assertCanAccessSpecialistRow(actor, id);
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        middleName: true,
        studioId: true,
        isActive: true,
        createdAt: true,
        specialistProfile: {
          select: {
            specializations: true,
            services: { select: { serviceId: true } },
            categories: { select: { categoryId: true } },
            studios: {
              select: {
                studio: { select: { id: true, name: true, city: true } },
              },
            },
          },
        },
      },
    });
    if (!row || row.role !== UserRole.Specialist || !row.specialistProfile) {
      throw new NotFoundException(`Специалист ${id} не найден`);
    }
    return {
      id: row.id,
      phone: row.phone,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      middleName: row.middleName,
      primaryStudioId: row.studioId,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      specialistProfile: {
        specializations: row.specialistProfile.specializations,
        studios: row.specialistProfile.studios.map((l) => l.studio),
        serviceIds: row.specialistProfile.services.map((x) => x.serviceId),
        categoryIds: row.specialistProfile.categories.map((x) => x.categoryId),
      },
    };
  }

  async create(actor: JwtAccessPayload, dto: CreateSpecialistDto) {
    if (actor.role !== UserRole.SuperAdmin && actor.role !== UserRole.NetworkOwner && actor.role !== UserRole.StudioAdmin) {
      throw new ForbiddenException();
    }

    const { primaryStudioId, uniqueStudioIds } = await this.resolveStudiosForSpecialist(
      actor,
      dto.studioIds,
      dto.primaryStudioId,
    );

    const phone = normalizePhone(dto.phone);
    const email = normalizeEmail(dto.email);
    const passwordHash = await argon2.hash(dto.password);
    const specializations = this.normalizeSpecializations(dto.specializations);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            phone,
            email,
            passwordHash,
            role: UserRole.Specialist,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            middleName: dto.middleName?.trim() || null,
            studio: { connect: { id: primaryStudioId } },
            phoneVerifiedAt: new Date(),
            emailVerifiedAt: new Date(),
            isActive: true,
          },
          select: { id: true },
        });

        const profile = await tx.specialistProfile.create({
          data: {
            userId: u.id,
            studioId: primaryStudioId,
            specializations,
            studios: {
              create: uniqueStudioIds.map((studioId) => ({ studioId })),
            },
          },
          select: { id: true },
        });
        if (dto.serviceIds !== undefined) {
          await this.syncSpecialistServicesTx(tx, profile.id, dto.serviceIds, uniqueStudioIds);
        }
        if (dto.categoryIds !== undefined) {
          await this.syncSpecialistCategoriesTx(tx, profile.id, dto.categoryIds);
        }
        return { userId: u.id, profileId: profile.id };
      });
      return this.getById(actor, created.userId);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Пользователь с таким телефоном или email уже есть');
      }
      throw e;
    }
  }

  async update(actor: JwtAccessPayload, id: string, dto: UpdateSpecialistDto) {
    await this.assertCanAccessSpecialistRow(actor, id);

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        studioId: true,
        specialistProfile: { select: { id: true } },
      },
    });
    if (!existing?.specialistProfile) {
      throw new NotFoundException(`Специалист ${id} не найден`);
    }

    const profileId = existing.specialistProfile.id;

    let nextPrimary = existing.studioId!;
    let nextStudioIds: string[] | null = null;

    if (dto.studioIds !== undefined) {
      const resolved = await this.resolveStudiosForSpecialist(
        actor,
        dto.studioIds,
        dto.primaryStudioId ?? dto.studioIds[0],
      );
      nextPrimary = resolved.primaryStudioId;
      nextStudioIds = resolved.uniqueStudioIds;
    } else if (dto.primaryStudioId !== undefined) {
      const p = dto.primaryStudioId.trim();
      const links = await this.prisma.specialistStudio.findMany({
        where: { specialistProfileId: profileId },
        select: { studioId: true },
      });
      const allowed = new Set(links.map((l) => l.studioId));
      if (!allowed.has(p)) {
        throw new BadRequestException('Основная студия должна быть среди уже назначенных точек');
      }
      nextPrimary = p;
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined && dto.email !== null) {
      data.email = normalizeEmail(dto.email);
    }
    if (dto.phone !== undefined && dto.phone !== null) {
      data.phone = normalizePhone(dto.phone);
    }
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.middleName !== undefined && dto.middleName !== null) {
      data.middleName = dto.middleName.trim() === '' ? null : dto.middleName.trim();
    }
    if (dto.password !== undefined) {
      data.passwordHash = await argon2.hash(dto.password);
    }
    if (dto.isActive !== undefined) {
      if (!dto.isActive && id === actor.sub) {
        throw new BadRequestException('Нельзя деактивировать свою учётную запись');
      }
      data.isActive = dto.isActive;
    }

    if (nextPrimary !== existing.studioId) {
      data.studio = { connect: { id: nextPrimary } };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.user.update({ where: { id }, data });
        }

        const profilePatch: Prisma.SpecialistProfileUpdateInput = {};
        if (nextPrimary !== existing.studioId) {
          profilePatch.studio = { connect: { id: nextPrimary } };
        }
        if (dto.specializations !== undefined) {
          profilePatch.specializations = this.normalizeSpecializations(dto.specializations);
        }

        if (nextStudioIds !== null) {
          await tx.specialistStudio.deleteMany({
            where: { specialistProfileId: profileId },
          });
          await tx.specialistStudio.createMany({
            data: nextStudioIds.map((studioId) => ({
              specialistProfileId: profileId,
              studioId,
            })),
          });
        }

        if (Object.keys(profilePatch).length > 0) {
          await tx.specialistProfile.update({
            where: { userId: id },
            data: profilePatch,
          });
        }

        if (dto.serviceIds !== undefined) {
          let allowedStudios: string[];
          if (nextStudioIds !== null) {
            allowedStudios = nextStudioIds;
          } else {
            const links = await tx.specialistStudio.findMany({
              where: { specialistProfileId: profileId },
              select: { studioId: true },
            });
            allowedStudios = links.map((l) => l.studioId);
          }
          await this.syncSpecialistServicesTx(tx, profileId, dto.serviceIds, allowedStudios);
        }

        if (dto.categoryIds !== undefined) {
          await this.syncSpecialistCategoriesTx(tx, profileId, dto.categoryIds);
        }
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Пользователь с таким телефоном или email уже есть');
      }
      throw e;
    }

    return this.getById(actor, id);
  }

  async deactivate(actor: JwtAccessPayload, id: string) {
    if (id === actor.sub) {
      throw new BadRequestException('Нельзя деактивировать свою учётную запись');
    }
    await this.assertCanAccessSpecialistRow(actor, id);
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existing || existing.role !== UserRole.Specialist) {
      throw new NotFoundException(`Специалист ${id} не найден`);
    }
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true };
  }
}
