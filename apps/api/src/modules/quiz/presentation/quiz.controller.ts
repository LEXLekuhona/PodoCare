/* eslint-disable import/order */
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { QuizService } from '../application/quiz.service';
// Nest ValidationPipe relies on runtime metadata for DTO classes.
// `import type` breaks `design:paramtypes`, causing whitelist validation to reject all properties.
import { CreateQuizAdminDto } from './dto/create-quiz-admin.dto';
import { CreateQuizSessionDto } from './dto/create-quiz-session.dto';
import { SubmitQuizAnswerDto } from './dto/submit-quiz-answer.dto';
import { UpdateQuizAdminDto } from './dto/update-quiz-admin.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

const QUIZ_ADMIN_ROLES = [UserRole.SuperAdmin, UserRole.NetworkOwner, UserRole.StudioAdmin] as const;

@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('active')
  @ApiOperation({ summary: 'Опубликованный квиз для мобильного клиента.' })
  getActiveQuiz() {
    return this.quizService.getActiveQuiz();
  }

  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...QUIZ_ADMIN_ROLES)
  @ApiOperation({ summary: 'Список квизов для админ-редактора.' })
  listAdmin() {
    return this.quizService.listAdmin();
  }

  @Post('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...QUIZ_ADMIN_ROLES)
  @ApiOperation({ summary: 'Создать квиз (вопросы, варианты, скоринг-исходы).' })
  createAdmin(@CurrentUser() user: JwtAccessPayload, @Body() body: CreateQuizAdminDto) {
    return this.quizService.createAdmin(user, body);
  }

  @Patch('admin/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...QUIZ_ADMIN_ROLES)
  @ApiOperation({ summary: 'Обновить квиз.' })
  updateAdmin(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateQuizAdminDto,
  ) {
    return this.quizService.updateAdmin(user, id, body);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Старт анонимной или авторизованной сессии квиза.' })
  createSession(@Body() body: CreateQuizSessionDto) {
    return this.quizService.createSession(body);
  }

  @Post('sessions/:id/answers')
  @ApiOperation({ summary: 'Сохранить ответ(ы) в активную сессию квиза.' })
  submitAnswer(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() body: SubmitQuizAnswerDto,
  ) {
    return this.quizService.submitAnswer(sessionId, body);
  }

  @Post('sessions/:id/complete')
  @ApiOperation({ summary: 'Завершить квиз, посчитать score/segment/CTA.' })
  complete(@Param('id', ParseUUIDPipe) sessionId: string) {
    return this.quizService.completeSession(sessionId);
  }

  @Post('sessions/:id/merge-with-user')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Привязать анонимный результат к текущему пользователю.' })
  mergeWithUser(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.quizService.mergeWithUser(sessionId, user.sub);
  }
}
