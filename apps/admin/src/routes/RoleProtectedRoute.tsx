import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

import type { UserRole } from '@srs/shared-types';

export function RoleProtectedRoute(props: { allow: UserRole[] }) {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="content" style={{ padding: '2rem' }}>
        Загрузка…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!props.allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

