import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { APPOINTMENTS_QUEUE } from '../appointments/application/appointments.jobs';
import { NOTIFICATIONS_QUEUE } from '../notifications/application/notifications.jobs';

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
