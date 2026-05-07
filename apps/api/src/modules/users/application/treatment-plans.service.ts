/* eslint-disable import/order */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TreatmentPlanStatus, TreatmentPlanStepStatus, type Prisma } from '@prisma/client';
import { UserRole } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateTreatmentPlanDto } from '../presentation/dto/create-treatment-plan.dto';
import type { TreatmentPlanStepInputDto } from '../presentation/dto/treatment-plan-step.dto';
import type { UpdateTreatmentPlanDto } from '../presentation/dto/update-treatment-plan.dto';

@Injectable()
export class TreatmentPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async createForClient(clientId: string, actor: JwtAccessPayload, dto: CreateTreatmentPlanDto) {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true, role: true },
    });
    if (!client || client.role !== UserRole.Client) {
      throw new NotFoundException('Клиент не найден');
    }
    const studioId = await this.resolveStudioId(actor, dto.appointmentId);
    await this.assertStaffCanManageStudio(actor, studioId);

    const steps = this.normalizeSteps(dto.steps);
    const nowStatus = dto.status ?? TreatmentPlanStatus.ACTIVE;
    const created = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.treatmentPlan.create({
        data: {
          clientUserId: client.id,
          authorUserId: actor.sub,
          updatedByUserId: actor.sub,
          studioId,
          appointmentId: dto.appointmentId ?? null,
          title: dto.title.trim(),
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          status: nowStatus,
          steps: steps.map((step, index) => this.toLegacyStepSnapshot(step, index)),
          recommendedPhysicalGoodIds: dto.recommendedPhysicalGoodIds ?? [],
          recommendedContentSeriesIds: dto.recommendedContentSeriesIds ?? [],
          updateComment: this.normalizeNullable(dto.comment),
          planSteps: {
            create: steps.map((step, index) => ({
              sortOrder: index + 1,
              title: step.title,
              recommendation: step.recommendation,
              dueDate: step.dueDate ? new Date(step.dueDate) : null,
              status: step.status ?? TreatmentPlanStepStatus.PENDING,
            })),
          },
        },
        include: {
          planSteps: { orderBy: { sortOrder: 'asc' } },
        },
      });
      await tx.treatmentPlanRevision.create({
        data: {
          treatmentPlanId: plan.id,
          updatedByUserId: actor.sub,
          reason: this.normalizeNullable(dto.reason),
          comment: this.normalizeNullable(dto.comment),
          snapshot: this.revisionSnapshot(plan),
        },
      });
      return plan;
    });
    return this.mapPlan(created, false);
  }

  async updateForClient(
    clientId: string,
    planId: string,
    actor: JwtAccessPayload,
    dto: UpdateTreatmentPlanDto,
  ) {
    const plan = await this.prisma.treatmentPlan.findUnique({
      where: { id: planId },
      include: {
        planSteps: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!plan || plan.clientUserId !== clientId) {
      throw new NotFoundException('План лечения не найден');
    }
    await this.assertStaffCanManageStudio(actor, plan.studioId);

    const steps = dto.steps ? this.normalizeSteps(dto.steps) : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (steps) {
        await tx.treatmentPlanStep.deleteMany({ where: { treatmentPlanId: plan.id } });
      }
      const next = await tx.treatmentPlan.update({
        where: { id: plan.id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
          validUntil: dto.validUntil !== undefined ? (dto.validUntil ? new Date(dto.validUntil) : null) : undefined,
          status: dto.status,
          recommendedPhysicalGoodIds: dto.recommendedPhysicalGoodIds,
          recommendedContentSeriesIds: dto.recommendedContentSeriesIds,
          steps: steps
            ? steps.map((step, index) => this.toLegacyStepSnapshot(step, index))
            : undefined,
          updatedByUserId: actor.sub,
          updateComment: dto.comment !== undefined ? this.normalizeNullable(dto.comment) : undefined,
          planSteps: steps
            ? {
                create: steps.map((step, index) => ({
                  sortOrder: index + 1,
                  title: step.title,
                  recommendation: step.recommendation,
                  dueDate: step.dueDate ? new Date(step.dueDate) : null,
                  status: step.status ?? TreatmentPlanStepStatus.PENDING,
                })),
              }
            : undefined,
        },
        include: {
          planSteps: { orderBy: { sortOrder: 'asc' } },
        },
      });
      await tx.treatmentPlanRevision.create({
        data: {
          treatmentPlanId: next.id,
          updatedByUserId: actor.sub,
          reason: this.normalizeNullable(dto.reason),
          comment: this.normalizeNullable(dto.comment),
          snapshot: this.revisionSnapshot(next),
        },
      });
      return next;
    });

    return this.mapPlan(updated, false);
  }

  async listForClient(clientId: string, actor: JwtAccessPayload) {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true, role: true, studioId: true },
    });
    if (!client || client.role !== UserRole.Client) {
      throw new NotFoundException('Клиент не найден');
    }
    const plans = await this.prisma.treatmentPlan.findMany({
      where: { clientUserId: client.id },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        planSteps: { orderBy: { sortOrder: 'asc' } },
        revisions: {
          orderBy: [{ createdAt: 'desc' }],
          take: 20,
          select: {
            id: true,
            createdAt: true,
            reason: true,
            comment: true,
            updatedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (client.studioId) {
      await this.assertStaffCanManageStudio(actor, client.studioId);
    } else if (plans.length > 0) {
      await this.assertStaffCanManageStudio(actor, plans[0].studioId);
    }
    return plans.map((plan) => this.mapPlan(plan, true));
  }

  async listForMe(clientUserId: string) {
    const plans = await this.prisma.treatmentPlan.findMany({
      where: { clientUserId },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        planSteps: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return plans.map((plan) => this.mapPlan(plan, false));
  }

  private toLegacyStepSnapshot(step: TreatmentPlanStepInputDto, index: number) {
    return {
      step: index + 1,
      title: step.title,
      text: step.recommendation ?? step.title,
      dueDate: step.dueDate ?? null,
      status: step.status ?? TreatmentPlanStepStatus.PENDING,
    };
  }

  private normalizeSteps(steps: TreatmentPlanStepInputDto[] | undefined): TreatmentPlanStepInputDto[] {
    if (!steps || steps.length === 0) return [];
    return steps
      .map((step) => ({
        title: step.title.trim(),
        recommendation: this.normalizeNullable(step.recommendation) ?? undefined,
        dueDate: step.dueDate,
        status: step.status ?? TreatmentPlanStepStatus.PENDING,
      }))
      .filter((step) => step.title.length > 0);
  }

  private normalizeNullable(value: string | undefined): string | null {
    if (value === undefined) return null;
    const next = value.trim();
    return next === '' ? null : next;
  }

  private revisionSnapshot(plan: {
    id: string;
    title: string;
    status: TreatmentPlanStatus;
    validFrom: Date;
    validUntil: Date | null;
    recommendedPhysicalGoodIds: string[];
    recommendedContentSeriesIds: string[];
    planSteps: {
      id: string;
      sortOrder: number;
      title: string;
      recommendation: string | null;
      dueDate: Date | null;
      status: TreatmentPlanStepStatus;
      completedAt: Date | null;
    }[];
  }): Prisma.InputJsonValue {
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      validFrom: plan.validFrom.toISOString(),
      validUntil: plan.validUntil?.toISOString() ?? null,
      recommendedPhysicalGoodIds: plan.recommendedPhysicalGoodIds,
      recommendedContentSeriesIds: plan.recommendedContentSeriesIds,
      steps: plan.planSteps.map((step) => ({
        id: step.id,
        sortOrder: step.sortOrder,
        title: step.title,
        recommendation: step.recommendation,
        dueDate: step.dueDate?.toISOString() ?? null,
        status: step.status,
        completedAt: step.completedAt?.toISOString() ?? null,
      })),
    };
  }

  private mapPlan(
    plan: {
      id: string;
      title: string;
      status: TreatmentPlanStatus;
      validFrom: Date;
      validUntil: Date | null;
      updateComment: string | null;
      updatedAt: Date;
      planSteps: {
        id: string;
        sortOrder: number;
        title: string;
        recommendation: string | null;
        dueDate: Date | null;
        status: TreatmentPlanStepStatus;
      }[];
      revisions?: {
        id: string;
        createdAt: Date;
        reason: string | null;
        comment: string | null;
        updatedBy: {
          firstName: string;
          lastName: string;
        } | null;
      }[];
    },
    withRevisions: boolean,
  ) {
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      validFrom: plan.validFrom.toISOString(),
      validUntil: plan.validUntil?.toISOString() ?? null,
      updatedAt: plan.updatedAt.toISOString(),
      updateComment: plan.updateComment,
      steps: plan.planSteps.map((step) => ({
        id: step.id,
        sortOrder: step.sortOrder,
        title: step.title,
        recommendation: step.recommendation,
        dueDate: step.dueDate?.toISOString() ?? null,
        status: step.status,
      })),
      ...(withRevisions
        ? {
            revisions: (plan.revisions ?? []).map((revision) => ({
              id: revision.id,
              updatedAt: revision.createdAt.toISOString(),
              reason: revision.reason,
              comment: revision.comment,
              updatedBy: revision.updatedBy
                ? `${revision.updatedBy.firstName} ${revision.updatedBy.lastName}`.trim()
                : null,
            })),
          }
        : {}),
    };
  }

  private async resolveStudioId(actor: JwtAccessPayload, appointmentId?: string): Promise<string> {
    if (appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { studioId: true },
      });
      if (!appointment) {
        throw new NotFoundException('Запись не найдена');
      }
      return appointment.studioId;
    }
    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { studioId: true, specialistProfile: { select: { studioId: true } } },
    });
    const studioId = actorUser?.specialistProfile?.studioId ?? actorUser?.studioId ?? null;
    if (!studioId) {
      throw new ForbiddenException('Невозможно определить студию сотрудника');
    }
    return studioId;
  }

  private async assertStaffCanManageStudio(actor: JwtAccessPayload, studioId: string): Promise<void> {
    if (actor.role === UserRole.SuperAdmin) return;
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) throw new NotFoundException('Студия не найдена');

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
    if (!actorUser) throw new ForbiddenException('Пользователь не найден');

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
      if (!profile) throw new ForbiddenException('Профиль специалиста не найден');
      const canAccess = profile.studioId === studio.id || profile.studios.some((item) => item.studioId === studio.id);
      if (!canAccess) {
        throw new ForbiddenException('Специалист не работает в этой студии');
      }
      return;
    }
    throw new ForbiddenException('Недостаточно прав');
  }
}
