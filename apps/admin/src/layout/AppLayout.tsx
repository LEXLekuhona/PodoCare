import { UserRole } from '@podocare/shared-types';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

function roleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.SuperAdmin:
      return 'SuperAdmin';
    case UserRole.NetworkOwner:
      return 'NetworkOwner';
    case UserRole.StudioAdmin:
      return 'StudioAdmin';
    case UserRole.ContentAuthor:
      return 'ContentAuthor';
    case UserRole.Specialist:
      return 'Specialist';
    case UserRole.Client:
      return 'Client';
    default:
      return role;
  }
}

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <strong>PodoCare</strong>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
          Админка
        </p>
        <nav style={{ marginTop: '1.25rem' }}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Обзор
          </NavLink>
          <NavLink to="/catalog/networks" className={({ isActive }) => (isActive ? 'active' : '')}>
            Сети
          </NavLink>
          <NavLink to="/catalog/studios" className={({ isActive }) => (isActive ? 'active' : '')}>
            Студии
          </NavLink>
          <NavLink
            to="/catalog/specialists"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Специалисты
          </NavLink>
          <NavLink to="/catalog/staff" className={({ isActive }) => (isActive ? 'active' : '')}>
            Сотрудники
          </NavLink>
          <NavLink
            to="/catalog/health-concerns"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Жалобы
          </NavLink>
          <NavLink to="/catalog/faq" className={({ isActive }) => (isActive ? 'active' : '')}>
            FAQ
          </NavLink>
        </nav>
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div className="badge" style={{ marginBottom: '0.5rem' }}>
            {user ? roleLabel(user.role) : ''}
          </div>
          <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {user?.firstName} {user?.lastName}
            <br />
            <span style={{ color: 'var(--muted)' }}>{user?.email ?? user?.id}</span>
          </div>
          <button type="button" className="danger" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
