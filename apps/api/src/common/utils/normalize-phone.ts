import { BadRequestException } from '@nestjs/common';

/**
 * Нормализует российский номер телефона к формату +7XXXXXXXXXX.
 * Принимает форматы: +79161234567, 79161234567, 89161234567, 9161234567.
 * Бросает BadRequestException при некорректном вводе.
 */
export function normalizePhone(raw: string): string {
  const normalized = raw.replace(/[^\d+]/g, '');
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new BadRequestException('Некорректный номер телефона');
  }
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  return normalized.startsWith('+') ? `+${digits}` : `+${digits}`;
}

/**
 * Нормализует email: trim + toLowerCase + базовая валидация.
 */
export function normalizeEmail(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    throw new BadRequestException('Некорректный email');
  }
  return t;
}