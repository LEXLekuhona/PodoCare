import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

import type { FormEvent } from 'react';

export function LoginPage() {
  const { ready, user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (ready && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.35rem' }}>Вход в админку</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Email и пароль сотрудника (
        <span className="mono">POST /auth/staff/login</span>)
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      <form onSubmit={(ev) => void onSubmit(ev)}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
            minLength={8}
          />
        </div>
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
