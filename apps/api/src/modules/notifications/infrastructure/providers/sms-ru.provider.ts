import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { NotificationsConfig } from '../../../../config/notifications.config';
import { type SendSmsInput, type SendSmsResult, type SmsProvider } from './sms-provider.port';

interface SmsRuResponse {
  status: 'OK' | 'ERROR';
  status_code?: number;
  sms?: Record<
    string,
    {
      status: 'OK' | 'ERROR';
      status_code?: number;
      sms_id?: string;
      cost?: string;
      status_text?: string;
      error?: string;
    }
  >;
  error?: string;
}

@Injectable()
export class SmsRuProvider implements SmsProvider {
  private readonly apiId?: string;
  private readonly defaultSender?: string;

  constructor(private readonly configService: ConfigService) {
    const cfg = this.configService.getOrThrow<NotificationsConfig>('notifications');
    this.apiId = cfg.smsRuApiId;
    this.defaultSender = cfg.smsDefaultSender;
  }

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    if (!this.apiId) {
      throw new Error('SMS_RU_API_ID не задан');
    }

    const params = new URLSearchParams({
      api_id: this.apiId,
      to: input.to,
      msg: input.message,
      json: '1',
    });
    const sender = input.senderId ?? this.defaultSender;
    if (sender) {
      params.set('from', sender);
    }

    const res = await fetch(`https://sms.ru/sms/send?${params.toString()}`, {
      method: 'GET',
    });
    if (!res.ok) {
      throw new Error(`SMS.RU HTTP ${res.status}`);
    }

    const data = (await res.json()) as SmsRuResponse;
    if (data.status !== 'OK') {
      throw new Error(data.error ?? 'SMS.RU response error');
    }
    const entry = data.sms?.[input.to];
    if (!entry || entry.status !== 'OK' || !entry.sms_id) {
      throw new Error(entry?.error ?? entry?.status_text ?? 'SMS.RU send failed');
    }

    const costMinor = entry.cost ? Math.round(Number(entry.cost) * 100) : undefined;
    return {
      providerMessageId: entry.sms_id,
      providerPayload: data,
      costMinor: Number.isFinite(costMinor) ? costMinor : undefined,
    };
  }
}
