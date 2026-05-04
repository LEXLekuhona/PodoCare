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
    <div>
      <h1 style={{ marginTop: 0 }}>Обзор</h1>
      <p style={{ color: 'var(--muted)', maxWidth: 560 }}>
        Каталог (сети, студии, жалобы, FAQ) редактируется в боковом меню.
        Эта SPA вызывает префикс <span className="mono">{api}</span>.
      </p>
      <ul>
        <li>
          <a href={docs} target="_blank" rel="noreferrer">
            Swagger UI
          </a>{' '}
          — также <span className="mono">admin/education</span> и прочие разделы API без отдельного UI в этой сборке.
        </li>
        <li>
          Локальный быстрый старт:{' '}
          <span className="mono">
            pnpm bootstrap:dev-admin && pnpm dev:stack:admin
          </span>
        </li>
      </ul>
    </div>
  );
}
