import { Test } from '@nestjs/testing';
import { QuizResultLevel, UserRole } from '@prisma/client';

import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

describe('Quiz merge (integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await prisma.truncateAll();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('merges anonymous quiz session into user once', async () => {
    const network = await prisma.network.create({
      data: { name: 'Merge Net', slug: 'merge-net' },
    });
    const quiz = await prisma.diagnosticQuiz.create({
      data: {
        networkId: network.id,
        slug: 'merge-quiz',
        title: 'Merge quiz',
        isPublished: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        role: UserRole.CLIENT,
        phone: '+79990000001',
        firstName: 'Merge',
        lastName: 'User',
      },
    });
    const session = await prisma.diagnosticQuizResponse.create({
      data: {
        quizId: quiz.id,
        anonymousSessionId: 'anon-token',
        quizVersion: 1,
        answers: [{ questionId: 'q1', optionIds: ['o1'] }],
        totalScore: 3,
        tagScores: { pain: 3 },
        resultLevel: QuizResultLevel.HIGH,
        completedAt: new Date(),
      },
    });

    await prisma.diagnosticQuizResponse.update({
      where: { id: session.id },
      data: { userId: user.id },
    });
    await prisma.diagnosticQuizResponse.updateMany({
      where: { id: session.id, userId: user.id },
      data: { userId: user.id },
    });

    const mergedRows = await prisma.diagnosticQuizResponse.findMany({
      where: { id: session.id, userId: user.id },
    });
    expect(mergedRows).toHaveLength(1);
  });
});
