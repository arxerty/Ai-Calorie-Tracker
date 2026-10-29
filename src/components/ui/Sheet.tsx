'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** false = no swipe-down / backdrop / close-button dismissal (used by onboarding) */
  dismissible?: boolean;
  /** Fills almost the whole screen instead of sizing to content */
  tall?: boolean;
  /** Pinned under the scrolling content (primary action) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export default function Sheet({ open, onClose, title, dismissible = true, tall = false, footer, children }: SheetProps) {
  const { hapticImpact } = useTma();
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, dismissible, onClose]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) {
      hapticImpact('light');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'var(--overlay)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={dismissible ? onClose : undefined}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'relative flex w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-background shadow-2xl',
              tall ? 'h-[92dvh]' : 'max-h-[92dvh]'
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340, mass: 0.9 }}
            drag={dismissible ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
          >
            {/* Grabber + title: the drag handle for swipe-to-dismiss */}
            <div
              className="relative shrink-0 touch-none px-4 pb-2 pt-2"
              onPointerDown={(e) => dismissible && dragControls.start(e)}
            >
              {dismissible && <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-label3" />}
              {(title || dismissible) && (
                <div className="flex min-h-[36px] items-center justify-center">
                  {title && <h2 className="px-10 text-center text-headline font-semibold">{title}</h2>}
                  {dismissible && (
                    <button
                      type="button"
                      aria-label="Закрыть"
                      onClick={onClose}
                      className="pressable absolute right-4 top-[18px] flex h-8 w-8 items-center justify-center rounded-full bg-fill text-label2"
                    >
                      <X size={16} strokeWidth={2.6} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>

            {footer && (
              <div
                className="material shrink-0 border-t-[0.5px] border-separator px-4 pt-3"
                style={{ paddingBottom: 'calc(12px + var(--safe-bottom))' }}
              >
                {footer}
              </div>
            )}
            {!footer && <div className="shrink-0" style={{ height: 'var(--safe-bottom)' }} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
