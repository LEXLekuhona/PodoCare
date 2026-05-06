import * as SecureStore from 'expo-secure-store';

const ANON_TOKEN_KEY = 'srs.quiz.anonToken.v1';
const LAST_SESSION_ID_KEY = 'srs.quiz.lastSessionId.v1';

async function getOrCreateSecureValue(key: string): Promise<string> {
  const existing = await SecureStore.getItemAsync(key);
  if (existing && existing.trim() !== '') return existing;
  const next = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  await SecureStore.setItemAsync(key, next);
  return next;
}

export async function getQuizAnonToken(): Promise<string> {
  return getOrCreateSecureValue(ANON_TOKEN_KEY);
}

export async function setLastQuizSessionId(sessionId: string): Promise<void> {
  await SecureStore.setItemAsync(LAST_SESSION_ID_KEY, sessionId);
}

export async function getLastQuizSessionId(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_SESSION_ID_KEY);
}

export async function clearLastQuizSessionId(): Promise<void> {
  await SecureStore.deleteItemAsync(LAST_SESSION_ID_KEY);
}
