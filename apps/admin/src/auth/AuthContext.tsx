import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { logoutRemote, staffLogin } from '../api/client';
import { loadStoredAuth } from '../lib/auth-storage';

import type { StoredUser } from '../lib/auth-storage';

interface AuthContextValue {
  ready: boolean;
  user: StoredUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const auth = loadStoredAuth();
    setUser(auth?.user ?? null);
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const auth = await staffLogin(email, password);
    setUser(auth.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutRemote();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      login,
      logout,
    }),
    [ready, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth вне AuthProvider');
  }
  return ctx;
}
