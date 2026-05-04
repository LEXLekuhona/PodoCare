import type { UserRole } from '@podocare/shared-types';

const PREFIX = 'podocare_admin_';

const KEYS = {
  access: `${PREFIX}access`,
  refresh: `${PREFIX}refresh`,
  user: `${PREFIX}user`,
} as const;

export interface StoredUser {
  id: string;
  role: UserRole;
  email: string | null;
  firstName: string;
  lastName: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface StoredAuth extends TokenPair {
  user: StoredUser;
}

export function saveAuth(auth: StoredAuth): void {
  localStorage.setItem(KEYS.access, auth.accessToken);
  localStorage.setItem(KEYS.refresh, auth.refreshToken);
  localStorage.setItem(KEYS.user, JSON.stringify(auth.user));
}

export function clearAuth(): void {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.user);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.access);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEYS.refresh);
}

export function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(KEYS.user);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o['id'] === 'string' &&
      typeof o['role'] === 'string' &&
      (o['email'] === null || typeof o['email'] === 'string') &&
      typeof o['firstName'] === 'string' &&
      typeof o['lastName'] === 'string'
    ) {
      return {
        id: o['id'],
        role: o['role'] as UserRole,
        email: o['email'] as string | null,
        firstName: o['firstName'],
        lastName: o['lastName'],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function loadStoredAuth(): StoredAuth | null {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const user = readStoredUser();
  if (!accessToken || !refreshToken || !user) {
    return null;
  }
  return { accessToken, refreshToken, user };
}
