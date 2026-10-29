'use client';

import React, { useEffect, useState } from 'react';

interface ScreenProps {
  title: string;
  /** Small uppercase line above the large title (e.g. the date) */
  eyebrow?: string;
  /** Buttons aligned to the right of the large title */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

const COLLAPSE_AT = 48;

/**
 * Navigation-bar screen: large title that collapses into a translucent compact bar on scroll.
 * Leaves room at the bottom for the tab bar.
 */
export default function Screen({ title, eyebrow, trailing, children }: ScreenProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => setCollapsed(window.scrollY > COLLAPSE_AT);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4">
      {/* Compact bar */}
      <div
        aria-hidden={!collapsed}
        className="material pointer-events-none fixed inset-x-0 top-0 z-30 border-b-[0.5px] border-separator transition-opacity duration-200"
        style={{ opacity: collapsed ? 1 : 0, paddingTop: 'var(--safe-top)' }}
      >
        <div className="mx-auto flex h-11 max-w-md items-center justify-center">
          <span className="text-headline font-semibold">{title}</span>
        </div>
      </div>

      <header className="flex items-end justify-between gap-3 pb-3 pt-3" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <div className="min-w-0">
          {eyebrow && <p className="text-footnote font-semibold uppercase tracking-wide text-label2">{eyebrow}</p>}
          <h1 className="truncate text-largetitle font-bold tracking-tight">{title}</h1>
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-2 pb-1">{trailing}</div>}
      </header>

      <div style={{ paddingBottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 24px)' }}>{children}</div>
    </main>
  );
}
