import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@Injectable()
export class MonetizationAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertStaffForNetwork(actor: JwtAccessPayload, networkId: string): Promise<void> {
    if (actor.role === UserRole.SuperAdmin) return;
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      select: { id: true },
    });
    if (!network) {
      throw new NotFoundException('Сеть не найдена');
    }

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
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

    if (actor.role === UserRole.NetworkOwner || actor.role === UserRole.StudioAdmin) {
      if (actorUser.studio?.networkId !== networkId) {
        throw new ForbiddenException('Нет доступа к этой сети');
      }
      return;
    }
    if (actor.role === UserRole.Specialist) {
      const profile = actorUser.specialistProfile;
      if (!profile) {
        throw new ForbiddenException('Профиль специалиста не найден');
      }
      const studioIds = [profile.studioId, ...profile.studios.map((s) => s.studioId)];
      const count = await this.prisma.studio.count({
        where: { id: { in: studioIds }, networkId },
      });
      if (count === 0) {
        throw new ForbiddenException('Специалист не работает в этой сети');
      }
      return;
    }
    throw new ForbiddenException('Недостаточно прав');
  }

  /**
   * Счёт после приёма может выставить специалист, проводивший приём, либо админ сети/студии.
   */
  async assertStaffCanIssueVisitInvoice(
    actor: JwtAccessPayload,
    appt: { studioId: string; specialistId: string },
  ): Promise<void> {
    if (actor.role === UserRole.SuperAdmin) {
      return;
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: appt.studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }

    await this.assertStaffForNetwork(actor, studio.networkId);

    if (actor.role === UserRole.Specialist) {
      const profile = await this.prisma.specialistProfile.findUnique({
        where: { userId: actor.sub },
        select: { id: true },
      });
      if (!profile || profile.id !== appt.specialistId) {
        throw new ForbiddenException('Счёт может выставить только специалист этого приёма');
      }
      return;
    }

    if (actor.role === UserRole.StudioAdmin) {
      const actorUser = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { studioId: true },
      });
      if (actorUser?.studioId !== studio.id) {
        throw new ForbiddenException('Нет доступа к этой студии');
      }
    }
  }

  async assertStaffForOrderStudio(actor: JwtAccessPayload, studioId: string | null): Promise<void> {
    if (actor.role === UserRole.SuperAdmin) return;
    if (!studioId) {
      throw new ForbiddenException('У заказа не указана студия');
    }
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) {
      throw new NotFoundException('Студия не найдена');
    }
    await this.assertStaffForNetwork(actor, studio.networkId);
    if (actor.role === UserRole.StudioAdmin) {
      const actorUser = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { studioId: true },
      });
      if (actorUser?.studioId !== studio.id) {
        throw new ForbiddenException('Нет доступа к этой студии');
      }
      return;
    }
    if (actor.role === UserRole.Specialist) {
      const actorUser = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: {
          specialistProfile: {
            select: { studioId: true, studios: { select: { studioId: true } } },
          },
        },
      });
      const profile = actorUser?.specialistProfile;
      if (!profile) {
        throw new ForbiddenException('Профиль специалиста не найден');
      }
      const allowed = new Set<string>([profile.studioId, ...profile.studios.map((s) => s.studioId)]);
      if (!allowed.has(studio.id)) {
        throw new ForbiddenException('Нет доступа к этой студии');
      }
    }
  }
}
