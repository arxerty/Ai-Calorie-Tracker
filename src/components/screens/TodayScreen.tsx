'use client';

import React from 'react';
import { Flame, Plus } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import Screen from '@/components/ui/Screen';
import { Group, Row } from '@/components/ui/Group';
import { Spinner } from '@/components/ui/Button';
import DateStrip from '@/components/today/DateStrip';
import SummaryCard from '@/components/today/SummaryCard';
import WaterCard from '@/components/today/WaterCard';
import { useDayLog, useWater } from '@/hooks/use-app-data';
import { MEAL_TYPES, mealTypeForHour, type MealType } from '@/lib/nutrition';
import { formatTime, parseDateStr, toDateStr } from '@/lib/date';
import type { FoodItem, SyncData } from '@/lib/types';

interface TodayScreenProps {
  sync: SyncData;
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
  onAdd: (meal?: MealType) => void;
  onOpenEntry: (item: FoodItem) => void;
  onOpenProgress: () => void;
}

export function mealOf(item: FoodItem): MealType {
  return item.mealType ?? mealTypeForHour(new Date(item.createdAt).getHours());
}

export default function TodayScreen({
  sync,
  selectedDate,
  today,
  onSelectDate,
  onAdd,
  onOpenEntry,
  onOpenProgress,
}: TodayScreenProps) {
  const { hapticImpact } = useTma();
  const { settings, user } = sync;

  const { data: items = [], isLoading } = useDayLog(selectedDate, true);
  const water = useWater(selectedDate, true);

  const consumed = items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.proteinG,
      carbs: acc.carbs + i.carbsG,
      fat: acc.fat + i.fatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const title = selectedDate === today ? 'Сегодня' : parseDateStr(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const eyebrow = parseDateStr(selectedDate).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <Screen
        title={title}
        eyebrow={eyebrow}
        trailing={
          <button
            type="button"
            aria-label={`Серия: ${user.streakDays} дн.`}
            onClick={() => {
              hapticImpact('light');
              onOpenProgress();
            }}
            className="pressable-scale flex h-9 items-center gap-1.5 rounded-full bg-card px-3"
          >
            <Flame size={18} className={user.streakDays > 0 ? 'fill-orange text-orange' : 'text-label3'} />
            <span className="text-subhead font-semibold tabular">{user.streakDays}</span>
          </button>
        }
      >
        <DateStrip selected={selectedDate} today={today} onSelect={onSelectDate} enabled />

        <SummaryCard
          consumed={consumed}
          targets={{
            calories: settings.calorieTarget,
            protein: settings.proteinTarget,
            carbs: settings.carbTarget,
            fat: settings.fatTarget,
          }}
        />

        <WaterCard ml={water.ml} targetMl={settings.waterTarget} onAdd={(d) => water.add.mutate(d)} />

        {isLoading ? (
          <div className="flex justify-center py-8 text-label2">
            <Spinner />
          </div>
        ) : (
          MEAL_TYPES.map((meal) => {
            const mealItems = items.filter((i) => mealOf(i) === meal.id);
            const kcal = mealItems.reduce((a, i) => a + i.calories, 0);

            return (
              <Group
                key={meal.id}
                header={
                  <span className="flex items-baseline justify-between">
                    <span>
                      {meal.emoji} {meal.label}
                    </span>
                    {kcal > 0 && <span className="normal-case tabular">{Math.round(kcal).toLocaleString('ru-RU')} ккал</span>}
                  </span>
                }
              >
                {mealItems.map((item) => (
                  <Row key={item.id} onClick={() => onOpenEntry(item)}>
                    {item.photo?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photo.url} alt="" className="h-11 w-11 shrink-0 rounded-[10px] object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-fill text-xl">
                        {meal.emoji}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-body">{item.name}</span>
                      <span className="block truncate text-footnote tabular text-label2">
                        {Math.round(item.calories)} ккал · Б {Math.round(item.proteinG)} · У {Math.round(item.carbsG)} · Ж{' '}
                        {Math.round(item.fatG)}
                      </span>
                    </span>
                    {toDateStr(new Date(item.createdAt)) === selectedDate && (
                      <span className="shrink-0 self-start pt-1 text-footnote tabular text-label2">{formatTime(item.createdAt)}</span>
                    )}
                  </Row>
                ))}
                <Row
                  onClick={() => {
                    hapticImpact('light');
                    onAdd(meal.id);
                  }}
                >
                  <Plus size={20} className="text-accent" strokeWidth={2.4} />
                  <span className="text-body text-accent">Добавить</span>
                </Row>
              </Group>
            );
          })
        )}
      </Screen>

      {/* Floating add button, aligned to the content column */}
      <div
        className="pointer-events-none fixed inset-x-0 z-30"
        style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 16px)' }}
      >
        <div className="mx-auto flex max-w-md justify-end px-4">
          <button
            type="button"
            aria-label="Добавить еду"
            onClick={() => {
              hapticImpact('medium');
              onAdd();
            }}
            className="pressable-scale pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_20px_rgba(0,122,255,0.45)]"
          >
            <Plus size={28} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </>
  );
}
