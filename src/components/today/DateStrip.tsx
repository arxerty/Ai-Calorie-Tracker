'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import { useStats } from '@/hooks/use-app-data';
import { addDays, dateRange, dayOfMonth, parseDateStr, startOfWeek, weekdayShort } from '@/lib/date';
import { cn } from '@/lib/cn';

interface DateStripProps {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  enabled: boolean;
}

/** Week picker: Monday–Sunday of the selected day, a dot under days that have entries. */
export default function DateStrip({ selected, today, onSelect, enabled }: DateStripProps) {
  const { hapticSelectionChange } = useTma();

  const weekStart = startOfWeek(selected);
  const weekEnd = addDays(weekStart, 6);
  const days = dateRange(weekStart, weekEnd);
  const isCurrentWeek = today >= weekStart && today <= weekEnd;

  const { data: stats } = useStats(weekStart, weekEnd, enabled);
  const logged = new Set((stats ?? []).filter((d) => d.meals > 0).map((d) => d.date));

  const shiftWeek = (dir: -1 | 1) => {
    hapticSelectionChange();
    const target = addDays(selected, dir * 7);
    onSelect(target > today ? today : target);
  };

  return (
    <div className="mb-4 flex items-center gap-1">
      <button
        type="button"
        aria-label="Предыдущая неделя"
        onClick={() => shiftWeek(-1)}
        className="pressable flex h-9 w-7 shrink-0 items-center justify-center text-label2"
      >
        <ChevronLeft size={20} strokeWidth={2.4} />
      </button>

      <div className="grid flex-1 grid-cols-7">
        {days.map((date) => {
          const isSelected = date === selected;
          const isFuture = date > today;
          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              aria-label={parseDateStr(date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
              aria-pressed={isSelected}
              onClick={() => {
                hapticSelectionChange();
                onSelect(date);
              }}
              className="pressable flex flex-col items-center gap-1 py-1 disabled:opacity-30"
            >
              <span className={cn('text-caption font-medium', date === today ? 'text-accent' : 'text-label2')}>
                {weekdayShort(date)}
              </span>
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-headline tabular',
                  isSelected ? 'bg-accent font-semibold text-white' : date === today ? 'font-semibold text-accent' : 'text-label'
                )}
              >
                {dayOfMonth(date)}
              </span>
              <span className={cn('h-1 w-1 rounded-full', logged.has(date) ? 'bg-label3' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Следующая неделя"
        disabled={isCurrentWeek}
        onClick={() => shiftWeek(1)}
        className="pressable flex h-9 w-7 shrink-0 items-center justify-center text-label2 disabled:opacity-25"
      >
        <ChevronRight size={20} strokeWidth={2.4} />
      </button>
    </div>
  );
}
