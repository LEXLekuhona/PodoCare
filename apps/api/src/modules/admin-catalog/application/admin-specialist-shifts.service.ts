/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI requires runtime class tokens */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShiftStatus, UserRole } from '@srs/shared-types';
import { addDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

import { AdminSpecialistsService } from './admin-specialists.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateSpecialistShiftDto } from '../presentation/dto/create-specialist-shift.dto';
import type { CreateSpecialistShiftsBulkDto } from '../presentation/dto/create-specialist-shifts-bulk.dto';
import type { ListSpecialistShiftsQueryDto } from '../presentation/dto/list-specialist-shifts.query.dto';
import type { UpdateSpecialistShiftDto } from '../presentation/dto/update-specialist-shift.dto';

@Injectable()
export class AdminSpecialistShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSpecialistsService: AdminSpecialistsService,
  ) {}

  private parseDatetimeLocal(value: string): { ymd: string; hh: string; mm: string } {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new BadRequestException('Некорректная дата/время (ожидается формат YYYY-MM-DDTHH:mm)');
    }
    const ymd = match[1]!;
    const hh = match[2]!;
    const mm = match[3]!;
    const h = Number(hh);
    const m = Number(mm);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new BadRequestException('Некорректная дата/время');
    }
    return { ymd, hh, mm };
  }

  private timeToMinutes(value: string): number {
    const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new BadRequestException(`Некорректное время "${value}"`);
    }
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new BadRequestException(`Некорректное время "${value}"`);
    }
    return h * 60 + m;
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

  private async resolveSpecialistProfileId(
    actor: JwtAccessPayload,
    specialistUserId: string,
  ): Promise<{ profileId: string; studioIds: string[] }> {
    await this.adminSpecialistsService.getById(actor, specialistUserId);

    const user = await this.prisma.user.findUnique({
      where: { id: specialistUserId },
      select: {
        specialistProfile: {
          select: {
            id: true,
            studios: { select: { studioId: true } },
          },
        },
      },
    });
    if (!user?.specialistProfile) {
      throw new NotFoundException('Профиль специалиста не найден');
    }

    return {
      profileId: user.specialistProfile.id,
      studioIds: user.specialistProfile.studios.map((x) => x.studioId),
    };
  }

  async list(actor: JwtAccessPayload, specialistUserId: string, q: ListSpecialistShiftsQueryDto) {
    const { profileId } = await this.resolveSpecialistProfileId(actor, specialistUserId);

    const from = q.from ? new Date(q.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = q.to ? new Date(q.to) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
      throw new BadRequestException('Некорректный параметр from');
    }
    if (!(to instanceof Date) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Некорректный параметр to');
    }
    if (to <= from) {
      throw new BadRequestException('Параметр to должен быть позже from');
    }

    return this.prisma.specialistShift.findMany({
      where: {
        specialistId: profileId,
        endsAt: { gt: from },
        startsAt: { lt: to },
      },
      orderBy: [{ startsAt: 'asc' }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        studio: { select: { id: true, name: true, city: true } },
      },
    });
  }

  async create(actor: JwtAccessPayload, specialistUserId: string, dto: CreateSpecialistShiftDto) {
    const { profileId, studioIds } = await this.resolveSpecialistProfileId(actor, specialistUserId);

    if (!studioIds.includes(dto.studioId)) {
      throw new BadRequestException('Нельзя создать смену в студии, где специалист не ведёт приём');
    }
    if (actor.role === UserRole.StudioAdmin) {
      const myStudio = await this.getStudioAdminStudioId(actor.sub);
      if (dto.studioId !== myStudio) {
        throw new ForbiddenException('Можно управлять сменами только в своей студии');
      }
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: dto.studioId },
      select: { id: true, timezone: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }

    const s = this.parseDatetimeLocal(dto.startsAtLocal);
    const e = this.parseDatetimeLocal(dto.endsAtLocal);
    const startsAt = fromZonedTime(`${s.ymd}T${s.hh}:${s.mm}:00`, studio.timezone);
    const endsAt = fromZonedTime(`${e.ymd}T${e.hh}:${e.mm}:00`, studio.timezone);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Некорректные даты смены');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('Конец смены должен быть позже начала');
    }

    const overlaps = await this.prisma.specialistShift.findFirst({
      where: {
        specialistId: profileId,
        studioId: dto.studioId,
        status: { in: [ShiftStatus.Scheduled, ShiftStatus.Active] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
    if (overlaps) {
      throw new ConflictException('Смена пересекается с уже существующей');
    }

    return this.prisma.specialistShift.create({
      data: {
        specialistId: profileId,
        studioId: dto.studioId,
        startsAt,
        endsAt,
        status: ShiftStatus.Scheduled,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        studio: { select: { id: true, name: true, city: true } },
      },
    });
  }

  async createBulk(actor: JwtAccessPayload, specialistUserId: string, dto: CreateSpecialistShiftsBulkDto) {
    const { profileId, studioIds } = await this.resolveSpecialistProfileId(actor, specialistUserId);
    if (!studioIds.includes(dto.studioId)) {
      throw new BadRequestException('Нельзя создать смены в студии, где специалист не ведёт приём');
    }
    if (actor.role === UserRole.StudioAdmin) {
      const myStudio = await this.getStudioAdminStudioId(actor.sub);
      if (dto.studioId !== myStudio) {
        throw new ForbiddenException('Можно управлять сменами только в своей студии');
      }
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: dto.studioId },
      select: { id: true, timezone: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }

    const startMinutes = this.timeToMinutes(dto.startsAtLocal);
    const endMinutes = this.timeToMinutes(dto.endsAtLocal);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException('Конец смены должен быть позже начала');
    }

    const from = new Date(`${dto.fromDate}T00:00:00.000Z`);
    const to = new Date(`${dto.toDate}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Некорректный период дат');
    }
    if (to < from) {
      throw new BadRequestException('Дата окончания периода должна быть не раньше даты начала');
    }
    const totalDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (totalDays > 92) {
      throw new BadRequestException('Период слишком большой (максимум 92 дня)');
    }

    const weekdaySet = new Set(dto.weekdays);
    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < totalDays; i++) {
      const day = addDays(from, i);
      const weekday = day.getUTCDay();
      if (!weekdaySet.has(weekday)) continue;

      const ymd = day.toISOString().slice(0, 10);
      const startHH = String(Math.floor(startMinutes / 60)).padStart(2, '0');
      const startMM = String(startMinutes % 60).padStart(2, '0');
      const endHH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
      const endMM = String(endMinutes % 60).padStart(2, '0');
      const startsAt = fromZonedTime(`${ymd}T${startHH}:${startMM}:00`, studio.timezone);
      const endsAt = fromZonedTime(`${ymd}T${endHH}:${endMM}:00`, studio.timezone);

      const overlaps = await this.prisma.specialistShift.findFirst({
        where: {
          specialistId: profileId,
          studioId: dto.studioId,
          status: { in: [ShiftStatus.Scheduled, ShiftStatus.Active] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      });
      if (overlaps) {
        skippedCount += 1;
        continue;
      }

      await this.prisma.specialistShift.create({
        data: {
          specialistId: profileId,
          studioId: dto.studioId,
          startsAt,
          endsAt,
          status: ShiftStatus.Scheduled,
        },
      });
      createdCount += 1;
    }

    return { createdCount, skippedCount };
  }

  async update(
    actor: JwtAccessPayload,
    specialistUserId: string,
    shiftId: string,
    dto: UpdateSpecialistShiftDto,
  ) {
    const { profileId, studioIds } = await this.resolveSpecialistProfileId(actor, specialistUserId);

    const shift = await this.prisma.specialistShift.findUnique({
      where: { id: shiftId },
      select: { id: true, specialistId: true, studioId: true, startsAt: true, endsAt: true, status: true },
    });
    if (!shift || shift.specialistId !== profileId) {
      throw new NotFoundException('Смена не найдена');
    }

    const nextStudioId = dto.studioId ?? shift.studioId;
    if (!studioIds.includes(nextStudioId)) {
      throw new BadRequestException('Нельзя назначить смену в студии, где специалист не ведёт приём');
    }
    if (actor.role === UserRole.StudioAdmin) {
      const myStudio = await this.getStudioAdminStudioId(actor.sub);
      if (nextStudioId !== myStudio) {
        throw new ForbiddenException('Можно управлять сменами только в своей студии');
      }
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: nextStudioId },
      select: { id: true, timezone: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }

    const nextStartsAt =
      dto.startsAtLocal != null
        ? (() => {
            const s = this.parseDatetimeLocal(dto.startsAtLocal);
            return fromZonedTime(`${s.ymd}T${s.hh}:${s.mm}:00`, studio.timezone);
          })()
        : shift.startsAt;
    const nextEndsAt =
      dto.endsAtLocal != null
        ? (() => {
            const e = this.parseDatetimeLocal(dto.endsAtLocal);
            return fromZonedTime(`${e.ymd}T${e.hh}:${e.mm}:00`, studio.timezone);
          })()
        : shift.endsAt;

    if (Number.isNaN(nextStartsAt.getTime()) || Number.isNaN(nextEndsAt.getTime())) {
      throw new BadRequestException('Некорректные даты смены');
    }
    if (nextEndsAt <= nextStartsAt) {
      throw new BadRequestException('Конец смены должен быть позже начала');
    }

    const overlaps = await this.prisma.specialistShift.findFirst({
      where: {
        id: { not: shift.id },
        specialistId: profileId,
        studioId: nextStudioId,
        status: { in: [ShiftStatus.Scheduled, ShiftStatus.Active] },
        startsAt: { lt: nextEndsAt },
        endsAt: { gt: nextStartsAt },
      },
      select: { id: true },
    });
    if (overlaps) {
      throw new ConflictException('Смена пересекается с уже существующей');
    }

    return this.prisma.specialistShift.update({
      where: { id: shift.id },
      data: {
        studioId: nextStudioId,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        studio: { select: { id: true, name: true, city: true } },
      },
    });
  }

  async delete(actor: JwtAccessPayload, specialistUserId: string, shiftId: string) {
    const { profileId } = await this.resolveSpecialistProfileId(actor, specialistUserId);
    const shift = await this.prisma.specialistShift.findUnique({
      where: { id: shiftId },
      select: { id: true, specialistId: true, studioId: true },
    });
    if (!shift || shift.specialistId !== profileId) {
      throw new NotFoundException('Смена не найдена');
    }
    if (actor.role === UserRole.StudioAdmin) {
      const myStudio = await this.getStudioAdminStudioId(actor.sub);
      if (shift.studioId !== myStudio) {
        throw new ForbiddenException('Можно управлять сменами только в своей студии');
      }
    }

    await this.prisma.specialistShift.update({
      where: { id: shiftId },
      data: { status: ShiftStatus.Cancelled },
      select: { id: true },
    });
    return { ok: true };
  }
}
