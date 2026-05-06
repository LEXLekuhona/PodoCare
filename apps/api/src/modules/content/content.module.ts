import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContentService } from './application/content.service';
import { ContentController } from './presentation/content.controller';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}

