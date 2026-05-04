import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminEducationService } from './application/admin-education.service';
import { AdminEducationController } from './presentation/admin-education.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminEducationController],
  providers: [AdminEducationService],
})
export class AdminEducationModule {}
