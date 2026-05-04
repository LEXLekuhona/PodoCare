export interface SendSmsInput {
  to: string;
  message: string;
  senderId?: string;
}

export interface SendSmsResult {
  providerMessageId: string;
  providerPayload?: unknown;
  costMinor?: number;
}

export interface SmsProvider {
  send(input: SendSmsInput): Promise<SendSmsResult>;
}

export const SMS_PROVIDER_TOKEN = Symbol('SMS_PROVIDER_TOKEN');
