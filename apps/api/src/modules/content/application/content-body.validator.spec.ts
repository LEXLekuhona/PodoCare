import { BadRequestException } from '@nestjs/common';
import { ContentFormat } from '@prisma/client';

import { validateContentItemBody } from './content-body.validator';

describe('validateContentItemBody', () => {
  it('rejects non-object body shapes', () => {
    expect(() => validateContentItemBody(ContentFormat.ARTICLE, null)).toThrow(BadRequestException);
    expect(() => validateContentItemBody(ContentFormat.ARTICLE, 'string')).toThrow(BadRequestException);
    expect(() => validateContentItemBody(ContentFormat.ARTICLE, [])).toThrow(BadRequestException);
    expect(() => validateContentItemBody(ContentFormat.ARTICLE, undefined)).toThrow(BadRequestException);
  });

  describe('ARTICLE', () => {
    it('accepts non-empty markdown', () => {
      expect(() =>
        validateContentItemBody(ContentFormat.ARTICLE, { markdown: '# Заголовок\n\nТекст' }),
      ).not.toThrow();
    });

    it('rejects empty markdown', () => {
      expect(() => validateContentItemBody(ContentFormat.ARTICLE, { markdown: '   ' })).toThrow(BadRequestException);
      expect(() => validateContentItemBody(ContentFormat.ARTICLE, {})).toThrow(BadRequestException);
      expect(() => validateContentItemBody(ContentFormat.ARTICLE, { markdown: 123 })).toThrow(BadRequestException);
    });

    it('allows extra keys', () => {
      expect(() =>
        validateContentItemBody(ContentFormat.ARTICLE, { markdown: 'ok', author: 'Анна' }),
      ).not.toThrow();
    });

    it('accepts optional documentUrl when valid http(s)', () => {
      expect(() =>
        validateContentItemBody(ContentFormat.ARTICLE, {
          markdown: 'Текст',
          documentUrl: 'https://cdn.example.com/file.pdf',
        }),
      ).not.toThrow();
    });

    it('rejects invalid optional documentUrl', () => {
      expect(() =>
        validateContentItemBody(ContentFormat.ARTICLE, {
          markdown: 'Текст',
          documentUrl: 'not-a-url',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        validateContentItemBody(ContentFormat.ARTICLE, {
          markdown: 'Текст',
          documentUrl: 123 as unknown as string,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe.each([
    [ContentFormat.VIDEO, 'videoUrl'],
    [ContentFormat.AUDIO, 'audioUrl'],
    [ContentFormat.WEBINAR, 'webinarUrl'],
  ])('%s', (format, urlKey) => {
    it(`accepts a valid http(s) ${urlKey}`, () => {
      expect(() => validateContentItemBody(format, { [urlKey]: 'https://cdn.example.com/file' })).not.toThrow();
      expect(() => validateContentItemBody(format, { [urlKey]: 'http://example.com' })).not.toThrow();
    });

    it(`rejects missing/empty ${urlKey}`, () => {
      expect(() => validateContentItemBody(format, {})).toThrow(BadRequestException);
      expect(() => validateContentItemBody(format, { [urlKey]: '' })).toThrow(BadRequestException);
    });

    it(`rejects malformed ${urlKey}`, () => {
      expect(() => validateContentItemBody(format, { [urlKey]: 'not-a-url' })).toThrow(BadRequestException);
      expect(() => validateContentItemBody(format, { [urlKey]: 'ftp://example.com/x' })).toThrow(BadRequestException);
    });
  });

  describe('QUIZ', () => {
    it('accepts a UUID quizId', () => {
      expect(() =>
        validateContentItemBody(ContentFormat.QUIZ, { quizId: '8a4f6f4f-3a21-4b6f-9c8a-5e25f5f1f11c' }),
      ).not.toThrow();
    });

    it('rejects non-UUID quizId', () => {
      expect(() => validateContentItemBody(ContentFormat.QUIZ, { quizId: 'plain-id' })).toThrow(BadRequestException);
      expect(() => validateContentItemBody(ContentFormat.QUIZ, { quizId: '' })).toThrow(BadRequestException);
      expect(() => validateContentItemBody(ContentFormat.QUIZ, {})).toThrow(BadRequestException);
    });
  });
});
