'use client';

import React, { useEffect, useState } from 'react';
import { useTma } from '@/components/tma-provider';
import Sheet from '@/components/ui/Sheet';
import Segmented from '@/components/ui/Segmented';
import Switch from '@/components/ui/Switch';
import { Group, Row } from '@/components/ui/Group';
import { mealOf } from '@/components/screens/TodayScreen';
import { MEAL_TYPES, type MealType } from '@/lib/nutrition';
import { formatTime } from '@/lib/date';
import type { Favorite, FoodItem, QuickFood } from '@/lib/types';

interface EntrySheetProps {
  item: FoodItem | null;
  onClose: () => void;
  favorites: Favorite[];
  onChangeMeal: (id: string, meal: MealType) => void;
  onScale: (id: string, scale: number) => void;
  onToggleFavorite: (food: QuickFood, existing?: Favorite) => void;
  onDelete: (item: FoodItem) => void;
}

const mealOptions = MEAL_TYPES.map((m) => ({ id: m.id, label: m.label }));

const PORTION_STEPS = [
  { scale: 0.5, label: '× ½' },
  { scale: 0.75, label: '× ¾' },
  { scale: 1.25, label: '× 1¼' },
  { scale: 2, label: '× 2' },
];

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

export default function EntrySheet({ item, onClose, favorites, onChangeMeal, onScale, onToggleFavorite, onDelete }: EntrySheetProps) {
  const { hapticImpact } = useTma();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Keep the last item while the sheet animates out, so content doesn't flash empty
  const [shown, setShown] = useState<FoodItem | null>(item);
  useEffect(() => {
    if (item) setShown(item);
    setConfirmingDelete(false);
  }, [item]);

  const entry = item ?? shown;
  const favorite = entry ? favorites.find((f) => f.name.trim().toLowerCase() === entry.name.trim().toLowerCase()) : undefined;

  return (
    <Sheet open={item !== null} onClose={onClose} title={entry?.name}>
      {entry && (
        <>
          <div className="mb-6 flex items-center gap-4">
            {entry.photo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.photo.url} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-card text-4xl">
                {MEAL_TYPES.find((m) => m.id === mealOf(entry))?.emoji}
              </span>
            )}
            <div>
              <p className="text-largetitle font-bold tabular">
                {fmt(entry.calories)} <span className="text-headline font-normal text-label2">ккал</span>
              </p>
              <p className="text-subhead tabular text-label2">
                {fmt(entry.weightG)} г · {formatTime(entry.createdAt)}
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Белки', value: entry.proteinG, color: 'var(--protein)' },
              { label: 'Углеводы', value: entry.carbsG, color: 'var(--carbs)' },
              { label: 'Жиры', value: entry.fatG, color: 'var(--fat)' },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-card p-3 text-center">
                <p className="text-footnote font-medium" style={{ color: m.color }}>
                  {m.label}
                </p>
                <p className="text-headline font-semibold tabular">{fmt(m.value)} г</p>
              </div>
            ))}
          </div>

          <Group header="Приём пищи">
            <div className="p-3">
              <Segmented options={mealOptions} value={mealOf(entry)} onChange={(m) => onChangeMeal(entry.id, m)} />
            </div>
          </Group>

          <Group header="Изменить порцию" footer="Вес и КБЖУ пересчитаются пропорционально.">
            <div className="grid grid-cols-4 gap-2 p-3">
              {PORTION_STEPS.map((s) => (
                <button
                  key={s.scale}
                  type="button"
                  onClick={() => {
                    hapticImpact('light');
                    onScale(entry.id, s.scale);
                  }}
                  className="pressable-scale h-9 rounded-lg bg-fill text-subhead font-semibold tabular"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Group>

          <Group>
            <Row
              title="В избранное"
              trailing={
                <Switch
                  checked={!!favorite}
                  label="В избранное"
                  onChange={() =>
                    onToggleFavorite(
                      {
                        name: entry.name,
                        weightG: entry.weightG,
                        calories: entry.calories,
                        proteinG: entry.proteinG,
                        fatG: entry.fatG,
                        carbsG: entry.carbsG,
                      },
                      favorite
                    )
                  }
                />
              }
            />
          </Group>

          {confirmingDelete ? (
            <Group footer="Это действие нельзя отменить.">
              <Row title="Удалить запись" destructive onClick={() => onDelete(entry)} />
              <Row title="Отмена" onClick={() => setConfirmingDelete(false)} />
            </Group>
          ) : (
            <Group>
              <Row
                title="Удалить"
                destructive
                onClick={() => {
                  hapticImpact('medium');
                  setConfirmingDelete(true);
                }}
              />
            </Group>
          )}
        </>
      )}
    </Sheet>
  );
}
