import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminCatalogService } from './application/admin-catalog.service';
import { AdminSpecialistsService } from './application/admin-specialists.service';
import { AdminStaffService } from './application/admin-staff.service';
import { AdminCatalogController } from './presentation/admin-catalog.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminCatalogController],
  providers: [AdminCatalogService, AdminStaffService, AdminSpecialistsService],
})
export class AdminCatalogModule {}
