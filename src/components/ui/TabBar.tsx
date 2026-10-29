'use client';

import React from 'react';
import { useTma } from '@/components/tma-provider';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}

/** Translucent iOS tab bar pinned to the bottom, respecting the home-indicator safe area. */
export default function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  const { hapticSelectionChange } = useTma();

  return (
    <nav
      aria-label="Основная навигация"
      className="material fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] border-separator"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto flex h-[var(--tabbar-h)] max-w-md">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              aria-current={selected ? 'page' : undefined}
              onClick={() => {
                if (!selected) hapticSelectionChange();
                onChange(tab.id);
              }}
              className={cn(
                'pressable flex flex-1 flex-col items-center justify-center gap-0.5',
                selected ? 'text-accent' : 'text-label2'
              )}
            >
              <Icon size={25} strokeWidth={selected ? 2.4 : 1.9} />
              <span className="text-[10px] font-medium leading-3">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
