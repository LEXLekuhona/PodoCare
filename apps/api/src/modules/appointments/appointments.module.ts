import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { NotificationsModule } from '../notifications/notifications.module';
import { APPOINTMENTS_QUEUE } from './application/appointments.jobs';
import { AppointmentsService } from './application/appointments.service';
import { AppointmentsProcessor } from './infrastructure/queue/appointments.processor';
import { AppointmentsController } from './presentation/appointments.controller';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({
      name: APPOINTMENTS_QUEUE,
    }),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsProcessor],
  exports: [BullModule],
})
export class AppointmentsModule {}
