/* eslint-disable import/order */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentCtaTarget, QuizQuestionType, QuizResultLevel } from '@prisma/client';
import { UserRole } from '@srs/shared-types';

import { scoreQuizSession } from './quiz-scoring';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type {
  QuizAdminOutcomeInput,
  QuizAdminQuestionInput,
 CreateQuizAdminDto } from '../presentation/dto/create-quiz-admin.dto';
import type { CreateQuizSessionDto } from '../presentation/dto/create-quiz-session.dto';
import type { SubmitQuizAnswerDto } from '../presentation/dto/submit-quiz-answer.dto';
import type { UpdateQuizAdminDto } from '../presentation/dto/update-quiz-admin.dto';
import type { Prisma} from '@prisma/client';

type JwtLikeUser = { sub: string; role: UserRole };
type SessionAnswer = { questionId: string; optionIds: string[] };

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseAnswers(input: Prisma.JsonValue): SessionAnswer[] {
  if (!Array.isArray(input)) return [];
  const parsed: SessionAnswer[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const questionId = asString((row as Record<string, unknown>).questionId);
    const optionIds = asStringArray((row as Record<string, unknown>).optionIds);
    if (!questionId || optionIds.length === 0) continue;
    parsed.push({ questionId, optionIds });
  }
  return parsed;
}

function toQuizResultLevel(segment: string): QuizResultLevel {
  const normalized = segment.trim().toUpperCase();
  if (normalized === 'LOW') return QuizResultLevel.LOW;
  if (normalized === 'MEDIUM') return QuizResultLevel.MEDIUM;
  if (normalized === 'HIGH') return QuizResultLevel.HIGH;
  if (normalized === 'CRITICAL') return QuizResultLevel.CRITICAL;
  return QuizResultLevel.MEDIUM;
}

function quizTypeToPrisma(type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'YES_NO' | undefined): QuizQuestionType {
  if (type === 'MULTIPLE_CHOICE') return QuizQuestionType.MULTIPLE_CHOICE;
  if (type === 'YES_NO') return QuizQuestionType.YES_NO;
  return QuizQuestionType.SINGLE_CHOICE;
}

function parseCtaTarget(target: string | undefined): ContentCtaTarget | null {
  if (!target) return null;
  const normalized = target.trim().toUpperCase();
  if (
    normalized === ContentCtaTarget.CONTENT_SERIES ||
    normalized === ContentCtaTarget.PROGRAM ||
    normalized === ContentCtaTarget.SERVICE ||
    normalized === ContentCtaTarget.PHYSICAL_GOOD ||
    normalized === ContentCtaTarget.QUIZ ||
    normalized === ContentCtaTarget.PROGRAM_INQUIRY ||
    normalized === ContentCtaTarget.EXTERNAL_URL
  ) {
    return normalized as ContentCtaTarget;
  }
  return null;
}

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdminRole(user: JwtLikeUser): void {
    const allowed = [UserRole.SuperAdmin, UserRole.NetworkOwner, UserRole.StudioAdmin];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав для редактирования квиза');
    }
  }

  async listAdmin() {
    const items = await this.prisma.diagnosticQuiz.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } }, outcomes: true },
    });
    return items.map((item) => this.mapAdminQuiz(item));
  }

  async getActiveQuiz() {
    const quiz = await this.prisma.diagnosticQuiz.findFirst({
      where: { isPublished: true },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
        outcomes: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!quiz) {
      throw new NotFoundException('Опубликованный квиз не найден');
    }
    return this.mapPublicQuiz(quiz);
  }

  async createAdmin(user: JwtLikeUser, dto: CreateQuizAdminDto) {
    this.ensureAdminRole(user);
    const quiz = await this.prisma.$transaction(async (tx) => {
      const created = await tx.diagnosticQuiz.create({
        data: {
          networkId: dto.networkId,
          slug: dto.slug.trim(),
          title: dto.title.trim(),
          description: dto.description?.trim(),
          isPublished: dto.isPublished ?? false,
        },
      });

      await this.replaceQuizStructure(tx, created.id, dto.questions, dto.outcomes);
      return tx.diagnosticQuiz.findUniqueOrThrow({
        where: { id: created.id },
        include: { questions: { include: { options: true } }, outcomes: true },
      });
    });
    return this.mapAdminQuiz(quiz);
  }

  async updateAdmin(user: JwtLikeUser, quizId: string, dto: UpdateQuizAdminDto) {
    this.ensureAdminRole(user);
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.diagnosticQuiz.findUnique({ where: { id: quizId } });
      if (!existing) throw new NotFoundException('Квиз не найден');

      await tx.diagnosticQuiz.update({
        where: { id: quizId },
        data: {
          ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
          version: { increment: 1 },
        },
      });

      if (dto.questions && dto.outcomes) {
        await this.replaceQuizStructure(tx, quizId, dto.questions, dto.outcomes);
      }

      return tx.diagnosticQuiz.findUniqueOrThrow({
        where: { id: quizId },
        include: { questions: { include: { options: true } }, outcomes: true },
      });
    });
    return this.mapAdminQuiz(updated);
  }

  async createSession(dto: CreateQuizSessionDto) {
    const active = await this.prisma.diagnosticQuizResponse.findFirst({
      where: {
        quizId: dto.quizId,
        anonymousSessionId: dto.anonToken,
        completedAt: null,
      },
      orderBy: { startedAt: 'desc' },
    });
    if (active) {
      return { sessionId: active.id, status: 'ACTIVE' as const };
    }

    const quiz = await this.prisma.diagnosticQuiz.findUnique({
      where: { id: dto.quizId },
      select: { id: true, version: true, isPublished: true },
    });
    if (!quiz || !quiz.isPublished) {
      throw new NotFoundException('Квиз недоступен');
    }

    const created = await this.prisma.diagnosticQuizResponse.create({
      data: {
        quizId: quiz.id,
        anonymousSessionId: dto.anonToken,
        quizVersion: quiz.version,
        answers: [],
        totalScore: 0,
        tagScores: {},
        resultLevel: QuizResultLevel.MEDIUM,
      },
    });
    return { sessionId: created.id, status: 'ACTIVE' as const };
  }

  async submitAnswer(sessionId: string, dto: SubmitQuizAnswerDto) {
    const session = await this.prisma.diagnosticQuizResponse.findUnique({
      where: { id: sessionId },
      select: { id: true, completedAt: true, answers: true, quizId: true },
    });
    if (!session) throw new NotFoundException('Сессия квиза не найдена');
    if (session.completedAt) throw new BadRequestException('Сессия уже завершена');

    const answers = parseAnswers(session.answers);
    const nextAnswers = [
      ...answers.filter((answer) => answer.questionId !== dto.questionId),
      { questionId: dto.questionId, optionIds: dto.optionIds },
    ];

    await this.prisma.diagnosticQuizResponse.update({
      where: { id: sessionId },
      data: {
        answers: nextAnswers as Prisma.InputJsonValue,
      },
    });

    return {
      sessionId,
      status: 'ACTIVE' as const,
      answeredCount: nextAnswers.length,
      quizId: session.quizId,
    };
  }

  async completeSession(sessionId: string) {
    const session = await this.prisma.diagnosticQuizResponse.findUnique({
      where: { id: sessionId },
      include: {
        outcome: true,
        quiz: {
          include: {
            questions: { include: { options: true } },
            outcomes: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Сессия квиза не найдена');
    if (session.completedAt) {
      return this.buildCompleteResponse(session);
    }

    const answers = parseAnswers(session.answers);
    if (answers.length === 0) {
      throw new BadRequestException('Нельзя завершить пустую сессию');
    }

    const scoring = scoreQuizSession(
      answers,
      session.quiz.questions.flatMap((question) =>
        question.options.map((option) => ({
          id: option.id,
          questionId: question.id,
          weight: option.weight,
          tags: option.tags,
        })),
      ),
      session.quiz.outcomes.map((outcome) => {
        const rule =
          outcome.matchRule && typeof outcome.matchRule === 'object' && !Array.isArray(outcome.matchRule)
            ? (outcome.matchRule as Record<string, unknown>)
            : {};
        return {
          id: outcome.id,
          segment: outcome.level,
          minScore: typeof rule.minScore === 'number' ? rule.minScore : undefined,
          maxScore: typeof rule.maxScore === 'number' ? rule.maxScore : undefined,
          tagsRequired: asStringArray(rule.tagsRequired),
          tagsExcluded: asStringArray(rule.tagsExcluded),
          sortOrder: outcome.sortOrder,
        };
      }),
    );

    const updated = await this.prisma.diagnosticQuizResponse.update({
      where: { id: sessionId },
      data: {
        totalScore: scoring.totalScore,
        tagScores: scoring.tagScores as Prisma.InputJsonValue,
        outcomeId: scoring.matchedOutcomeId,
        resultLevel: toQuizResultLevel(scoring.segment),
        completedAt: new Date(),
      },
      include: { outcome: true, quiz: true },
    });

    return this.buildCompleteResponse(updated);
  }

  async mergeWithUser(sessionId: string, userId: string) {
    const session = await this.prisma.diagnosticQuizResponse.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, completedAt: true },
    });
    if (!session) throw new NotFoundException('Сессия квиза не найдена');
    if (!session.completedAt) throw new BadRequestException('Сначала завершите квиз');
    if (session.userId === userId) {
      return { merged: true as const, alreadyMerged: true as const };
    }

    await this.prisma.diagnosticQuizResponse.update({
      where: { id: sessionId },
      data: { userId },
    });
    return { merged: true as const, alreadyMerged: false as const };
  }

  private buildCompleteResponse(session: {
    id: string;
    totalScore: number;
    resultLevel: QuizResultLevel;
    outcome?: {
      id: string;
      title: string;
      description: string;
      primaryCtaLabel: string | null;
      primaryCtaTarget: ContentCtaTarget | null;
      recommendedContentSeriesIds: string[];
    } | null;
  }) {
    return {
      sessionId: session.id,
      status: 'COMPLETED' as const,
      result: {
        segment: session.resultLevel,
        score: session.totalScore,
        recommendedCta: session.outcome
          ? {
              label: session.outcome.primaryCtaLabel,
              target: session.outcome.primaryCtaTarget,
            }
          : null,
        recommendedContent: session.outcome?.recommendedContentSeriesIds ?? [],
        title: session.outcome?.title ?? null,
        description: session.outcome?.description ?? null,
      },
    };
  }

  private async replaceQuizStructure(
    tx: Prisma.TransactionClient,
    quizId: string,
    questions: QuizAdminQuestionInput[],
    outcomes: QuizAdminOutcomeInput[],
  ) {
    await tx.diagnosticAnswerOption.deleteMany({
      where: { question: { quizId } },
    });
    await tx.diagnosticQuestion.deleteMany({ where: { quizId } });
    await tx.diagnosticOutcome.deleteMany({ where: { quizId } });

    for (const question of questions) {
      const createdQuestion = await tx.diagnosticQuestion.create({
        data: {
          quizId,
          order: question.order,
          text: question.text.trim(),
          type: quizTypeToPrisma(question.type),
        },
      });
      for (let index = 0; index < question.options.length; index += 1) {
        const option = question.options[index];
        await tx.diagnosticAnswerOption.create({
          data: {
            questionId: createdQuestion.id,
            order: index,
            label: option.text.trim(),
            weight: option.scoreDelta,
            tags: option.tags ?? [],
          },
        });
      }
    }

    for (const outcome of outcomes) {
      await tx.diagnosticOutcome.create({
        data: {
          quizId,
          level: toQuizResultLevel(outcome.segment),
          title: outcome.title.trim(),
          description: outcome.description.trim(),
          sortOrder: outcome.sortOrder,
          primaryCtaLabel: outcome.primaryCtaLabel?.trim() || null,
          primaryCtaTarget: parseCtaTarget(outcome.primaryCtaTarget),
          recommendedContentSeriesIds: outcome.recommendedContentIds ?? [],
          matchRule: {
            minScore: outcome.minScore,
            maxScore: outcome.maxScore,
          } satisfies Record<string, unknown>,
        },
      });
    }
  }

  private mapPublicQuiz(quiz: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    questions: Array<{
      id: string;
      order: number;
      text: string;
      type: QuizQuestionType;
      options: Array<{ id: string; order: number; label: string }>;
    }>;
  }) {
    return {
      id: quiz.id,
      slug: quiz.slug,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((question) => ({
          id: question.id,
          order: question.order,
          text: question.text,
          type: question.type,
          options: question.options
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((option) => ({
              id: option.id,
              order: option.order,
              text: option.label,
            })),
        })),
    };
  }

  private mapAdminQuiz(quiz: {
    id: string;
    networkId: string;
    slug: string;
    title: string;
    description: string | null;
    isPublished: boolean;
    version: number;
    questions: Array<{
      id: string;
      order: number;
      text: string;
      type: QuizQuestionType;
      options: Array<{ id: string; order: number; label: string; weight: number; tags: string[] }>;
    }>;
    outcomes: Array<{
      id: string;
      level: QuizResultLevel;
      title: string;
      description: string;
      sortOrder: number;
      matchRule: Prisma.JsonValue;
      primaryCtaLabel: string | null;
      primaryCtaTarget: ContentCtaTarget | null;
      recommendedContentSeriesIds: string[];
    }>;
  }) {
    return {
      id: quiz.id,
      networkId: quiz.networkId,
      slug: quiz.slug,
      title: quiz.title,
      description: quiz.description,
      isPublished: quiz.isPublished,
      version: quiz.version,
      questions: quiz.questions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((question) => ({
          id: question.id,
          order: question.order,
          text: question.text,
          type: question.type,
          options: question.options
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((option) => ({
              id: option.id,
              order: option.order,
              text: option.label,
              scoreDelta: option.weight,
              tags: option.tags,
            })),
        })),
      outcomes: quiz.outcomes
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((outcome) => {
          const matchRule =
            outcome.matchRule && typeof outcome.matchRule === 'object' && !Array.isArray(outcome.matchRule)
              ? (outcome.matchRule as Record<string, unknown>)
              : {};
          return {
            id: outcome.id,
            segment: outcome.level,
            title: outcome.title,
            description: outcome.description,
            minScore: typeof matchRule.minScore === 'number' ? matchRule.minScore : 0,
            maxScore: typeof matchRule.maxScore === 'number' ? matchRule.maxScore : 0,
            sortOrder: outcome.sortOrder,
            primaryCtaLabel: outcome.primaryCtaLabel,
            primaryCtaTarget: outcome.primaryCtaTarget,
            recommendedContentIds: outcome.recommendedContentSeriesIds,
          };
        }),
    };
  }
}
