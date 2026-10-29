'use client';

import React, { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import Segmented from '@/components/ui/Segmented';
import Button from '@/components/ui/Button';
import { FieldRow, Group } from '@/components/ui/Group';
import { GOALS, calculateTargets, type Gender, type Goal } from '@/lib/nutrition';

export interface OnboardingValues {
  gender: Gender;
  goal: Goal;
  weight: number;
  height: number;
  age: number;
}

interface OnboardingSheetProps {
  open: boolean;
  isSaving: boolean;
  onSubmit: (values: OnboardingValues) => void;
}

const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;

export default function OnboardingSheet({ open, isSaving, onSubmit }: OnboardingSheetProps) {
  const [gender, setGender] = useState<Gender>('male');
  const [goal, setGoal] = useState<Goal>('maintenance');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');

  const w = num(weight);
  const h = num(height);
  const a = Math.round(num(age));
  const valid = w >= 20 && w <= 400 && h >= 80 && h <= 250 && a >= 10 && a <= 100;

  const targets = calculateTargets({ weight: w, height: h, age: a, gender, goal });

  return (
    <Sheet
      open={open}
      onClose={() => {}}
      dismissible={false}
      tall
      title="Добро пожаловать"
      footer={
        <Button loading={isSaving} disabled={!valid} onClick={() => onSubmit({ gender, goal, weight: w, height: h, age: a })}>
          Начать
        </Button>
      }
    >
      <p className="mb-6 px-1 text-center text-callout text-label2">
        Укажите параметры — мы рассчитаем вашу дневную норму калорий и БЖУ.
      </p>

      <Group>
        <div className="p-3">
          <Segmented
            options={[
              { id: 'male', label: 'Мужчина' },
              { id: 'female', label: 'Женщина' },
            ]}
            value={gender}
            onChange={setGender}
          />
        </div>
        <FieldRow label="Вес" unit="кг" value={weight} onChange={setWeight} placeholder="75" />
        <FieldRow label="Рост" unit="см" value={height} onChange={setHeight} placeholder="178" />
        <FieldRow label="Возраст" unit="лет" value={age} onChange={setAge} placeholder="28" />
      </Group>

      <Group header="Ваша цель">
        <div className="p-3">
          <Segmented options={GOALS.map((g) => ({ id: g.id, label: g.label }))} value={goal} onChange={setGoal} />
        </div>
      </Group>

      <section className="rounded-2xl bg-card p-4 text-center">
        <p className="text-footnote uppercase tracking-wide text-label2">Ваша норма в день</p>
        {targets && valid ? (
          <>
            <p className="my-1 text-largetitle font-bold tabular">
              {targets.calories.toLocaleString('ru-RU')} <span className="text-headline font-normal text-label2">ккал</span>
            </p>
            <p className="text-subhead tabular text-label2">
              Б {targets.protein} · У {targets.carbs} · Ж {targets.fat} г
            </p>
          </>
        ) : (
          <p className="py-3 text-callout text-label2">Заполните вес, рост и возраст</p>
        )}
      </section>
    </Sheet>
  );
}
