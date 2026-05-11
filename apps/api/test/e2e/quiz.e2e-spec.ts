import { ContentAudience, ContentFormat, UserRole } from '@srs/shared-types';
import request from 'supertest';

import { buildTestApp } from '../helpers/build-test-app';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { INestApplication } from '@nestjs/common';

describe('Quiz flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  beforeEach(async () => {
    await prisma.truncateAll();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('anon complete -> signup/login -> merge -> personalized feed', async () => {
    const network = await prisma.network.create({
      data: { name: 'Quiz Network', slug: 'quiz-network' },
    });
    const author = await prisma.user.create({
      data: {
        role: UserRole.ContentAuthor,
        phone: '+79991112233',
        firstName: 'Контент',
        lastName: 'Автор',
      },
    });
    const series = await prisma.contentSeries.create({
      data: {
        networkId: network.id,
        authorUserId: author.id,
        slug: 'quiz-series',
        title: 'Серия',
        audience: ContentAudience.Client as any,
        tags: ['pain'],
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    const taggedItem = await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: series.id,
        authorUserId: author.id,
        slug: 'tagged',
        title: 'Контент для pain',
        format: ContentFormat.Article as any,
        audience: ContentAudience.Client as any,
        body: { markdown: 'tagged' },
        tags: ['pain'],
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: series.id,
        authorUserId: author.id,
        slug: 'neutral',
        title: 'Нейтральный контент',
        format: ContentFormat.Article as any,
        audience: ContentAudience.Client as any,
        body: { markdown: 'neutral' },
        tags: ['neutral'],
        isPublished: true,
        publishedAt: new Date(Date.now() - 60_000),
      },
    });

    const quiz = await prisma.diagnosticQuiz.create({
      data: {
        networkId: network.id,
        slug: 'diagnostic-test',
        title: 'Диагностический тест',
        isPublished: true,
      },
    });
    const question = await prisma.diagnosticQuestion.create({
      data: {
        quizId: quiz.id,
        order: 0,
        text: 'Есть ли боль?',
        type: 'SINGLE_CHOICE',
      },
    });
    const optionPain = await prisma.diagnosticAnswerOption.create({
      data: {
        questionId: question.id,
        order: 0,
        label: 'Да',
        weight: 3,
        tags: ['pain'],
      },
    });
    const optionNoPain = await prisma.diagnosticAnswerOption.create({
      data: {
        questionId: question.id,
        order: 1,
        label: 'Нет',
        weight: 0,
        tags: ['neutral'],
      },
    });
    await prisma.diagnosticOutcome.create({
      data: {
        quizId: quiz.id,
        level: 'HIGH',
        title: 'Высокий риск',
        description: 'Нужна консультация',
        sortOrder: 0,
        matchRule: { minScore: 2, maxScore: 10 },
      },
    });
    await prisma.diagnosticOutcome.create({
      data: {
        quizId: quiz.id,
        level: 'LOW',
        title: 'Низкий риск',
        description: 'Достаточно профилактики',
        sortOrder: 1,
        matchRule: { minScore: 0, maxScore: 1 },
      },
    });

    const anonToken = 'anon-device-token';

    const createSessionRes = await request(app.getHttpServer()).post('/api/v1/quiz/sessions').send({
      quizId: quiz.id,
      anonToken,
    });
    expect(createSessionRes.status).toBe(201);
    const sessionId = createSessionRes.body.sessionId as string;

    const answerRes = await request(app.getHttpServer())
      .post(`/api/v1/quiz/sessions/${sessionId}/answers`)
      .send({
        questionId: question.id,
        optionIds: [optionPain.id, optionNoPain.id].slice(0, 1),
      });
    expect(answerRes.status).toBe(201);

    const completeRes = await request(app.getHttpServer()).post(
      `/api/v1/quiz/sessions/${sessionId}/complete`,
    );
    expect(completeRes.status).toBe(201);
    expect(completeRes.body.status).toBe('COMPLETED');
    expect(completeRes.body.result.segment).toBe('HIGH');

    const phone = '+79994445566';
    const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone });
    const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
      phone,
      code: requestOtp.body.debugCode,
      deviceType: 'mobile_android',
    });
    expect(verifyOtp.status).toBe(201);
    const accessToken = verifyOtp.body.tokens.accessToken as string;

    const mergeRes = await request(app.getHttpServer())
      .post(`/api/v1/quiz/sessions/${sessionId}/merge-with-user`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(mergeRes.status).toBe(201);
    expect(mergeRes.body.merged).toBe(true);

    const mergeAgainRes = await request(app.getHttpServer())
      .post(`/api/v1/quiz/sessions/${sessionId}/merge-with-user`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(mergeAgainRes.status).toBe(201);
    expect(mergeAgainRes.body.alreadyMerged).toBe(true);

    const feedRes = await request(app.getHttpServer())
      .get('/api/v1/content/feed')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.items[0].id).toBe(taggedItem.id);

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.diagnosticQuiz).toMatchObject({
      quizId: quiz.id,
      resultLevel: 'HIGH',
      outcomeTitle: 'Высокий риск',
      score: expect.any(Number),
    });
  });

  it('GET /quiz/published/:id is 404 for draft, 200 for published', async () => {
    const network = await prisma.network.create({ data: { name: 'Quiz Pub', slug: 'quiz-pub-net' } });
    const draft = await prisma.diagnosticQuiz.create({
      data: { networkId: network.id, slug: 'draft-q', title: 'Черновик', isPublished: false },
    });
    const pub = await prisma.diagnosticQuiz.create({
      data: { networkId: network.id, slug: 'pub-q', title: 'В эфире', isPublished: true },
    });
    const draftRes = await request(app.getHttpServer()).get(`/api/v1/quiz/published/${draft.id}`);
    expect(draftRes.status).toBe(404);
    const pubRes = await request(app.getHttpServer()).get(`/api/v1/quiz/published/${pub.id}`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.body).toMatchObject({ id: pub.id, title: 'В эфире' });
  });

  it('quiz admin: 401 without token, 403 for client', async () => {
    const noAuthList = await request(app.getHttpServer()).get('/api/v1/quiz/admin');
    expect(noAuthList.status).toBe(401);
    const noAuthPost = await request(app.getHttpServer()).post('/api/v1/quiz/admin').send({});
    expect(noAuthPost.status).toBe(401);
    const noAuthPatch = await request(app.getHttpServer())
      .patch('/api/v1/quiz/admin/00000000-0000-0000-0000-000000000001')
      .send({});
    expect(noAuthPatch.status).toBe(401);

    const network = await prisma.network.create({ data: { name: 'Quiz Auth', slug: 'quiz-auth-net' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'QS',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79993330001',
        firstName: 'C',
        lastName: 'C',
      },
    });
    const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone: client.phone });
    const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
      phone: client.phone,
      code: requestOtp.body.debugCode,
      deviceType: 'mobile_ios',
    });
    expect(verifyOtp.status).toBe(201);
    const token = verifyOtp.body.tokens.accessToken as string;

    const forbiddenList = await request(app.getHttpServer()).get('/api/v1/quiz/admin').set('Authorization', `Bearer ${token}`);
    expect(forbiddenList.status).toBe(403);
    const forbiddenPost = await request(app.getHttpServer())
      .post('/api/v1/quiz/admin')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(forbiddenPost.status).toBe(403);
    const forbiddenPatch = await request(app.getHttpServer())
      .patch('/api/v1/quiz/admin/00000000-0000-0000-0000-000000000002')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(forbiddenPatch.status).toBe(403);
  });

  it('merge-with-user: 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/quiz/sessions/00000000-0000-0000-0000-000000000099/merge-with-user')
      .send({});
    expect(res.status).toBe(401);
  });
});
