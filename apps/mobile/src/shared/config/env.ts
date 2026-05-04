import Constants from 'expo-constants';

type Extra = {
  EXPO_PUBLIC_API_BASE_URL?: string;
};

function getExtra(): Extra {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') return {};
  return extra as Extra;
}

function trimTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

/** LAN IP/host Expo использует для Metro — тот же хост доступен для API с телефона в той же Wi‑Fi сети. */
function isLikelyLanDevHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]),
    b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function hostnameFromHostLike(raw: string | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const host = raw.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

/** Dev-only: адрес упаковщика из конфига Expo (совпадает с IP машины в локальной сети). */
function getLanDevHostFromExpo(): string | null {
  const fromConfig = hostnameFromHostLike(Constants.expoConfig?.hostUri);
  if (fromConfig && isLikelyLanDevHost(fromConfig)) return fromConfig;

  const go = Constants.expoGoConfig as { debuggerHost?: string } | null | undefined;
  const fromDbg = hostnameFromHostLike(go?.debuggerHost);
  if (fromDbg && isLikelyLanDevHost(fromDbg)) return fromDbg;

  return null;
}

/**
 * На устройстве `localhost` в URL API указывает на сам телефон/эмулятор, не на хост с Nest.
 * Для эмулятора Android без LAN-хоста из Expo используем `10.0.2.2`.
 */
function mapLocalhostForNative(url: string): string {
  try {
    const { Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS === 'web') return trimTrailingSlash(url);
  } catch {
    return trimTrailingSlash(url);
  }

  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h !== 'localhost' && h !== '127.0.0.1') return trimTrailingSlash(url);

    const lan = getLanDevHostFromExpo();
    if (lan) {
      u.hostname = lan;
      return trimTrailingSlash(u.toString());
    }

    try {
      const { Platform } = require('react-native') as typeof import('react-native');
      if (Platform.OS === 'android') {
        u.hostname = '10.0.2.2';
        return trimTrailingSlash(u.toString());
      }
    } catch {
      /* noop */
    }

    return trimTrailingSlash(url);
  } catch {
    return trimTrailingSlash(url);
  }
}

export function getApiBaseUrl(): string {
  const fromExtra = getExtra().EXPO_PUBLIC_API_BASE_URL;
  let raw =
    typeof fromExtra === 'string' && fromExtra.length > 0
      ? fromExtra
      : typeof process.env.EXPO_PUBLIC_API_BASE_URL === 'string' &&
          process.env.EXPO_PUBLIC_API_BASE_URL.length > 0
        ? process.env.EXPO_PUBLIC_API_BASE_URL
        : 'http://localhost:3000/api/v1';

  raw = raw.replace(/\/+$/, '');
  return mapLocalhostForNative(raw);
}

