import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminCatalogService } from './application/admin-catalog.service';
import { AdminPhysicalGoodsService } from './application/admin-physical-goods.service';
import { AdminServiceCategoriesService } from './application/admin-service-categories.service';
import { AdminSpecialistShiftsService } from './application/admin-specialist-shifts.service';
import { AdminSpecialistsService } from './application/admin-specialists.service';
import { AdminStaffService } from './application/admin-staff.service';
import { AdminStudioServicesService } from './application/admin-studio-services.service';
import { AdminCatalogController } from './presentation/admin-catalog.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminCatalogController],
  providers: [
    AdminCatalogService,
    AdminPhysicalGoodsService,
    AdminServiceCategoriesService,
    AdminSpecialistShiftsService,
    AdminStaffService,
    AdminSpecialistsService,
    AdminStudioServicesService,
  ],
})
export class AdminCatalogModule {}
