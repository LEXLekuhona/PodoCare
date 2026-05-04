import { UserRole } from '@podocare/shared-types';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearAuth,
  loadStoredAuth,
  readStoredUser,
  saveAuth,
  type StoredAuth,
} from './auth-storage';

describe('auth-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveAuth и loadStoredAuth сохраняют токены и пользователя', () => {
    const auth: StoredAuth = {
      accessToken: 'a',
      refreshToken: 'r',
      user: {
        id: 'u1',
        role: UserRole.SuperAdmin,
        email: 'a@b.c',
        firstName: 'A',
        lastName: 'B',
      },
    };
    saveAuth(auth);
    expect(loadStoredAuth()).toEqual(auth);
    expect(readStoredUser()?.email).toBe('a@b.c');
  });

  it('clearAuth удаляет данные', () => {
    saveAuth({
      accessToken: 'x',
      refreshToken: 'y',
      user: {
        id: 'u',
        role: UserRole.NetworkOwner,
        email: null,
        firstName: 'N',
        lastName: 'O',
      },
    });
    clearAuth();
    expect(loadStoredAuth()).toBeNull();
  });
});
