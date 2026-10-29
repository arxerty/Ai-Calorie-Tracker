'use client';

import React from 'react';
import { Droplets, Minus } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import { Bar } from '@/components/charts';
import Button from '@/components/ui/Button';

interface WaterCardProps {
  ml: number;
  targetMl: number;
  onAdd: (deltaMl: number) => void;
}

const liters = (ml: number) => (ml / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const GLASS = 250;
const BOTTLE = 500;

export default function WaterCard({ ml, targetMl, onAdd }: WaterCardProps) {
  const { hapticImpact } = useTma();

  const add = (delta: number) => {
    hapticImpact('light');
    onAdd(delta);
  };

  return (
    <section className="mb-6 rounded-2xl bg-card p-4" aria-label="Вода">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-water text-white">
          <Droplets size={18} />
        </span>
        <h2 className="flex-1 text-headline font-semibold">Вода</h2>
        <span className="text-subhead tabular text-label2">
          <span className="font-semibold text-label">{liters(ml)}</span> / {liters(targetMl)} л
        </span>
      </div>

      <Bar value={ml} max={targetMl} color="var(--water)" className="mb-4 h-2" />

      <div className="flex gap-2">
        <button
          type="button"
          aria-label={`Убрать ${GLASS} мл`}
          disabled={ml <= 0}
          onClick={() => add(-GLASS)}
          className="pressable-scale flex h-8 w-11 shrink-0 items-center justify-center rounded-full bg-fill text-label2 disabled:opacity-30"
        >
          <Minus size={16} strokeWidth={2.6} />
        </button>
        <Button variant="tinted" size="sm" className="flex-1" onClick={() => add(GLASS)}>
          + {GLASS} мл
        </Button>
        <Button variant="tinted" size="sm" className="flex-1" onClick={() => add(BOTTLE)}>
          + {BOTTLE} мл
        </Button>
      </div>
    </section>
  );
}
