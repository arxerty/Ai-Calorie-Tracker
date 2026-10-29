'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  kind?: ToastKind;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(opts: ToastOptions) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/** iOS-style banner at the top of the screen. Replaces alert(). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { ...opts, id }]);
      setTimeout(() => dismiss(id), opts.action ? 5500 : 3200);
    },
    [dismiss]
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
        style={{ top: 'calc(var(--safe-top) + 8px)' }}
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ y: -40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              className="material pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
            >
              {t.kind === 'error' ? (
                <AlertCircle size={20} className="shrink-0 text-danger" />
              ) : t.kind === 'info' ? null : (
                <CheckCircle2 size={20} className="shrink-0 text-success" />
              )}
              <p className="min-w-0 flex-1 text-subhead font-medium">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="pressable shrink-0 text-subhead font-semibold text-accent"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
