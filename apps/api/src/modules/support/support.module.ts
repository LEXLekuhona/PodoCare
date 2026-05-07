import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SupportService } from './application/support.service';
import { SupportController } from './presentation/support.controller';

@Module({
  imports: [AuthModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}

