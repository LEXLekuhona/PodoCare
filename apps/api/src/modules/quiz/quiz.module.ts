import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QuizService } from './application/quiz.service';
import { QuizController } from './presentation/quiz.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
