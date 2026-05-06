import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import type { PropsWithChildren } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    if (timerRef.current != null) {
      globalThis.clearTimeout(timerRef.current);
    }
    const id = ++idRef.current;
    setToast({ id, message, tone });
    timerRef.current = globalThis.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
      timerRef.current = null;
    }, 2600);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
