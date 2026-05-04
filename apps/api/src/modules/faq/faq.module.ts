import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FaqService } from './application/faq.service';
import { FaqController } from './presentation/faq.controller';

@Module({
  imports: [AuthModule],
  controllers: [FaqController],
  providers: [FaqService],
})
export class FaqModule {}

