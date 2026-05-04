import { apiFetchJson } from '@/shared/api/client';

import { setSessionTokens, type AuthTokens } from '@/features/auth/session-store';

export type AuthUser = {
  id: string;
  role: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
};

export type AuthResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type RequestOtpResponse = {
  expiresAt: string;
  resendAvailableAt: string;
  codeLength: number;
  debugCode?: string;
};

export async function requestOtp(phone: string): Promise<RequestOtpResponse> {
  return apiFetchJson<RequestOtpResponse>('/auth/otp/request', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(input: {
  phone: string;
  code: string;
  deviceType: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthResponse> {
  const res = await apiFetchJson<AuthResponse>('/auth/otp/verify', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  await setSessionTokens(res.tokens);
  return res;
}
