import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MeService } from './application/me.service';
import { TreatmentPlansService } from './application/treatment-plans.service';
import { ClientsTreatmentPlansController } from './presentation/clients-treatment-plans.controller';
import { MeController } from './presentation/me.controller';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MeController, ClientsTreatmentPlansController],
  providers: [MeService, TreatmentPlansService],
})
export class UsersModule {}

