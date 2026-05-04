import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MeService } from './application/me.service';
import { MeController } from './presentation/me.controller';

@Module({
  imports: [AuthModule],
  controllers: [MeController],
  providers: [MeService],
})
export class UsersModule {}

