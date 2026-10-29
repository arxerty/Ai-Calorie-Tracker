'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTma } from '@/components/tma-provider';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Switch from '@/components/ui/Switch';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { FieldRow, Group, Row } from '@/components/ui/Group';
import { useUpdateSettings, useWeight } from '@/hooks/use-app-data';
import { GOALS, calculateTargets, suggestWaterTarget, type Gender, type Goal } from '@/lib/nutrition';
import { toDateStr } from '@/lib/date';
import type { SyncData } from '@/lib/types';

interface Draft {
  gender: Gender;
  goal: Goal;
  weight: string;
  height: string;
  age: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  water: string;
}

const str = (n: number | null | undefined) => (n ? String(n) : '');

function draftFromSync(sync: SyncData): Draft {
  const { settings, user } = sync;
  return {
    gender: settings.gender ?? 'male',
    goal: (user.fitnessGoal as Goal) ?? 'maintenance',
    weight: str(settings.weight),
    height: str(settings.height),
    age: str(settings.age),
    calories: str(settings.calorieTarget),
    protein: str(settings.proteinTarget),
    fat: str(settings.fatTarget),
    carbs: str(settings.carbTarget),
    water: str(settings.waterTarget),
  };
}

const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;

export default function SettingsScreen({ sync }: { sync: SyncData }) {
  const { theme, setTheme, user: tgUser, hapticNotification } = useTma();
  const toast = useToast();
  const updateSettings = useUpdateSettings();
  const weightLog = useWeight(false);

  const serverDraft = useMemo(() => draftFromSync(sync), [sync]);
  const serverKey = JSON.stringify(serverDraft);

  const [draft, setDraft] = useState<Draft>(serverDraft);
  const [isSaving, setIsSaving] = useState(false);

  // Auto mode is on when the saved targets are exactly what the formula gives (i.e. not hand-edited)
  const [auto, setAuto] = useState(() => {
    const calc = calculateTargets({ ...sync.settings, goal: sync.user.fitnessGoal });
    return (
      !!calc &&
      calc.calories === sync.settings.calorieTarget &&
      calc.protein === sync.settings.proteinTarget &&
      calc.fat === sync.settings.fatTarget &&
      calc.carbs === sync.settings.carbTarget
    );
  });

  // Re-sync the form when the server data really changed (after saving, or a weight logged on another tab)
  useEffect(() => {
    setDraft(serverDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const calculated = calculateTargets({
    weight: num(draft.weight),
    height: num(draft.height),
    age: num(draft.age),
    gender: draft.gender,
    goal: draft.goal,
  });

  // While auto mode is on, the target fields show the formula result
  const effective: Draft =
    auto && calculated
      ? {
          ...draft,
          calories: String(calculated.calories),
          protein: String(calculated.protein),
          fat: String(calculated.fat),
          carbs: String(calculated.carbs),
        }
      : draft;

  const dirty = JSON.stringify(effective) !== serverKey;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const toggleAuto = (on: boolean) => {
    if (!on) setDraft(effective); // freeze the currently shown numbers for manual editing
    setAuto(on);
  };

  const save = async () => {
    const weight = num(effective.weight);
    const height = num(effective.height);
    const age = Math.round(num(effective.age));
    if (!weight || !height || !age || !num(effective.calories)) {
      hapticNotification('warning');
      toast({ kind: 'error', message: 'Заполните вес, рост, возраст и цель по калориям' });
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings.mutateAsync({
        goal: effective.goal,
        settings: {
          gender: effective.gender,
          weight,
          height,
          age,
          calorieTarget: Math.round(num(effective.calories)),
          proteinTarget: Math.round(num(effective.protein)),
          fatTarget: Math.round(num(effective.fat)),
          carbTarget: Math.round(num(effective.carbs)),
          waterTarget: Math.round(num(effective.water)) || 2000,
          darkMode: theme === 'dark',
        },
      });
      // A changed weight is a new measurement: keep it in the history too
      if (weight !== sync.settings.weight) {
        await weightLog.add.mutateAsync({ date: toDateStr(), weightKg: weight });
      }
      hapticNotification('success');
      toast({ message: 'Настройки сохранены' });
    } catch (e: any) {
      console.error(e);
      hapticNotification('error');
      toast({ kind: 'error', message: e.message || 'Не удалось сохранить настройки' });
    } finally {
      setIsSaving(false);
    }
  };

  const name = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || 'Пользователь';

  return (
    <Screen title="Настройки">
      <Group>
        <Row>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-title2 font-semibold text-white">
            {(tgUser?.first_name?.[0] ?? 'U').toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-headline font-semibold">{name}</span>
            {tgUser?.username && <span className="block text-footnote text-label2">@{tgUser.username}</span>}
          </span>
        </Row>
      </Group>

      <Group header="Оформление">
        <div className="p-3">
          <Segmented
            options={[
              { id: 'light', label: 'Светлая' },
              { id: 'dark', label: 'Тёмная' },
            ]}
            value={theme}
            onChange={setTheme}
          />
        </div>
      </Group>

      <Group header="Обо мне">
        <div className="p-3">
          <Segmented
            options={[
              { id: 'male', label: 'Мужчина' },
              { id: 'female', label: 'Женщина' },
            ]}
            value={draft.gender}
            onChange={(g) => set('gender', g)}
          />
        </div>
        <FieldRow label="Вес" value={draft.weight} onChange={(v) => set('weight', v)} unit="кг" placeholder="75" />
        <FieldRow label="Рост" value={draft.height} onChange={(v) => set('height', v)} unit="см" placeholder="178" />
        <FieldRow label="Возраст" value={draft.age} onChange={(v) => set('age', v)} unit="лет" placeholder="28" />
      </Group>

      <Group header="Цель" footer="Формула Миффлина — Сан-Жеора с коэффициентом лёгкой активности 1,375.">
        <div className="p-3">
          <Segmented options={GOALS.map((g) => ({ id: g.id, label: g.label }))} value={draft.goal} onChange={(g) => set('goal', g)} />
        </div>
        <Row title="Рассчитывать автоматически" trailing={<Switch checked={auto} onChange={toggleAuto} label="Автоматический расчёт" />} />
      </Group>

      <Group header="Дневные нормы">
        <FieldRow
          label="Калории"
          value={effective.calories}
          onChange={(v) => set('calories', v)}
          unit="ккал"
          disabled={auto}
        />
        <FieldRow label="Белки" value={effective.protein} onChange={(v) => set('protein', v)} unit="г" disabled={auto} />
        <FieldRow label="Жиры" value={effective.fat} onChange={(v) => set('fat', v)} unit="г" disabled={auto} />
        <FieldRow label="Углеводы" value={effective.carbs} onChange={(v) => set('carbs', v)} unit="г" disabled={auto} />
      </Group>

      <Group
        header="Вода"
        footer={calculated ? `Рекомендуем около ${suggestWaterTarget(num(draft.weight)).toLocaleString('ru-RU')} мл при вашем весе.` : undefined}
      >
        <FieldRow label="Норма в день" value={draft.water} onChange={(v) => set('water', v)} unit="мл" />
      </Group>

      <Button loading={isSaving} disabled={!dirty} onClick={save} className="mb-2">
        Сохранить
      </Button>
    </Screen>
  );
}
