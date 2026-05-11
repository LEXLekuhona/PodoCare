type Handler = () => void;

let handler: Handler | null = null;

/** Регистрируется из `app/(app)/_layout` (есть доступ к router). */
export function registerSessionExpiredHandler(fn: Handler): void {
  handler = fn;
}

export function triggerSessionExpiredNavigation(): void {
  try {
    handler?.();
  } catch {
    /* noop */
  }
}
