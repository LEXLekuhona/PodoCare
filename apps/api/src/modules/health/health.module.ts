import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TerminusModule } from '@nestjs/terminus';

import { APPOINTMENTS_QUEUE } from '../appointments/application/appointments.jobs';
import { NOTIFICATIONS_QUEUE } from '../notifications/application/notifications.jobs';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue(
      {
        name: NOTIFICATIONS_QUEUE,
      },
      {
        name: APPOINTMENTS_QUEUE,
      },
    ),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
