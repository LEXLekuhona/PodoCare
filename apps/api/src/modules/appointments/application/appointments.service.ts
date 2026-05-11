/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime imports */
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AppointmentSource, AppointmentStatus, ShiftStatus, UserRole } from '@srs/shared-types';
import type { Queue } from 'bullmq';
import { addDays, addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { AppointmentsConfig } from '../../../config/appointments.config';
import { normalizePhone } from '../../../common/utils/normalize-phone';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  APPOINTMENTS_QUEUE,
  APPOINTMENT_AUTO_NO_SHOW_JOB,
  APPOINTMENT_AUTO_START_JOB,
  APPOINTMENT_LIFECYCLE_JOB_PREFIX,
} from './appointments.jobs';
import type { BookingSlotsQueryDto } from '../presentation/dto/booking-slots-query.dto';
import { CreateAppointmentDto } from '../presentation/dto/create-appointment.dto';
import type { CreateAppointmentProtocolDto } from '../presentation/dto/create-appointment-protocol.dto';
import { ListAppointmentsQueryDto } from '../presentation/dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from '../presentation/dto/reschedule-appointment.dto';
import type { UpdateAppointmentProtocolDto } from '../presentation/dto/update-appointment-protocol.dto';
import type { CreateWalkInClientDto } from '../presentation/dto/create-walk-in-client.dto';

const SLOT_STEP_MINUTES = 30;

export type BookingSlotItemDto = {
  startsAt: string;
  label: string;
  available: boolean;
  unavailableReason?: string;
};

export type BookingSlotsDayDto = {
  date: string;
  weekdayShort: string;
  weekdayIndex: number;
  disabled: boolean;
  disabledReason?: string;
  slots: BookingSlotItemDto[];
};

@Injectable()
export class AppointmentsService {
  private readonly minLeadMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue(APPOINTMENTS_QUEUE) private readonly appointmentsQueue: Queue,
  ) {
    this.minLeadMinutes = this.configService.getOrThrow<AppointmentsConfig>('appointments').minLeadMinutes;
  }

  async bookingSlots(query: BookingSlotsQueryDto): Promise<{
    timezone: string;
    slotStepMinutes: number;
    serviceDurationMinutes: number;
    days: BookingSlotsDayDto[];
  }> {
    const horizonDays = Math.min(Math.max(query.days ?? 14, 1), 31);

    const [service, specialist, studio] = await Promise.all([
      this.prisma.service.findUnique({
        where: { id: query.serviceId },
        select: { id: true, studioId: true, durationMinutes: true },
      }),
      this.prisma.specialistProfile.findFirst({
        where: {
          id: query.specialistId,
          studios: { some: { studioId: query.studioId } },
        },
        select: { id: true },
      }),
      this.prisma.studio.findUnique({
        where: { id: query.studioId },
        select: { id: true, timezone: true, openingHours: true },
      }),
    ]);

    if (!service || service.studioId !== query.studioId) {
      throw new NotFoundException('Услуга не найдена в указанной студии');
    }
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    if (!specialist) {
      throw new NotFoundException('Специалист не найден в указанной студии');
    }

    const tz = studio.timezone;
    const durationMinutes = service.durationMinutes;
    const openingHours = studio.openingHours;

    const fromDateRaw = query.fromDate?.trim();
    const anchorYmd = fromDateRaw ? fromDateRaw : formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');

    const anchorLocalNoon = fromZonedTime(`${anchorYmd}T12:00:00`, tz);

    const rangeStartUtc = addDays(anchorLocalNoon, -1);
    const rangeEndUtc = addDays(anchorLocalNoon, horizonDays + 1);

    const firstYmd = formatInTimeZone(anchorLocalNoon, tz, 'yyyy-MM-dd');
    const lastYmd = formatInTimeZone(addDays(anchorLocalNoon, horizonDays - 1), tz, 'yyyy-MM-dd');

    const [shifts, appointments, closedDays] = await Promise.all([
      this.prisma.specialistShift.findMany({
        where: {
          specialistId: query.specialistId,
          studioId: query.studioId,
          status: { in: [ShiftStatus.Scheduled, ShiftStatus.Active] },
          endsAt: { gt: rangeStartUtc },
          startsAt: { lt: rangeEndUtc },
        },
        select: { id: true, startsAt: true, endsAt: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          specialistId: query.specialistId,
          status: {
            in: [AppointmentStatus.Pending, AppointmentStatus.Confirmed, AppointmentStatus.InProgress],
          },
          startsAt: { lt: rangeEndUtc },
          endsAt: { gt: rangeStartUtc },
        },
        select: { startsAt: true, endsAt: true },
      }),
      this.prisma.studioClosedDay.findMany({
        where: {
          studioId: query.studioId,
          date: {
            gte: new Date(`${firstYmd}T00:00:00.000Z`),
            lte: new Date(`${lastYmd}T00:00:00.000Z`),
          },
        },
        select: { date: true },
      }),
    ]);

    const closedYmd = new Set(closedDays.map((c) => c.date.toISOString().slice(0, 10)));

    const weekdayRu = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

    const daysOut: BookingSlotsDayDto[] = [];

    for (let i = 0; i < horizonDays; i++) {
      const dayCenter = addDays(anchorLocalNoon, i);
      const ymd = formatInTimeZone(dayCenter, tz, 'yyyy-MM-dd');

      const wdFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
      });
      const wdToken = wdFormatter.format(dayCenter);
      const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wdToken);
      const weekdayShort = weekdayIndex >= 0 ? weekdayRu[weekdayIndex] : '?';

      if (closedYmd.has(ymd)) {
        daysOut.push({
          date: ymd,
          weekdayShort,
          weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : 0,
          disabled: true,
          disabledReason: 'Студия закрыта в этот день',
          slots: [],
        });
        continue;
      }

      const daySchedule =
        openingHours &&
        typeof openingHours === 'object' &&
        !Array.isArray(openingHours) &&
        weekdayIndex >= 0
          ? (openingHours as Record<string, unknown>)[String(weekdayIndex)]
          : undefined;

      if (
        !daySchedule ||
        typeof daySchedule !== 'object' ||
        Array.isArray(daySchedule) ||
        !('open' in daySchedule) ||
        !('close' in daySchedule)
      ) {
        daysOut.push({
          date: ymd,
          weekdayShort,
          weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : 0,
          disabled: true,
          disabledReason: 'В этот день студия не работает',
          slots: [],
        });
        continue;
      }

      const openStr = String((daySchedule as { open?: unknown }).open ?? '');
      const closeStr = String((daySchedule as { close?: unknown }).close ?? '');
      const openMinutes = this.timeToMinutes(openStr);
      const closeMinutes = this.timeToMinutes(closeStr);

      const dayStartUtc = fromZonedTime(`${ymd}T00:00:00`, tz);
      const dayEndUtc = fromZonedTime(`${ymd}T23:59:59`, tz);

      const shiftsToday = shifts.filter((s) => s.startsAt < dayEndUtc && s.endsAt > dayStartUtc);

      if (shiftsToday.length === 0) {
        daysOut.push({
          date: ymd,
          weekdayShort,
          weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : 0,
          disabled: true,
          disabledReason: 'У специалиста нет смен в этот день',
          slots: [],
        });
        continue;
      }

      const slots: BookingSlotItemDto[] = [];
      const reasonCounts = new Map<string, number>();

      for (let minutesFromMidnight = openMinutes; minutesFromMidnight + durationMinutes <= closeMinutes; minutesFromMidnight += SLOT_STEP_MINUTES) {
        const hh = Math.floor(minutesFromMidnight / 60);
        const mm = minutesFromMidnight % 60;
        const hhStr = String(hh).padStart(2, '0');
        const mmStr = String(mm).padStart(2, '0');
        const startsAt = fromZonedTime(`${ymd}T${hhStr}:${mmStr}:00`, tz);
        const endsAt = addMinutes(startsAt, durationMinutes);

        const coveredByShift = shiftsToday.some((s) => s.startsAt <= startsAt && s.endsAt >= endsAt);
        const overlapsAppointment = appointments.some(
          (a) => a.startsAt < endsAt && a.endsAt > startsAt,
        );

        const withinHours = this.isWithinStudioHoursSafe(startsAt, endsAt, tz, openingHours);
        const leadOk = this.canBookAt(startsAt);
        const available = coveredByShift && withinHours && leadOk && !overlapsAppointment;

        slots.push({
          startsAt: startsAt.toISOString(),
          label: `${hhStr}:${mmStr}`,
          available,
          ...(available
            ? {}
            : {
                unavailableReason: !coveredByShift
                  ? 'Нет смены специалиста'
                  : !withinHours
                    ? 'Студия закрыта'
                    : !leadOk
                      ? 'Слишком рано для записи'
                      : overlapsAppointment
                        ? 'Занято'
                        : 'Недоступно',
              }),
        });

        if (!available) {
          const r =
            !coveredByShift
              ? 'Нет смены специалиста'
              : !withinHours
                ? 'Студия закрыта'
                : !leadOk
                  ? 'Слишком рано для записи'
                  : overlapsAppointment
                    ? 'Занято'
                    : 'Недоступно';
          reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
        }
      }

      const anyAvailable = slots.some((s) => s.available);
      const disabledReason =
        anyAvailable || reasonCounts.size === 0
          ? undefined
          : [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Нет доступного времени';
      daysOut.push({
        date: ymd,
        weekdayShort,
        weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : 0,
        disabled: !anyAvailable,
        disabledReason,
        slots,
      });
    }

    return {
      timezone: tz,
      slotStepMinutes: SLOT_STEP_MINUTES,
      serviceDurationMinutes: durationMinutes,
      days: daysOut,
    };
  }

  async nextForClient(clientUserId: string, studioId?: string) {
    const now = new Date();
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        clientUserId,
        studioId,
        startsAt: { gte: now },
        status: {
          in: [AppointmentStatus.Pending, AppointmentStatus.Confirmed, AppointmentStatus.InProgress],
        },
      },
      orderBy: [{ startsAt: 'asc' }],
      select: {
        id: true,
        startsAt: true,
        status: true,
        studio: { select: { id: true, name: true, address: true, city: true, phone: true } },
        specialist: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
    });

    if (!appointment) return null;

    return {
      id: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      status: appointment.status,
      studio: appointment.studio,
      specialist: {
        ...appointment.specialist.user,
        id: appointment.specialist.id,
      },
      service: appointment.service,
    };
  }

  async create(dto: CreateAppointmentDto, actor?: JwtAccessPayload) {
    if (!dto.clientUserId && !dto.walkInClientId) {
      throw new BadRequestException('Нужно передать clientUserId или walkInClientId');
    }

    if (actor?.role === UserRole.Specialist) {
      const profile = await this.prisma.specialistProfile.findUnique({
        where: { userId: actor.sub },
        select: { id: true, studioId: true, studios: { select: { studioId: true } } },
      });
      if (!profile) {
        throw new ForbiddenException('Профиль специалиста не найден');
      }
      if (dto.specialistId !== profile.id) {
        throw new ForbiddenException('Можно записать клиента только на приём к себе');
      }
      const allowedStudios = new Set<string>([profile.studioId, ...profile.studios.map((s) => s.studioId)]);
      if (!allowedStudios.has(dto.studioId)) {
        throw new ForbiddenException('Нет доступа к этой студии');
      }
    }

    const [service, specialist, studio] = await Promise.all([
      this.prisma.service.findUnique({
        where: { id: dto.serviceId },
        select: { id: true, studioId: true, durationMinutes: true, priceMinor: true, currency: true },
      }),
      this.prisma.specialistProfile.findFirst({
        where: {
          id: dto.specialistId,
          studios: { some: { studioId: dto.studioId } },
        },
        select: { id: true },
      }),
      this.prisma.studio.findUnique({
        where: { id: dto.studioId },
        select: { id: true, timezone: true, openingHours: true },
      }),
    ]);

    if (!service || service.studioId !== dto.studioId) {
      throw new NotFoundException('Услуга не найдена в указанной студии');
    }
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    if (!specialist) {
      throw new NotFoundException('Специалист не найден в указанной студии');
    }

    const endsAt = addMinutes(dto.startsAt, service.durationMinutes);
    this.assertCanBookAt(dto.startsAt);
    this.assertWithinStudioHours(dto.startsAt, endsAt, studio.timezone, studio.openingHours);

    if (dto.clientUserId) {
      const client = await this.prisma.user.findUnique({
        where: { id: dto.clientUserId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundException('Клиент не найден');
      }
    }
    if (dto.walkInClientId) {
      const walkInClient = await this.prisma.walkInClient.findUnique({
        where: { id: dto.walkInClientId },
        select: { id: true, studioId: true },
      });
      if (!walkInClient || walkInClient.studioId !== dto.studioId) {
        throw new NotFoundException('Walk-in клиент не найден в указанной студии');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await this.acquireSlotLock(tx, dto.specialistId, dto.startsAt);
      await this.assertSlotAvailable(
        {
          studioId: dto.studioId,
          specialistId: dto.specialistId,
          startsAt: dto.startsAt,
          endsAt,
        },
        tx,
      );
      return tx.appointment.create({
        data: {
          studioId: dto.studioId,
          specialistId: dto.specialistId,
          serviceId: dto.serviceId,
          clientUserId: dto.clientUserId,
          walkInClientId: dto.walkInClientId,
          startsAt: dto.startsAt,
          endsAt,
          source: dto.source ?? AppointmentSource.MobileApp,
          status: AppointmentStatus.Pending,
          totalMinor: service.priceMinor,
          currency: service.currency,
          clientNote: dto.clientNote,
          specialistNote: dto.specialistNote,
        },
      });
    });
    await this.notificationsService.scheduleAppointmentReminders(created.id);
    await this.scheduleLifecycleJobs(created.id, created.startsAt, created.endsAt);
    return created;
  }

  async list(query: ListAppointmentsQueryDto, actor: JwtAccessPayload) {
    const where: Prisma.AppointmentWhereInput = {};
    if (query.studioId) where.studioId = query.studioId;
    if (query.specialistId) where.specialistId = query.specialistId;
    if (query.clientUserId) where.clientUserId = query.clientUserId;
    if (query.from || query.to) {
      where.startsAt = {};
      if (query.from) where.startsAt.gte = query.from;
      if (query.to) where.startsAt.lte = query.to;
    }

    if (actor.role === UserRole.Specialist) {
      const profile = await this.prisma.specialistProfile.findUnique({
        where: { userId: actor.sub },
        select: {
          id: true,
          studioId: true,
          studios: { select: { studioId: true } },
        },
      });
      if (!profile) {
        throw new ForbiddenException('Профиль специалиста не найден');
      }
      if (query.specialistId && query.specialistId !== profile.id) {
        throw new ForbiddenException();
      }
      where.specialistId = profile.id;
      const allowedStudios = new Set<string>([
        profile.studioId,
        ...profile.studios.map((item) => item.studioId),
      ]);
      if (query.studioId && !allowedStudios.has(query.studioId)) {
        throw new ForbiddenException('Нет доступа к этой студии');
      }
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        walkIn: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        service: { select: { id: true, name: true } },
        studio: { select: { id: true, name: true, city: true } },
        specialist: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ startsAt: 'asc' }],
      take: 200, // защита от случайного дампа всей таблицы
    });
  }

  async searchWalkInClients(actor: JwtAccessPayload, studioId: string, q?: string) {
    await this.assertStaffCanManageStudio(actor, studioId);
    const trimmed = q?.trim() ?? '';
    if (trimmed.length < 2) {
      return [];
    }
    let normalizedPhone: string | undefined;
    try {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 10) {
        normalizedPhone = normalizePhone(trimmed);
      }
    } catch {
      normalizedPhone = undefined;
    }
    const orClause: Prisma.WalkInClientWhereInput[] = [
      { firstName: { contains: trimmed, mode: 'insensitive' } },
      { lastName: { contains: trimmed, mode: 'insensitive' } },
      { phone: { contains: trimmed.replace(/\s/g, '') } },
    ];
    if (normalizedPhone) {
      orClause.push({ phone: normalizedPhone });
    }
    const where: Prisma.WalkInClientWhereInput = { studioId, OR: orClause };
    return this.prisma.walkInClient.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        linkedUserId: true,
        createdAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 30,
    });
  }

  async createWalkInClient(actor: JwtAccessPayload, dto: CreateWalkInClientDto) {
    await this.assertStaffCanManageStudio(actor, dto.studioId);
    const phone = normalizePhone(dto.phone);
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('Укажите имя и фамилию');
    }
    try {
      return await this.prisma.walkInClient.create({
        data: {
          studioId: dto.studioId,
          firstName,
          lastName,
          phone,
          note: dto.note?.trim() || null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          linkedUserId: true,
          createdAt: true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('В этой студии уже есть карточка с таким телефоном');
      }
      throw e;
    }
  }

  async confirm(id: string, actor: JwtAccessPayload) {
    const appointment = await this.ensureAppointmentExists(id);
    await this.assertStaffCanManageStudio(actor, appointment.studioId);
    if (
      appointment.status === AppointmentStatus.CancelledByClient ||
      appointment.status === AppointmentStatus.CancelledByStudio
    ) {
      throw new ConflictException('Отменённую запись нельзя подтвердить');
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.Confirmed },
    });
    await this.revokeLifecycleJobs(id);
    await this.scheduleLifecycleJobs(id, updated.startsAt, updated.endsAt);
    await this.notificationsService.revokeAppointmentReminders(id);
    await this.notificationsService.scheduleAppointmentReminders(id);
    return updated;
  }

  async cancelByClient(id: string, clientUserId: string, reason?: string) {
    const appointment = await this.ensureAppointmentExists(id);
    if (appointment.clientUserId !== clientUserId) {
      throw new ForbiddenException('Нет доступа к этой записи');
    }
    if (
      appointment.status === AppointmentStatus.CancelledByClient ||
      appointment.status === AppointmentStatus.CancelledByStudio
    ) {
      throw new ConflictException('Запись уже отменена');
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CancelledByClient,
        cancelledAt: new Date(),
        cancellationReason: reason?.trim() || null,
      },
    });
    await this.notificationsService.revokeAppointmentReminders(id);
    await this.revokeLifecycleJobs(id);
    return updated;
  }

  async cancelByStudio(id: string, actor: JwtAccessPayload, reason?: string) {
    const appointment = await this.ensureAppointmentExists(id);
    await this.assertStaffCanManageStudio(actor, appointment.studioId);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CancelledByStudio,
        cancelledAt: new Date(),
        cancellationReason: reason?.trim() || null,
      },
    });
    await this.notificationsService.revokeAppointmentReminders(id);
    await this.revokeLifecycleJobs(id);
    return updated;
  }

  async reschedule(id: string, actor: JwtAccessPayload, dto: RescheduleAppointmentDto) {
    const appointment = await this.ensureAppointmentExists(id);
    await this.assertStaffCanManageStudio(actor, appointment.studioId);
    if (
      appointment.status === AppointmentStatus.CancelledByClient ||
      appointment.status === AppointmentStatus.CancelledByStudio
    ) {
      throw new ConflictException('Нельзя переносить отменённую запись');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: appointment.serviceId },
      select: { durationMinutes: true },
    });
    if (!service) {
      throw new NotFoundException('Услуга для записи не найдена');
    }

    const endsAt = addMinutes(dto.startsAt, service.durationMinutes);
    const studio = await this.prisma.studio.findUnique({
      where: { id: appointment.studioId },
      select: { timezone: true, openingHours: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    this.assertCanBookAt(dto.startsAt);
    this.assertWithinStudioHours(dto.startsAt, endsAt, studio.timezone, studio.openingHours);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.acquireSlotLock(tx, appointment.specialistId, dto.startsAt);
      await this.assertSlotAvailable(
        {
          studioId: appointment.studioId,
          specialistId: appointment.specialistId,
          startsAt: dto.startsAt,
          endsAt,
          excludeAppointmentId: appointment.id,
        },
        tx,
      );

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          startsAt: dto.startsAt,
          endsAt,
          status: AppointmentStatus.Confirmed,
          cancellationReason: dto.reason?.trim() || null,
        },
      });
    });
    await this.notificationsService.revokeAppointmentReminders(id);
    await this.notificationsService.scheduleAppointmentReminders(id);
    await this.revokeLifecycleJobs(id);
    await this.scheduleLifecycleJobs(id, updated.startsAt, updated.endsAt);
    return updated;
  }

  async createProtocol(id: string, actor: JwtAccessPayload, dto: CreateAppointmentProtocolDto) {
    const appointment = await this.ensureAppointmentExists(id);
    await this.assertStaffCanManageStudio(actor, appointment.studioId);
    if (appointment.status === AppointmentStatus.CancelledByClient || appointment.status === AppointmentStatus.CancelledByStudio) {
      throw new ConflictException('Нельзя создать протокол для отменённой записи');
    }

    const existing = await this.prisma.appointmentProtocol.findUnique({
      where: { appointmentId: appointment.id },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Протокол для этого визита уже существует');
    }

    return this.prisma.appointmentProtocol.create({
      data: {
        appointmentId: appointment.id,
        authorUserId: actor.sub,
        updatedByUserId: actor.sub,
        proceduresDone: this.normalizeStringList(dto.proceduresDone),
        diagnosis: this.normalizeNullable(dto.diagnosis),
        materialsUsed: this.normalizeNullable(dto.materialsUsed),
        internalNote: this.normalizeNullable(dto.internalNote),
        clientVisible: dto.clientVisible,
        updateReason: this.normalizeNullable(dto.reason),
        updateComment: this.normalizeNullable(dto.comment),
      },
    });
  }

  async updateProtocol(id: string, actor: JwtAccessPayload, dto: UpdateAppointmentProtocolDto) {
    const appointment = await this.ensureAppointmentExists(id);
    await this.assertStaffCanManageStudio(actor, appointment.studioId);
    const protocol = await this.prisma.appointmentProtocol.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (!protocol) {
      throw new NotFoundException('Протокол для этого визита не найден');
    }

    return this.prisma.appointmentProtocol.update({
      where: { appointmentId: appointment.id },
      data: {
        proceduresDone: dto.proceduresDone ? this.normalizeStringList(dto.proceduresDone) : undefined,
        diagnosis: dto.diagnosis !== undefined ? this.normalizeNullable(dto.diagnosis) : undefined,
        materialsUsed: dto.materialsUsed !== undefined ? this.normalizeNullable(dto.materialsUsed) : undefined,
        internalNote: dto.internalNote !== undefined ? this.normalizeNullable(dto.internalNote) : undefined,
        clientVisible: dto.clientVisible,
        updatedByUserId: actor.sub,
        updateReason: dto.reason !== undefined ? this.normalizeNullable(dto.reason) : undefined,
        updateComment: dto.comment !== undefined ? this.normalizeNullable(dto.comment) : undefined,
      },
    });
  }

  private async ensureAppointmentExists(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Запись не найдена');
    }
    return appointment;
  }

  private normalizeNullable(value: string | undefined): string | null {
    if (value === undefined) return null;
    const next = value.trim();
    return next === '' ? null : next;
  }

  private normalizeStringList(value: string[] | undefined): string[] {
    if (!value) return [];
    return value.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  private async assertStaffCanManageStudio(actor: JwtAccessPayload, studioId: string): Promise<void> {
    if (actor.role === UserRole.SuperAdmin) return;
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        id: true,
        role: true,
        studioId: true,
        studio: { select: { networkId: true } },
        specialistProfile: {
          select: {
            studioId: true,
            studios: { select: { studioId: true } },
          },
        },
      },
    });
    if (!actorUser) {
      throw new ForbiddenException('Пользователь не найден');
    }
    if (actor.role === UserRole.NetworkOwner) {
      if (actorUser.studio?.networkId !== studio.networkId) {
        throw new ForbiddenException('Нет доступа к этой сети');
      }
      return;
    }
    if (actor.role === UserRole.StudioAdmin) {
      if (actorUser.studioId !== studio.id) {
        throw new ForbiddenException('Нет доступа к этой студии');
      }
      return;
    }
    if (actor.role === UserRole.Specialist) {
      const profile = actorUser.specialistProfile;
      if (!profile) {
        throw new ForbiddenException('Профиль специалиста не найден');
      }
      const canAccess = profile.studioId === studio.id || profile.studios.some((item) => item.studioId === studio.id);
      if (!canAccess) {
        throw new ForbiddenException('Специалист не работает в этой студии');
      }
      return;
    }
    throw new ForbiddenException('Недостаточно прав');
  }

  private async assertSlotAvailable(input: {
    studioId: string;
    specialistId: string;
    startsAt: Date;
    endsAt: Date;
    excludeAppointmentId?: string;
  }, db: Prisma.TransactionClient | PrismaService = this.prisma): Promise<void> {
    const [shift, overlapping] = await Promise.all([
      db.specialistShift.findFirst({
        where: {
          specialistId: input.specialistId,
          studioId: input.studioId,
          startsAt: { lte: input.startsAt },
          endsAt: { gte: input.endsAt },
          status: { in: ['SCHEDULED', 'ACTIVE'] },
        },
        select: { id: true },
      }),
      db.appointment.findFirst({
        where: {
          specialistId: input.specialistId,
          id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
        select: { id: true },
      }),
    ]);

    if (!shift) {
      throw new ConflictException('У специалиста нет активной смены на выбранный слот');
    }
    if (overlapping) {
      throw new ConflictException('Слот уже занят другой записью');
    }
  }

  private async scheduleLifecycleJobs(
    appointmentId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const now = Date.now();
    const startDelay = Math.max(0, startsAt.getTime() - now);
    const noShowDelay = Math.max(0, endsAt.getTime() + 15 * 60 * 1000 - now);
    await this.appointmentsQueue.add(
      APPOINTMENT_AUTO_START_JOB,
      { appointmentId },
      {
        jobId: `${APPOINTMENT_LIFECYCLE_JOB_PREFIX}_${appointmentId}_start_${startsAt.getTime()}`,
        delay: startDelay,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
    await this.appointmentsQueue.add(
      APPOINTMENT_AUTO_NO_SHOW_JOB,
      { appointmentId },
      {
        jobId: `${APPOINTMENT_LIFECYCLE_JOB_PREFIX}_${appointmentId}_noshow_${endsAt.getTime()}`,
        delay: noShowDelay,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  private async revokeLifecycleJobs(appointmentId: string): Promise<void> {
    const prefix = `${APPOINTMENT_LIFECYCLE_JOB_PREFIX}_${appointmentId}_`;
    const jobs = await this.appointmentsQueue.getJobs(['delayed', 'waiting']);
    const target = jobs.filter((job) => String(job.id).startsWith(prefix));
    await Promise.all(target.map((job) => job.remove()));
  }

  private async acquireSlotLock(
    tx: Prisma.TransactionClient,
    specialistId: string,
    startsAt: Date,
  ): Promise<void> {
    const key = `${specialistId}:${startsAt.toISOString().slice(0, 16)}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`;
  }

  private assertCanBookAt(startsAt: Date): void {
    const now = Date.now();
    if (startsAt.getTime() <= now) {
      throw new BadRequestException('Нельзя создавать запись в прошлом');
    }
    const minAllowed = now + this.minLeadMinutes * 60 * 1000;
    if (startsAt.getTime() < minAllowed) {
      throw new BadRequestException(
        `Запись доступна минимум за ${this.minLeadMinutes} минут до начала`,
      );
    }
  }

  private canBookAt(startsAt: Date): boolean {
    try {
      this.assertCanBookAt(startsAt);
      return true;
    } catch {
      return false;
    }
  }

  private isWithinStudioHoursSafe(
    startsAt: Date,
    endsAt: Date,
    timezone: string,
    openingHours: Prisma.JsonValue,
  ): boolean {
    try {
      this.assertWithinStudioHours(startsAt, endsAt, timezone, openingHours);
      return true;
    } catch {
      return false;
    }
  }

  private assertWithinStudioHours(
    startsAt: Date,
    endsAt: Date,
    timezone: string,
    openingHours: Prisma.JsonValue,
  ): void {
    if (!openingHours || typeof openingHours !== 'object' || Array.isArray(openingHours)) {
      return;
    }
    if (Object.keys(openingHours as Record<string, unknown>).length === 0) {
      return;
    }

    const startParts = this.getLocalDateTimeParts(startsAt, timezone);
    const endParts = this.getLocalDateTimeParts(endsAt, timezone);
    if (startParts.weekday !== endParts.weekday) {
      throw new ConflictException('Запись не может пересекать границу дня студии');
    }
    const daySchedule = (openingHours as Record<string, unknown>)[String(startParts.weekday)];
    if (!daySchedule || typeof daySchedule !== 'object' || Array.isArray(daySchedule)) {
      throw new ConflictException('Студия закрыта в выбранный день');
    }
    const open = (daySchedule as { open?: string }).open;
    const close = (daySchedule as { close?: string }).close;
    if (!open || !close) {
      throw new ConflictException('Студия закрыта в выбранный день');
    }
    const startMinutes = this.timeToMinutes(startParts.hhmm);
    const endMinutes = this.timeToMinutes(endParts.hhmm);
    const openMinutes = this.timeToMinutes(open);
    const closeMinutes = this.timeToMinutes(close);
    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      throw new ConflictException('Слот вне рабочего времени студии');
    }
  }

  private getLocalDateTimeParts(date: Date, timezone: string): { weekday: number; hhmm: string } {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const weekdayToken = parts.find((p) => p.type === 'weekday')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const weekday = weekdayToken ? weekdayMap[weekdayToken] : undefined;
    if (weekday === undefined) {
      throw new BadRequestException('Не удалось определить день недели студии');
    }
    return { weekday, hhmm: `${hour}:${minute}` };
  }

  private timeToMinutes(value: string): number {
    const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new BadRequestException(`Некорректное время "${value}"`);
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  }
}
