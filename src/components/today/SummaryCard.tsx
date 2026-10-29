'use client';

import React from 'react';
import ProgressRing from '@/components/ui/ProgressRing';
import { Bar } from '@/components/charts';

interface SummaryCardProps {
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  targets: { calories: number; protein: number; carbs: number; fat: number };
}

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

export default function SummaryCard({ consumed, targets }: SummaryCardProps) {
  const left = targets.calories - consumed.calories;
  const exceeded = left < 0;

  const macros = [
    { label: 'Белки', value: consumed.protein, target: targets.protein, color: 'var(--protein)' },
    { label: 'Углеводы', value: consumed.carbs, target: targets.carbs, color: 'var(--carbs)' },
    { label: 'Жиры', value: consumed.fat, target: targets.fat, color: 'var(--fat)' },
  ];

  return (
    <section className="mb-4 rounded-2xl bg-card p-4" aria-label="Итоги дня">
      <div className="flex items-center gap-5">
        <ProgressRing
          size={128}
          stroke={14}
          progress={consumed.calories / (targets.calories || 1)}
          color={exceeded ? 'var(--red)' : 'var(--accent)'}
        >
          <span className="text-title font-bold leading-8 tabular">{fmt(Math.abs(left))}</span>
          <span className="text-caption text-label2">{exceeded ? 'перебор' : 'осталось'}</span>
        </ProgressRing>

        <dl className="flex-1 space-y-3">
          <div>
            <dt className="text-footnote text-label2">Съедено</dt>
            <dd className="text-title2 font-semibold tabular">
              {fmt(consumed.calories)} <span className="text-subhead font-normal text-label2">ккал</span>
            </dd>
          </div>
          <div>
            <dt className="text-footnote text-label2">Цель</dt>
            <dd className="text-title2 font-semibold tabular">
              {fmt(targets.calories)} <span className="text-subhead font-normal text-label2">ккал</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t-[0.5px] border-separator pt-4">
        {macros.map((m) => (
          <div key={m.label}>
            <div className="text-footnote font-medium" style={{ color: m.color }}>
              {m.label}
            </div>
            <div className="mb-1.5 mt-0.5 text-subhead font-semibold tabular">
              {fmt(m.value)}
              <span className="font-normal text-label2"> / {fmt(m.target)} г</span>
            </div>
            <Bar value={m.value} max={m.target} color={m.color} />
          </div>
        ))}
      </div>
    </section>
  );
}
