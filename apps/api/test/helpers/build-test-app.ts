import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';


import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../../src/common/interceptors/request-id.interceptor';
import { stripUnderscoreCacheQueryParam } from '../../src/common/middleware/strip-underscore-cache-query.middleware';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

import type { AppConfig } from '../../src/config/app.config';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Собирает реальное Nest-приложение для e2e-тестов.
 * Перед возвратом очищает БД, чтобы каждый тест начинался с чистого состояния.
 */
export async function buildTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.use(stripUnderscoreCacheQueryParam);
  const cfgService = app.get(ConfigService);
  const appCfg = cfgService.getOrThrow<AppConfig>('app');
  app.setGlobalPrefix(appCfg.globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  const prisma = app.get(PrismaService);
  await prisma.truncateAll();

  return { app, prisma };
}
