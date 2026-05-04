/**
 * Ждёт доступность Postgres и Redis на localhost (порты из .env или значения по умолчанию как в .env.example).
 */
const fs = require('node:fs');
const path = require('node:path');
const waitOn = require('wait-on');

function parseDotEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(envExamplePath)) {
    console.error('❌  Нет файла .env и .env.example в корне репозитория.');
    process.exit(1);
  }
  fs.copyFileSync(envExamplePath, envPath);
  console.warn('📋  Создан .env из .env.example — при необходимости замените секреты.');
}

const apiEnvPath = path.join(root, 'apps', 'api', '.env');
if (fs.existsSync(envPath)) {
  fs.copyFileSync(envPath, apiEnvPath);
}

const mobileEnvPath = path.join(root, 'apps', 'mobile', '.env');
const mobileEnvExamplePath = path.join(root, 'apps', 'mobile', '.env.example');
if (!fs.existsSync(mobileEnvPath) && fs.existsSync(mobileEnvExamplePath)) {
  fs.copyFileSync(mobileEnvExamplePath, mobileEnvPath);
  console.warn('📋  Создан apps/mobile/.env из apps/mobile/.env.example');
}

let pgPort = '5433';
let redisPort = '6379';
if (fs.existsSync(envPath)) {
  const parsed = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
  if (parsed.POSTGRES_PORT) pgPort = parsed.POSTGRES_PORT;
  if (parsed.REDIS_PORT) redisPort = parsed.REDIS_PORT;
}

waitOn({
  resources: [`tcp:127.0.0.1:${pgPort}`, `tcp:127.0.0.1:${redisPort}`],
  timeout: 120_000,
})
  .then(() => {
    console.log(`✓  Инфраструктура доступна (postgres:${pgPort}, redis:${redisPort})`);
  })
  .catch((err) => {
    console.error('❌  Таймаут ожидания Postgres/Redis. Проверьте `docker compose ps` и порты в .env.');
    console.error(err);
    process.exit(1);
  });
