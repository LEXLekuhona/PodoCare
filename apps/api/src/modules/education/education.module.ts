import { Module } from '@nestjs/common';

import { EducationService } from './application/education.service';
import { EducationController } from './presentation/education.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EducationController],
  providers: [EducationService],
})
export class EducationModule {}
