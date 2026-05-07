/* eslint-disable import/order */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@srs/shared-types';

import {
  APPOINTMENTS_QUEUE,
  APPOINTMENT_AUTO_NO_SHOW_JOB,
  APPOINTMENT_AUTO_START_JOB,
  type AppointmentLifecycleJobData,
} from '../../application/appointments.jobs';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import type { Job } from 'bullmq';

@Injectable()
@Processor(APPOINTMENTS_QUEUE)
export class AppointmentsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AppointmentLifecycleJobData>): Promise<void> {
    if (job.name === APPOINTMENT_AUTO_START_JOB) {
      await this.autoStart(job.data.appointmentId);
      return;
    }
    if (job.name === APPOINTMENT_AUTO_NO_SHOW_JOB) {
      await this.autoNoShow(job.data.appointmentId);
      return;
    }
    throw new Error(`Unknown appointments job: ${job.name}`);
  }

  private async autoStart(appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, status: true, startsAt: true },
    });
    if (!appointment) {
      return;
    }
    if (![AppointmentStatus.Pending, AppointmentStatus.Confirmed].includes(appointment.status as AppointmentStatus)) {
      return;
    }
    if (appointment.startsAt.getTime() > Date.now()) {
      return;
    }
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.InProgress },
    });
  }

  private async autoNoShow(appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, status: true, endsAt: true, checkedInAt: true, completedAt: true },
    });
    if (!appointment) {
      return;
    }
    if (![AppointmentStatus.Pending, AppointmentStatus.Confirmed].includes(appointment.status as AppointmentStatus)) {
      return;
    }
    if (appointment.checkedInAt || appointment.completedAt) {
      return;
    }
    if (appointment.endsAt.getTime() + 15 * 60 * 1000 > Date.now()) {
      return;
    }
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.NoShow },
    });
  }
}
