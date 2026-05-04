import { Injectable, Logger } from '@nestjs/common';

import { type SendSmsInput, type SendSmsResult, type SmsProvider } from './sms-provider.port';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const providerMessageId = globalThis.crypto.randomUUID();
    this.logger.log(`[SMS][console] to=${input.to} sender=${input.senderId ?? '-'} ${input.message}`);
    return {
      providerMessageId,
      providerPayload: { mode: 'console' },
      costMinor: 0,
    };
  }
}
