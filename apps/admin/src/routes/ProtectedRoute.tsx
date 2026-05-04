import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute() {
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

  return <Outlet />;
}
