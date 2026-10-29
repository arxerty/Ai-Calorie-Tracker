'use client';

import React, { useState } from 'react';
import { Flame, Trash2 } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { FieldRow, Group } from '@/components/ui/Group';
import { Bar, BarChart, LineChart } from '@/components/charts';
import { useStats, useWeight } from '@/hooks/use-app-data';
import { addDays, dateRange, formatDayShort, parseDateStr, weekdayShort } from '@/lib/date';
import { goalLabel } from '@/lib/nutrition';
import { cn } from '@/lib/cn';
import type { DayStats, SyncData } from '@/lib/types';

type RangeId = '7' | '30' | '90';

const RANGES: { id: RangeId; label: string; days: number }[] = [
  { id: '7', label: '7 дней', days: 7 },
  { id: '30', label: '30 дней', days: 30 },
  { id: '90', label: '3 месяца', days: 90 },
];

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const kg = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${kg(Math.abs(n))}`;

const emptyDay = (date: string): DayStats => ({ date, calories: 0, protein: 0, fat: 0, carbs: 0, meals: 0, waterMl: 0 });

interface ProgressScreenProps {
  sync: SyncData;
  today: string;
}

export default function ProgressScreen({ sync, today }: ProgressScreenProps) {
  const { hapticNotification } = useTma();
  const toast = useToast();
  const { settings, user } = sync;

  const [rangeId, setRangeId] = useState<RangeId>('7');
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const days = RANGES.find((r) => r.id === rangeId)!.days;
  const from = addDays(today, -(days - 1));

  const { data: stats = [], isLoading } = useStats(from, today, true);
  const weight = useWeight(true);

  // ---- food stats over the period
  const byDate = new Map(stats.map((d) => [d.date, d]));
  const series = dateRange(from, today).map((date) => byDate.get(date) ?? emptyDay(date));
  const logged = series.filter((d) => d.meals > 0);
  const avg = (pick: (d: DayStats) => number, list: DayStats[] = logged) =>
    list.length === 0 ? 0 : list.reduce((a, d) => a + pick(d), 0) / list.length;

  const avgCalories = avg((d) => d.calories);
  const avgWater = avg((d) => d.waterMl, series.filter((d) => d.waterMl > 0));
  const calDiff = Math.round(avgCalories - settings.calorieTarget);

  const picked = selectedBar !== null ? series[selectedBar] : null;

  const midLabel = formatDayShort(series[Math.floor(series.length / 2)].date);
  const barLabels: [string, string, string] =
    days === 7
      ? [weekdayShort(series[0].date), weekdayShort(series[3].date), weekdayShort(series[6].date)]
      : [formatDayShort(series[0].date), midLabel, formatDayShort(series[series.length - 1].date)];

  // ---- weight
  const allEntries = weight.entries;
  const inRange = allEntries.filter((e) => e.date >= from);
  const useAll = inRange.length < 2;
  const chartEntries = useAll ? allEntries.slice(-30) : inRange;
  const currentWeight = allEntries.length > 0 ? allEntries[allEntries.length - 1].weightKg : settings.weight;
  const weightDelta =
    chartEntries.length >= 2 ? chartEntries[chartEntries.length - 1].weightKg - chartEntries[0].weightKg : null;

  const goodDirection =
    weightDelta === null
      ? null
      : user.fitnessGoal === 'weight_loss'
        ? weightDelta < 0
        : user.fitnessGoal === 'muscle_gain'
          ? weightDelta > 0
          : Math.abs(weightDelta) <= 0.5;

  const submitWeight = async () => {
    const value = parseFloat(weightInput.replace(',', '.'));
    if (!value || value < 20 || value > 400) {
      hapticNotification('warning');
      toast({ kind: 'error', message: 'Введите вес от 20 до 400 кг' });
      return;
    }
    try {
      await weight.add.mutateAsync({ date: today, weightKg: value });
      setWeightInput('');
      hapticNotification('success');
      toast({ message: `Вес записан: ${kg(value)} кг` });
    } catch (e: any) {
      hapticNotification('error');
      toast({ kind: 'error', message: e.message || 'Не удалось сохранить вес' });
    }
  };

  const last7 = series.slice(-7);

  return (
    <Screen title="Прогресс">
      <Segmented options={RANGES} value={rangeId} onChange={(id) => { setRangeId(id); setSelectedBar(null); }} className="mb-4" />

      {/* Summary tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4">
          <p className="text-footnote text-label2">В среднем в день</p>
          <p className="mt-1 text-title2 font-bold tabular">{logged.length ? `${fmt(avgCalories)} ккал` : '—'}</p>
          {logged.length > 0 && (
            <p className={cn('text-footnote tabular', Math.abs(calDiff) <= settings.calorieTarget * 0.1 ? 'text-success' : 'text-orange')}>
              {calDiff > 0 ? '+' : calDiff < 0 ? '−' : ''}
              {fmt(Math.abs(calDiff))} к цели
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-card p-4">
          <p className="text-footnote text-label2">Дней с записями</p>
          <p className="mt-1 text-title2 font-bold tabular">
            {logged.length} <span className="text-subhead font-normal text-label2">из {days}</span>
          </p>
          <p className="text-footnote tabular text-label2">
            Вода: {avgWater ? `${(avgWater / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} л/день` : '—'}
          </p>
        </div>
      </div>

      {/* Calories chart */}
      <Group header="Калории по дням">
        <div className="p-4">
          <p className="mb-3 min-h-[20px] text-subhead tabular text-label2">
            {picked ? (
              <>
                <span className="font-semibold text-label">{fmt(picked.calories)} ккал</span> ·{' '}
                {parseDateStr(picked.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
              </>
            ) : isLoading ? (
              'Загрузка…'
            ) : (
              `Цель: ${fmt(settings.calorieTarget)} ккал`
            )}
          </p>
          <BarChart
            data={series.map((d) => ({ key: d.date, value: d.calories }))}
            target={settings.calorieTarget}
            color="var(--accent)"
            overColor="var(--orange)"
            selectedIndex={selectedBar}
            onSelect={setSelectedBar}
            labels={barLabels}
          />
        </div>
      </Group>

      {/* Macros */}
      <Group header="Макронутриенты (в среднем)">
        <div className="space-y-4 p-4">
          {logged.length === 0 ? (
            <p className="text-subhead text-label2">Пока нет записей за этот период.</p>
          ) : (
            [
              { label: 'Белки', value: avg((d) => d.protein), target: settings.proteinTarget, color: 'var(--protein)' },
              { label: 'Углеводы', value: avg((d) => d.carbs), target: settings.carbTarget, color: 'var(--carbs)' },
              { label: 'Жиры', value: avg((d) => d.fat), target: settings.fatTarget, color: 'var(--fat)' },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1.5 flex justify-between text-subhead">
                  <span style={{ color: m.color }} className="font-medium">
                    {m.label}
                  </span>
                  <span className="tabular">
                    <span className="font-semibold">{fmt(m.value)}</span>
                    <span className="text-label2"> / {fmt(m.target)} г</span>
                  </span>
                </div>
                <Bar value={m.value} max={m.target} color={m.color} />
              </div>
            ))
          )}
        </div>
      </Group>

      {/* Weight */}
      <Group header="Вес" footer={`Цель: ${goalLabel(user.fitnessGoal).toLowerCase()}`}>
        <div className="p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-footnote text-label2">Сейчас</p>
              <p className="text-title font-bold tabular">{currentWeight ? `${kg(currentWeight)} кг` : '—'}</p>
            </div>
            {weightDelta !== null && (
              <div className="text-right">
                <p className={cn('text-headline font-semibold tabular', goodDirection ? 'text-success' : 'text-label2')}>
                  {signed(weightDelta)} кг
                </p>
                <p className="text-footnote text-label2">{useAll ? 'за всё время' : `за ${days} дн.`}</p>
              </div>
            )}
          </div>

          {chartEntries.length >= 2 ? (
            <LineChart
              points={chartEntries.map((e) => ({ t: parseDateStr(e.date).getTime(), y: e.weightKg }))}
              color="var(--accent)"
              labels={[formatDayShort(chartEntries[0].date), formatDayShort(chartEntries[chartEntries.length - 1].date)]}
            />
          ) : (
            <p className="rounded-xl bg-raised px-4 py-5 text-center text-subhead text-label2">
              {allEntries.length === 0
                ? 'Запишите вес сегодня — и здесь появится график. Лучше взвешиваться раз в несколько дней в одно и то же время.'
                : 'Нужно минимум две записи, чтобы построить график.'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 p-2 pr-3">
          <div className="min-w-0 flex-1">
            <FieldRow
              label="Новый вес"
              value={weightInput}
              onChange={setWeightInput}
              unit="кг"
              placeholder={currentWeight ? kg(currentWeight) : '70'}
            />
          </div>
          <Button size="sm" loading={weight.add.isPending} onClick={submitWeight} disabled={!weightInput}>
            Записать
          </Button>
        </div>

        {allEntries.length > 0 &&
          [...allEntries]
            .reverse()
            .slice(0, 5)
            .map((e) => (
              <div key={e.id} className="flex min-h-[44px] items-center gap-3 px-4">
                <span className="flex-1 text-body text-label2">{formatDayShort(e.date)}</span>
                <span className="text-body tabular">{kg(e.weightKg)} кг</span>
                {confirmingId === e.id ? (
                  <button
                    type="button"
                    className="pressable text-subhead font-semibold text-danger"
                    onClick={() => {
                      weight.remove.mutate(e.id);
                      setConfirmingId(null);
                    }}
                  >
                    Удалить
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Удалить запись веса"
                    className="pressable flex h-8 w-8 items-center justify-center text-label3"
                    onClick={() => setConfirmingId(e.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
      </Group>

      {/* Streak */}
      <Group header="Серия">
        <div className="p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange/15">
              <Flame size={24} className={user.streakDays > 0 ? 'fill-orange text-orange' : 'text-label3'} />
            </span>
            <div>
              <p className="text-title2 font-bold tabular">
                {user.streakDays} {pluralDays(user.streakDays)}
              </p>
              <p className="text-footnote text-label2">записей подряд</p>
            </div>
          </div>
          <div className="flex justify-between">
            {last7.map((d) => (
              <div key={d.date} className="flex flex-col items-center gap-1.5">
                <span className="text-caption text-label2">{weekdayShort(d.date)}</span>
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-footnote font-semibold',
                    d.meals > 0 ? 'bg-orange text-white' : 'bg-fill text-label3'
                  )}
                >
                  {d.meals > 0 ? '✓' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Group>
    </Screen>
  );
}

function pluralDays(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}
