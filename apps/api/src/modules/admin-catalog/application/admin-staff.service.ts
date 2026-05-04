import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@podocare/shared-types';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateStaffUserDto } from '../presentation/dto/create-staff-user.dto';
import type { ListStaffQueryDto } from '../presentation/dto/list-staff.query.dto';
import type { UpdateStaffUserDto } from '../presentation/dto/update-staff-user.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

const STUDIO_SCOPED_ROLES: UserRole[] = [UserRole.StudioAdmin];

@Injectable()
export class AdminStaffService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePhone(raw: string): string {
    const normalized = raw.replace(/[^\d+]/g, '');
    const digits = normalized.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      throw new BadRequestException('Некорректный номер телефона');
    }
    if (digits.length === 11 && digits.startsWith('8')) {
      return `+7${digits.slice(1)}`;
    }
    if (digits.length === 11 && digits.startsWith('7')) {
      return `+${digits}`;
    }
    return normalized.startsWith('+') ? `+${digits}` : `+${digits}`;
  }

  private normalizeEmail(raw: string): string {
    const t = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      throw new BadRequestException('Некорректный email');
    }
    return t;
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

  private assertAssignableRole(actor: JwtAccessPayload, role: UserRole): void {
    if (role === UserRole.Client) {
      throw new BadRequestException('Недопустимая роль');
    }
    if (role === UserRole.SuperAdmin) {
      throw new ForbiddenException('Роль SuperAdmin нельзя назначить через админку');
    }
    if (role === UserRole.Specialist) {
      throw new BadRequestException('Специалистов добавляйте в разделе «Специалисты»');
    }
    switch (actor.role) {
      case UserRole.StudioAdmin:
        if (role !== UserRole.StudioAdmin) {
          throw new ForbiddenException('Можно создавать только администраторов студии');
        }
        return;
      case UserRole.NetworkOwner:
        if (role === UserRole.NetworkOwner) {
          throw new ForbiddenException('Недопустимая роль для владельца сети');
        }
        return;
      case UserRole.SuperAdmin:
        return;
      default:
        throw new ForbiddenException();
    }
  }

  private listStaffRoleFilter(actor: JwtAccessPayload): Prisma.UserWhereInput['role'] {
    const base: UserRole[] = [UserRole.StudioAdmin, UserRole.NetworkOwner, UserRole.ContentAuthor];
    if (actor.role === UserRole.SuperAdmin) {
      return { in: [...base, UserRole.SuperAdmin] };
    }
    return { in: base };
  }

  private async assertCanAccessStaffRow(actor: JwtAccessPayload, row: {
    id: string;
    role: UserRole;
    studioId: string | null;
  }): Promise<void> {
    if (row.role === UserRole.Specialist) {
      throw new ForbiddenException();
    }
    if (actor.role === UserRole.SuperAdmin) {
      return;
    }
    if (actor.role === UserRole.NetworkOwner) {
      if (row.role === UserRole.SuperAdmin) {
        throw new ForbiddenException();
      }
      return;
    }
    if (actor.role === UserRole.StudioAdmin) {
      const myStudio = await this.getStudioAdminStudioId(actor.sub);
      if (row.studioId === myStudio && row.role === UserRole.StudioAdmin) {
        return;
      }
      throw new ForbiddenException();
    }
    throw new ForbiddenException();
  }

  async list(actor: JwtAccessPayload, q: ListStaffQueryDto) {
    let where: Prisma.UserWhereInput;

    if (actor.role === UserRole.StudioAdmin) {
      const studioId = await this.getStudioAdminStudioId(actor.sub);
      where = {
        role: UserRole.StudioAdmin,
        studioId,
      };
    } else {
      where = { role: this.listStaffRoleFilter(actor) };
      if (q.studioId) {
        where = {
          AND: [where, { studioId: q.studioId }],
        };
      }
    }

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
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
        studio: { select: { id: true, name: true, city: true } },
      },
    });

    return rows.map((u) => ({
      id: u.id,
      role: u.role as UserRole,
      phone: u.phone,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      middleName: u.middleName,
      studioId: u.studioId,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      studio: u.studio,
    }));
  }

  async getById(actor: JwtAccessPayload, id: string) {
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
        studio: { select: { id: true, name: true, city: true } },
      },
    });
    if (!row) throw new NotFoundException(`Сотрудник ${id} не найден`);
    if (row.role === UserRole.Specialist) {
      throw new NotFoundException(`Сотрудник ${id} не найден`);
    }
    await this.assertCanAccessStaffRow(actor, {
      id: row.id,
      role: row.role as UserRole,
      studioId: row.studioId,
    });
    return {
      id: row.id,
      role: row.role as UserRole,
      phone: row.phone,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      middleName: row.middleName,
      studioId: row.studioId,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      studio: row.studio,
    };
  }

  async create(actor: JwtAccessPayload, dto: CreateStaffUserDto) {
    this.assertAssignableRole(actor, dto.role);

    let studioId: string | null;
    if (actor.role === UserRole.StudioAdmin) {
      studioId = await this.getStudioAdminStudioId(actor.sub);
      if (dto.studioId && dto.studioId !== studioId) {
        throw new ForbiddenException('Можно добавлять сотрудников только в свою студию');
      }
      if (!STUDIO_SCOPED_ROLES.includes(dto.role)) {
        throw new ForbiddenException();
      }
    } else {
      studioId = this.resolveStudioIdForCreateElevated(dto.role, dto.studioId);
    }

    if (studioId) {
      const st = await this.prisma.studio.findUnique({ where: { id: studioId }, select: { id: true } });
      if (!st) throw new NotFoundException(`Студия ${studioId} не найдена`);
    }

    const phone = this.normalizePhone(dto.phone);
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          phone,
          email,
          passwordHash,
          role: dto.role,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          middleName: dto.middleName?.trim() || null,
          ...(studioId ? { studio: { connect: { id: studioId } } } : {}),
          phoneVerifiedAt: new Date(),
          emailVerifiedAt: new Date(),
          isActive: true,
        },
        select: { id: true },
      });
      return this.getById(actor, user.id);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Пользователь с таким телефоном или email уже есть');
      }
      throw e;
    }
  }

  private resolveStudioIdForCreateElevated(role: UserRole, dtoStudioId: string | undefined): string | null {
    if (STUDIO_SCOPED_ROLES.includes(role)) {
      if (!dtoStudioId) {
        throw new BadRequestException('Для этой роли нужна студия (studioId)');
      }
      return dtoStudioId;
    }
    return null;
  }

  async update(actor: JwtAccessPayload, id: string, dto: UpdateStaffUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        studioId: true,
      },
    });
    if (!existing) throw new NotFoundException(`Сотрудник ${id} не найден`);
    if (existing.role === UserRole.Specialist) {
      throw new BadRequestException('Специалистов редактируйте в разделе «Специалисты»');
    }
    await this.assertCanAccessStaffRow(actor, {
      id: existing.id,
      role: existing.role as UserRole,
      studioId: existing.studioId,
    });

    if (existing.role === UserRole.SuperAdmin && actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException();
    }

    const nextRole = dto.role ?? (existing.role as UserRole);
    if (dto.role !== undefined) {
      this.assertAssignableRole(actor, dto.role);
    }

    if (actor.role === UserRole.StudioAdmin) {
      if (nextRole !== UserRole.StudioAdmin) {
        throw new ForbiddenException('Недопустимая роль');
      }
    }

    let nextStudioId: string | null;

    if (STUDIO_SCOPED_ROLES.includes(nextRole)) {
      if (actor.role === UserRole.StudioAdmin) {
        nextStudioId = await this.getStudioAdminStudioId(actor.sub);
      } else {
        nextStudioId =
          dto.studioId !== undefined ? dto.studioId : (existing.studioId ?? null);
      }
      if (!nextStudioId) {
        throw new BadRequestException('Для этой роли нужна студия');
      }
      const st = await this.prisma.studio.findUnique({
        where: { id: nextStudioId },
        select: { id: true },
      });
      if (!st) throw new NotFoundException(`Студия ${nextStudioId} не найдена`);
    } else {
      nextStudioId = null;
      if (dto.studioId != null) {
        throw new BadRequestException('Для этой роли не указывают студию');
      }
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined) {
      data.email = this.normalizeEmail(dto.email);
    }
    if (dto.phone !== undefined) {
      data.phone = this.normalizePhone(dto.phone);
    }
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.middleName !== undefined) {
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
    if (dto.role !== undefined) {
      data.role = dto.role;
    }

    const shouldPatchStudio =
      dto.role !== undefined ||
      dto.studioId !== undefined ||
      actor.role === UserRole.StudioAdmin ||
      STUDIO_SCOPED_ROLES.includes(nextRole);

    if (shouldPatchStudio) {
      data.studio = nextStudioId
        ? { connect: { id: nextStudioId } }
        : { disconnect: true };
    }

    try {
      await this.prisma.user.update({
        where: { id },
        data,
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
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, studioId: true, isActive: true },
    });
    if (!existing) throw new NotFoundException(`Сотрудник ${id} не найден`);
    if (existing.role === UserRole.Specialist) {
      throw new BadRequestException('Специалистов деактивируйте в разделе «Специалисты»');
    }
    await this.assertCanAccessStaffRow(actor, {
      id: existing.id,
      role: existing.role as UserRole,
      studioId: existing.studioId,
    });
    if (existing.role === UserRole.SuperAdmin && actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException();
    }
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true };
  }
}
