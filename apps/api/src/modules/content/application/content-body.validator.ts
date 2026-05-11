import { BadRequestException } from '@nestjs/common';
import { ContentFormat } from '@prisma/client';

/**
 * Per-format валидация тела единицы контента.
 *
 * Контракт «опорных» ключей по формату (соответствует seed-данным и UI админки):
 *   - ARTICLE: { markdown: string, documentUrl?: string (http(s), опционально) }
 *   - VIDEO:   { videoUrl: string (URL) }
 *   - AUDIO:   { audioUrl: string (URL) }
 *   - WEBINAR: { webinarUrl: string (URL) }
 *   - QUIZ:    { quizId: string (UUID v4-подобный) }
 *
 * Принципы:
 *   - body должен быть JSON-объектом (не массив, не примитив, не null);
 *   - в нём обязательно присутствует «опорный» ключ для своего формата с непустой строкой;
 *   - дополнительные поля не запрещаются (расширенный режим админки и будущие расширения),
 *     но опорный контракт всегда соблюдается.
 *
 * Ничего не читаем из БД и не валидируем существующие записи — это runtime-чек на write-pах.
 */

const URL_PATTERN = /^https?:\/\/\S+$/i;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(body: Record<string, unknown>, key: string, errorMsg: string): string {
  const v = body[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new BadRequestException(errorMsg);
  }
  return v;
}

function requireUrl(body: Record<string, unknown>, key: string, missingMsg: string, invalidMsg: string): void {
  const v = requireNonEmptyString(body, key, missingMsg);
  if (!URL_PATTERN.test(v.trim())) {
    throw new BadRequestException(invalidMsg);
  }
}

/**
 * Бросает {@link BadRequestException}, если body не соответствует контракту для указанного формата.
 * Вызывать перед записью в БД.
 */
export function validateContentItemBody(format: ContentFormat, body: unknown): void {
  if (!isPlainObject(body)) {
    throw new BadRequestException('Тело материала должно быть JSON-объектом');
  }

  switch (format) {
    case ContentFormat.ARTICLE:
      requireNonEmptyString(body, 'markdown', 'Для статьи требуется непустое поле body.markdown (Markdown-текст)');
      if ('documentUrl' in body && body['documentUrl'] != null) {
        const du = body['documentUrl'];
        if (typeof du !== 'string') {
          throw new BadRequestException('Поле body.documentUrl должно быть строкой с http(s) URL');
        }
        const trimmed = du.trim();
        if (trimmed !== '' && !URL_PATTERN.test(trimmed)) {
          throw new BadRequestException('body.documentUrl должно быть валидным http(s) URL');
        }
      }
      return;
    case ContentFormat.VIDEO:
      requireUrl(
        body,
        'videoUrl',
        'Для видео требуется поле body.videoUrl со ссылкой',
        'body.videoUrl должно быть валидным http(s) URL',
      );
      return;
    case ContentFormat.AUDIO:
      requireUrl(
        body,
        'audioUrl',
        'Для аудио требуется поле body.audioUrl со ссылкой',
        'body.audioUrl должно быть валидным http(s) URL',
      );
      return;
    case ContentFormat.WEBINAR:
      requireUrl(
        body,
        'webinarUrl',
        'Для вебинара требуется поле body.webinarUrl со ссылкой',
        'body.webinarUrl должно быть валидным http(s) URL',
      );
      return;
    case ContentFormat.QUIZ: {
      const quizId = requireNonEmptyString(body, 'quizId', 'Для квиза требуется поле body.quizId (UUID)');
      if (!UUID_PATTERN.test(quizId.trim())) {
        throw new BadRequestException('body.quizId должен быть UUID');
      }
      return;
    }
    default: {
      const exhaustive: never = format;
      throw new BadRequestException(`Неизвестный формат материала: ${String(exhaustive)}`);
    }
  }
}
