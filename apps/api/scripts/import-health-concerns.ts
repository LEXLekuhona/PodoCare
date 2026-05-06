/**
 * Массовая загрузка справочника «что беспокоит» из JSON в БД (upsert по slug).
 *
 * Файл по умолчанию: apps/api/data/health-concerns.json
 * Другой путь: pnpm import-health-concerns -- path/to/file.json
 * (аргумент после скрипта — относительный или абсолютный путь к JSON)
 *
 * Запуск из каталога apps/api с загруженным .env:
 *   pnpm import-health-concerns
 */
/* eslint-disable no-console */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Row = {
  slug: string;
  title: string;
  description?: string | null;
  iconUrl?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

function argPath(): string {
  const args = process.argv.slice(2);
  const scriptIdx = args.findIndex((a) => a.includes('import-health-concerns'));
  const next = scriptIdx >= 0 ? args[scriptIdx + 1] : undefined;
  if (next && !next.startsWith('-')) {
    return path.resolve(process.cwd(), next);
  }
  return path.join(process.cwd(), 'data', 'health-concerns.json');
}

function assertRow(row: unknown, index: number): asserts row is Row {
  if (row === null || typeof row !== 'object') {
    throw new Error(`Строка ${index + 1}: ожидался объект`);
  }
  const r = row as Record<string, unknown>;
  if (typeof r.slug !== 'string' || r.slug.trim().length < 2 || r.slug.length > 80) {
    throw new Error(`Строка ${index + 1}: slug — строка 2–80 символов`);
  }
  if (/\s/.test(r.slug) || r.slug.includes('/')) {
    throw new Error(`Строка ${index + 1}: slug не должен содержать пробелы или «/»`);
  }
  if (typeof r.title !== 'string' || r.title.trim().length < 2 || r.title.length > 200) {
    throw new Error(`Строка ${index + 1}: title — строка 2–200 символов`);
  }
  if (r.description != null && typeof r.description !== 'string') {
    throw new Error(`Строка ${index + 1}: description должен быть строкой или отсутствовать`);
  }
  if (r.description != null && r.description.length > 20000) {
    throw new Error(`Строка ${index + 1}: description не длиннее 20000 символов`);
  }
  if (r.iconUrl != null && typeof r.iconUrl !== 'string') {
    throw new Error(`Строка ${index + 1}: iconUrl должен быть строкой или null`);
  }
  if (r.iconUrl != null && r.iconUrl.length > 2048) {
    throw new Error(`Строка ${index + 1}: iconUrl не длиннее 2048 символов`);
  }
  if (r.iconUrl != null && r.iconUrl.length > 0) {
    try {
      const u = new URL(r.iconUrl);
      if (!u.protocol.startsWith('http')) {
        throw new Error('нужен http(s)');
      }
    } catch {
      throw new Error(`Строка ${index + 1}: iconUrl — некорректный URL с протоколом`);
    }
  }
  if (r.sortOrder != null && typeof r.sortOrder !== 'number') {
    throw new Error(`Строка ${index + 1}: sortOrder — число или отсутствует`);
  }
  if (r.isActive != null && typeof r.isActive !== 'boolean') {
    throw new Error(`Строка ${index + 1}: isActive — boolean или отсутствует`);
  }
}

async function main(): Promise<void> {
  const filePath = argPath();
  if (!fs.existsSync(filePath)) {
    console.error(`Файл не найден: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('Ожидался непустой массив объектов');
    process.exitCode = 1;
    return;
  }

  const rows: Row[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parsed.length; i += 1) {
    assertRow(parsed[i], i);
    const r = parsed[i] as Row;
    if (seen.has(r.slug)) {
      throw new Error(`Дубликат slug в файле: ${r.slug}`);
    }
    seen.add(r.slug);
    rows.push(r);
  }

  for (const r of rows) {
    const description = r.description?.trim() ? r.description.trim() : null;
    const iconUrl = r.iconUrl?.trim() ? r.iconUrl.trim() : null;
    const sortOrder = r.sortOrder ?? 0;
    const isActive = r.isActive ?? true;

    await prisma.healthConcern.upsert({
      where: { slug: r.slug },
      create: {
        slug: r.slug,
        title: r.title.trim(),
        description,
        iconUrl,
        sortOrder,
        isActive,
      },
      update: {
        title: r.title.trim(),
        description,
        iconUrl,
        sortOrder,
        isActive,
      },
    });
  }

  console.log(`Готово: upsert ${rows.length} записей health_concerns из ${filePath}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
