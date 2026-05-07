import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { ConfigService } from '@nestjs/config';

import type { NotificationsConfig } from '../../../../config/notifications.config';


export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: unknown };

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);

  constructor(private readonly configService: ConfigService) {}

  usesRealExpoPush(): boolean {
    const cfg = this.configService.getOrThrow<NotificationsConfig>('notifications');
    return cfg.pushProvider === 'expo';
  }

  /**
   * Отправка через Expo Push API. При `PUSH_PROVIDER=console` не вызывается из доменного кода.
   */
  async sendExpoTickets(
    messages: Array<{ to: string; title: string; body: string; data?: Record<string, string> }>,
  ): Promise<ExpoPushTicket[]> {
    const cfg = this.configService.getOrThrow<NotificationsConfig>('notifications');
    if (messages.length === 0) return [];

    if (cfg.pushProvider !== 'expo') {
      this.logger.debug(
        `push (console): ${messages.length} message(s); to≈${messages[0]?.to?.slice(0, 28) ?? '—'}…`,
      );
      return messages.map(() => ({ status: 'ok' as const, id: 'console' }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const token = cfg.expoAccessToken?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`Expo push HTTP ${res.status}: ${rawText.slice(0, 400)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      throw new Error('Expo push: ответ не JSON');
    }

    const data =
      parsed && typeof parsed === 'object' && 'data' in parsed
        ? (parsed as { data: unknown }).data
        : undefined;
    if (!Array.isArray(data)) {
      throw new Error('Expo push: в ответе нет массива data');
    }
    if (data.length !== messages.length) {
      throw new Error(`Expo push: ожидалось ${messages.length} тикетов, пришло ${data.length}`);
    }

    return data as ExpoPushTicket[];
  }
}
