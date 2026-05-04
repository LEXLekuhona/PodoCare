import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import type { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  /** До любых роутов / pipes: клиенты шлют `?_=` — иначе ValidationPipe (`forbidNonWhitelisted`) даёт «property _ should not exist». */
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const q = req.query;
    if (q != null && typeof q === 'object' && Object.prototype.hasOwnProperty.call(q, '_')) {
      delete q._;
    }
    next();
  });

  app.useLogger(app.get(Logger));
  app.flushLogs();

  const config = app.get(ConfigService);
  const appCfg = config.getOrThrow<AppConfig>('app');

  app.set('trust proxy', 1);
  /** Иначе Express отдаёт 304 + пустое тело при If-None-Match — RN OkHttp ломает JSON в клиенте. */
  app.set('etag', false);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: appCfg.corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix(appCfg.globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger регистрируется после versioning+prefix и ПЕРЕД listen.
  // Если Swagger вызывает конфликт роутинга — его можно выключить флагом
  // API_ENABLE_SWAGGER=false (по умолчанию включён в dev, выключен в prod).
  const swaggerEnabled =
    process.env.API_ENABLE_SWAGGER !== 'false' && appCfg.env !== 'production';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PodoCare API')
      .setDescription(
        'REST API для мобильного приложения клиента, интерфейса студии на планшете и админ-панели.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  await app.listen(appCfg.port, appCfg.host);
  const url = await app.getUrl();
  // eslint-disable-next-line no-console
  console.log(`\n🚀  PodoCare API готов: ${url}/${appCfg.globalPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`📚  Swagger: ${url}/docs\n`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌  Fatal error during bootstrap:', err);
  process.exit(1);
});
