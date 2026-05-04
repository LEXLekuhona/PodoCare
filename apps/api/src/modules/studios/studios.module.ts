import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { StudiosService } from './application/studios.service';
import { StudiosController } from './presentation/studios.controller';

@Module({
  imports: [AuthModule],
  controllers: [StudiosController],
  providers: [StudiosService],
})
export class StudiosModule {}

