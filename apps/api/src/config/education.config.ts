import { registerAs } from '@nestjs/config';

/**
 * Обучение: контент в продакшене задаётся через админ-панель → запись в БД
 * (ContentSeries / ContentItem / Program и т.д.).
 *
 * Демо-каталог в коде используется только если в БД нет ни одной подходящей
 * записи И включён fallback (локальная разработка).
 */
export interface EducationConfig {
  /** Если false — при пустой БД отдаём пустые списки, без встроенного демо. */
  staticFallback: boolean;
}

export default registerAs<EducationConfig>('education', () => ({
  staticFallback: process.env.EDUCATION_STATIC_FALLBACK !== 'false',
}));
