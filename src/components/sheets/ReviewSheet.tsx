'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Apple, Heart, Minus, Plus } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import Sheet from '@/components/ui/Sheet';
import Segmented from '@/components/ui/Segmented';
import Switch from '@/components/ui/Switch';
import Button from '@/components/ui/Button';
import { FieldRow, Group, Row } from '@/components/ui/Group';
import { Bar } from '@/components/charts';
import type { IngestResult } from '@/hooks/use-food-ingest';
import { MEAL_TYPES, healthScore, type MealType } from '@/lib/nutrition';
import type { NewFood } from '@/lib/types';

interface ReviewSheetProps {
  result: IngestResult | null;
  mealType: MealType;
  onMealTypeChange: (meal: MealType) => void;
  onClose: () => void;
  onSave: (food: Omit<NewFood, 'mealType' | 'date'>, saveToFavorites: boolean) => Promise<void>;
}

type Field = 'calories' | 'protein' | 'fat' | 'carbs';

const mealOptions = MEAL_TYPES.map((m) => ({ id: m.id, label: m.label }));
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(round1(n)).replace('.', ',');

export default function ReviewSheet({ result, mealType, onMealTypeChange, onClose, onSave }: ReviewSheetProps) {
  const { hapticImpact, hapticNotification, hapticSelectionChange } = useTma();

  const [name, setName] = useState('');
  const [portion, setPortion] = useState(1);
  // Values the user typed by hand win over the proportional ones until the portion changes
  const [overrides, setOverrides] = useState<Partial<Record<Field, number>>>({});
  // Raw text of the field being typed in, so a half-erased number doesn't snap back
  const [editText, setEditText] = useState<Partial<Record<Field | 'weight', string>>>({});
  const [showEditor, setShowEditor] = useState(false);
  const [saveFavorite, setSaveFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Keep the last result while the sheet animates out
  const [shown, setShown] = useState<IngestResult | null>(result);
  useEffect(() => {
    if (!result) return;
    setShown(result);
    setName(result.analysis.dish_name);
    setPortion(1);
    setOverrides({});
    setEditText({});
    setShowEditor(false);
    setSaveFavorite(false);
  }, [result]);

  const data = result ?? shown;
  if (!data) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const a = data.analysis;
  const base = { calories: a.calories, protein: a.protein_g, fat: a.fat_g, carbs: a.carbs_g };
  const value = (f: Field) => overrides[f] ?? round1(base[f] * portion);
  const weight = Math.round(a.weight_g * portion);

  const calories = Math.round(value('calories'));
  const score = healthScore(calories, value('protein'), value('fat'));
  const isFallback = a.ai_notes.startsWith('⚠️');
  const mealLabel = MEAL_TYPES.find((m) => m.id === mealType)!.label.toLowerCase();

  const changePortion = (next: number) => {
    if (next < 0.25 || next > 10) return;
    hapticSelectionChange();
    setPortion(next);
    setOverrides({});
    setEditText({});
  };

  const changeWeight = (text: string) => {
    setEditText({ weight: text });
    const w = parseFloat(text.replace(',', '.'));
    if (w > 0 && a.weight_g > 0) {
      setPortion(Math.min(10, Math.max(0.05, w / a.weight_g)));
      setOverrides({});
    }
  };

  const setField = (f: Field, text: string) => {
    setEditText((t) => ({ ...t, [f]: text }));
    const n = parseFloat(text.replace(',', '.'));
    setOverrides((o) => ({ ...o, [f]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };

  const fieldText = (f: Field | 'weight', computed: number) => editText[f] ?? String(computed);

  const save = async () => {
    hapticImpact('medium');
    setIsSaving(true);
    try {
      await onSave(
        {
          name: name.trim() || a.dish_name || 'Блюдо',
          weightG: Math.max(1, weight),
          calories,
          proteinG: value('protein'),
          fatG: value('fat'),
          carbsG: value('carbs'),
          photoId: data.photoId,
        },
        saveFavorite
      );
      hapticNotification('success');
    } catch (e) {
      console.error(e);
      hapticNotification('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      open={result !== null}
      onClose={onClose}
      title="Проверьте результат"
      tall
      footer={
        <Button loading={isSaving} onClick={save}>
          Добавить в «{mealLabel}»
        </Button>
      }
    >
      {data.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.photoUrl} alt={name} className="mb-4 h-48 w-full rounded-2xl object-cover" />
      ) : null}

      {isFallback && (
        <div className="mb-4 flex gap-3 rounded-2xl bg-orange/15 p-4 text-subhead">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-orange" />
          <p>ИИ сейчас недоступен, поэтому значения примерные. Поправьте их вручную или попробуйте позже.</p>
        </div>
      )}

      <Group footer={isFallback ? undefined : `Определено ИИ · точность ${Math.round(a.confidence * 100)}%`}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Название блюда"
          className="w-full bg-transparent px-4 py-3 text-title2 font-semibold outline-none"
        />
      </Group>

      <Group>
        <Row>
          <span className="flex-1 text-body">Порция</span>
          <div className="flex items-center gap-1 rounded-full bg-fill p-0.5">
            <button
              type="button"
              aria-label="Меньше"
              onClick={() => changePortion(portion - 0.25)}
              className="pressable flex h-8 w-9 items-center justify-center rounded-full text-accent"
            >
              <Minus size={18} strokeWidth={2.6} />
            </button>
            <span className="min-w-[44px] text-center text-subhead font-semibold tabular">{String(round1(portion)).replace('.', ',')}×</span>
            <button
              type="button"
              aria-label="Больше"
              onClick={() => changePortion(portion + 0.25)}
              className="pressable flex h-8 w-9 items-center justify-center rounded-full text-accent"
            >
              <Plus size={18} strokeWidth={2.6} />
            </button>
          </div>
        </Row>
        <Row title="Вес" value={`${weight} г`} />
      </Group>

      <section className="mb-6 rounded-2xl bg-card p-4">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-footnote font-medium uppercase tracking-wide text-label2">Калории</span>
          <span className="text-largetitle font-bold tabular">
            {calories.toLocaleString('ru-RU')} <span className="text-headline font-normal text-label2">ккал</span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t-[0.5px] border-separator pt-4 text-center">
          {[
            { label: 'Белки', v: value('protein'), color: 'var(--protein)' },
            { label: 'Углеводы', v: value('carbs'), color: 'var(--carbs)' },
            { label: 'Жиры', v: value('fat'), color: 'var(--fat)' },
          ].map((m) => (
            <div key={m.label}>
              <p className="text-footnote font-medium" style={{ color: m.color }}>
                {m.label}
              </p>
              <p className="text-headline font-semibold tabular">{fmt(m.v)} г</p>
            </div>
          ))}
        </div>
      </section>

      <Group>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-subhead font-medium">
              <Heart size={16} className="fill-danger text-danger" /> Оценка пользы
            </span>
            <span className="text-subhead font-semibold tabular">{score} / 10</span>
          </div>
          <Bar value={score} max={10} color={score >= 7 ? 'var(--green)' : score >= 5 ? 'var(--orange)' : 'var(--red)'} />
        </div>
      </Group>

      <Group header="Приём пищи">
        <div className="p-3">
          <Segmented options={mealOptions} value={mealType} onChange={onMealTypeChange} />
        </div>
      </Group>

      <Group>
        <Row title="Добавить в избранное" trailing={<Switch checked={saveFavorite} onChange={setSaveFavorite} label="Добавить в избранное" />} />
        <Row title={showEditor ? 'Скрыть точные значения' : 'Изменить значения'} chevron={!showEditor} onClick={() => setShowEditor((s) => !s)} />
      </Group>

      {showEditor && (
        <Group header="Точные значения">
          <FieldRow label="Вес" unit="г" value={fieldText('weight', weight)} onChange={changeWeight} />
          <FieldRow label="Калории" unit="ккал" value={fieldText('calories', calories)} onChange={(t) => setField('calories', t)} />
          <FieldRow label="Белки" unit="г" value={fieldText('protein', value('protein'))} onChange={(t) => setField('protein', t)} />
          <FieldRow label="Углеводы" unit="г" value={fieldText('carbs', value('carbs'))} onChange={(t) => setField('carbs', t)} />
          <FieldRow label="Жиры" unit="г" value={fieldText('fat', value('fat'))} onChange={(t) => setField('fat', t)} />
        </Group>
      )}

      {a.ingredients.length > 0 && !isFallback && (
        <Group header="Ингредиенты">
          <div className="flex flex-wrap gap-2 p-4">
            {a.ingredients.map((ing, i) => (
              <span key={i} className="rounded-full bg-fill px-3 py-1 text-subhead">
                {ing}
              </span>
            ))}
          </div>
        </Group>
      )}

      {a.ai_notes && !isFallback && (
        <Group header="Совет диетолога">
          <div className="flex gap-3 p-4">
            <Apple size={20} className="mt-0.5 shrink-0 text-success" />
            <p className="text-callout text-label2">{a.ai_notes}</p>
          </div>
        </Group>
      )}
    </Sheet>
  );
}
