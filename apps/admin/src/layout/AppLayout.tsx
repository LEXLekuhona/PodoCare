import { UserRole } from '@srs/shared-types';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { canManageStaff, canMutateTenantCatalog } from '../lib/roles';

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
  const role = user?.role;
  const canTenant = role ? canMutateTenantCatalog(role) : false;
  const canStaff = role ? canManageStaff(role) : false;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <strong style={{ fontSize: '1.08rem' }}>Solodova Recovery System</strong>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
            Админ-панель сети и студий
          </p>
        </div>

        <nav>
          <div className="nav-caption">Основное</div>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Обзор
          </NavLink>
          <div className="nav-caption">Каталог</div>
          {canTenant ? (
            <>
              <NavLink to="/catalog/networks" className={({ isActive }) => (isActive ? 'active' : '')}>
                Сети
              </NavLink>
              <NavLink to="/catalog/studios" className={({ isActive }) => (isActive ? 'active' : '')}>
                Студии
              </NavLink>
              <NavLink
                to="/catalog/health-concerns"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Что вас беспокоит
              </NavLink>
              <NavLink
                to="/catalog/studio-directions"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Направления студии
              </NavLink>
              <NavLink to="/catalog/faq" className={({ isActive }) => (isActive ? 'active' : '')}>
                FAQ
              </NavLink>
            </>
          ) : null}
          {canStaff ? (
            <>
              <NavLink to="/catalog/services" className={({ isActive }) => (isActive ? 'active' : '')}>
                Услуги
              </NavLink>
              <NavLink to="/catalog/products" className={({ isActive }) => (isActive ? 'active' : '')}>
                Товары
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
            </>
          ) : null}
          <div className="nav-caption">Обучение</div>
          {canStaff ? (
            <>
              <NavLink to="/education/content" className={({ isActive }) => (isActive ? 'active' : '')}>
                Контент и воронка
              </NavLink>
              <NavLink to="/education/quiz" className={({ isActive }) => (isActive ? 'active' : '')}>
                Диагностический квиз
              </NavLink>
            </>
          ) : null}
          <div className="nav-caption">Клиника</div>
          {canStaff ? (
            <NavLink
              to="/operations/treatment-flow"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Протоколы и планы
            </NavLink>
          ) : null}
        </nav>

        <div className="sidebar-foot">
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
