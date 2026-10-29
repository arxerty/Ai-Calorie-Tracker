'use client';

import React, { useEffect, useRef } from 'react';
import { Camera, FileText, Image as ImageIcon, Keyboard, Mic, Plus, ScanLine, Star } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import Sheet from '@/components/ui/Sheet';
import Segmented from '@/components/ui/Segmented';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Group, Row } from '@/components/ui/Group';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { MEAL_TYPES, type MealType } from '@/lib/nutrition';
import type { Favorite, QuickFood } from '@/lib/types';

export type InputMode = 'text' | 'manual' | 'barcode';

interface AddFoodSheetProps {
  open: boolean;
  onClose: () => void;
  mealType: MealType;
  onMealTypeChange: (meal: MealType) => void;
  favorites: Favorite[];
  recent: QuickFood[];
  onPickImage: (file: File) => void;
  onVoice: (audio: Blob) => void;
  onOpenInput: (mode: InputMode) => void;
  onQuickAdd: (food: QuickFood) => void;
}

const mealOptions = MEAL_TYPES.map((m) => ({ id: m.id, label: m.label }));

export default function AddFoodSheet({
  open,
  onClose,
  mealType,
  onMealTypeChange,
  favorites,
  recent,
  onPickImage,
  onVoice,
  onOpenInput,
  onQuickAdd,
}: AddFoodSheetProps) {
  const { hapticImpact } = useTma();
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const voice = useVoiceRecorder({
    onFinish: (audio) => {
      onClose();
      onVoice(audio);
    },
    onError: (message) => toast({ kind: 'error', message }),
  });

  // Never leave the microphone on when the sheet is dismissed
  useEffect(() => {
    if (!open && voice.isRecording) voice.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      onClose();
      onPickImage(file);
    }
  };

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => {
    hapticImpact('light');
    ref.current?.click();
  };

  const open_ = (mode: InputMode) => {
    hapticImpact('light');
    onClose();
    onOpenInput(mode);
  };

  const favoriteNames = new Set(favorites.map((f) => f.name.trim().toLowerCase()));
  const recentOnly = recent.filter((r) => !favoriteNames.has(r.name.trim().toLowerCase()));

  const quickRow = (food: QuickFood, key: string, icon: React.ReactNode) => (
    <Row key={key} onClick={() => onQuickAdd(food)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-label3">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-body">{food.name}</span>
        <span className="block text-footnote tabular text-label2">
          {Math.round(food.calories)} ккал · {Math.round(food.weightG)} г
        </span>
      </span>
      <Plus size={22} className="shrink-0 text-accent" strokeWidth={2.4} />
    </Row>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Добавить еду">
      <Segmented options={mealOptions} value={mealType} onChange={onMealTypeChange} className="mb-4" />

      {voice.isRecording ? (
        <div className="mb-6 rounded-2xl bg-card px-4 py-8 text-center">
          <span
            className="mx-auto mb-3 block h-4 w-4 rounded-full bg-danger"
            style={{ animation: 'pulse-dot 1.2s ease-in-out infinite' }}
          />
          <p className="mb-1 text-title2 font-semibold tabular">
            {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
          </p>
          <p className="mb-5 text-subhead text-label2">Скажите, например: «съел куриную грудку с рисом»</p>
          <div className="flex gap-2">
            <Button variant="gray" onClick={voice.cancel}>
              Отмена
            </Button>
            <Button onClick={voice.stop}>Готово</Button>
          </div>
        </div>
      ) : (
        <Group>
          <Row icon={<Camera size={18} />} iconBg="var(--accent)" title="Сфотографировать" chevron onClick={() => pick(cameraRef)} />
          <Row icon={<ImageIcon size={18} />} iconBg="var(--green)" title="Выбрать из галереи" chevron onClick={() => pick(galleryRef)} />
          <Row icon={<Mic size={18} />} iconBg="var(--red)" title="Наговорить голосом" chevron onClick={() => { hapticImpact('medium'); voice.start(); }} />
          <Row icon={<FileText size={18} />} iconBg="var(--orange)" title="Описать текстом" chevron onClick={() => open_('text')} />
          <Row icon={<Keyboard size={18} />} iconBg="var(--indigo)" title="Название и вес" chevron onClick={() => open_('manual')} />
          <Row icon={<ScanLine size={18} />} iconBg="var(--teal)" title="Штрихкод" chevron onClick={() => open_('barcode')} />
        </Group>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {favorites.length > 0 && (
        <Group header="Избранное">
          {favorites.map((f) => quickRow(f, f.id, <Star size={18} className="fill-orange text-orange" />))}
        </Group>
      )}

      {recentOnly.length > 0 && (
        <Group header="Недавние">{recentOnly.map((r, i) => quickRow(r, `r-${i}`, <span className="text-lg">🕘</span>))}</Group>
      )}
    </Sheet>
  );
}
