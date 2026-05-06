import { getApiUrl } from '../api/config';

function swaggerHref(): string {
  try {
    return new URL('/docs', getApiUrl()).href;
  } catch {
    return '/docs';
  }
}

export function DashboardPage() {
  const api = getApiUrl();
  const docs = swaggerHref();

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Обзор</h1>
        <p className="page-subtitle">
          Каталог и раздел «Обучение» редактируются в боковом меню. Эта SPA вызывает префикс{' '}
          <span className="mono">{api}</span>.
        </p>
      </div>
      <div className="surface-card">
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li>
            <a href={docs} target="_blank" rel="noreferrer">
              Swagger UI
            </a>{' '}
            — префиксы <span className="mono">/content/*</span>, <span className="mono">/admin/education/*</span> и
            др. открыты в Swagger.
          </li>
          <li>
            Локальный быстрый старт:{' '}
            <span className="mono">pnpm bootstrap:dev-admin && pnpm dev:stack:admin</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
