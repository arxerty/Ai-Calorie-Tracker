'use client';

import React, { useEffect, useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import { FieldRow, Group } from '@/components/ui/Group';
import type { InputMode } from '@/components/sheets/AddFoodSheet';

interface TextEntrySheetProps {
  mode: InputMode | null;
  onClose: () => void;
  onText: (text: string) => void;
  onBarcode: (code: string) => void;
}

const TITLES: Record<InputMode, string> = {
  text: 'Описать текстом',
  manual: 'Название и вес',
  barcode: 'Штрихкод',
};

/** One sheet for the three keyboard-driven ways to log food. */
export default function TextEntrySheet({ mode, onClose, onText, onBarcode }: TextEntrySheetProps) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [barcode, setBarcode] = useState('');

  // Fresh form each time the sheet opens
  useEffect(() => {
    if (mode) {
      setText('');
      setName('');
      setWeight('');
      setBarcode('');
    }
  }, [mode]);

  const weightNum = parseFloat(weight.replace(',', '.'));
  const valid =
    mode === 'text' ? text.trim().length > 0 : mode === 'manual' ? name.trim().length > 0 && weightNum > 0 : /^\d{6,14}$/.test(barcode.trim());

  const submit = () => {
    if (!valid) return;
    onClose();
    if (mode === 'text') onText(text.trim());
    else if (mode === 'manual') onText(`${name.trim()}, ${weightNum} грамм`);
    else onBarcode(barcode.trim());
  };

  return (
    <Sheet
      open={mode !== null}
      onClose={onClose}
      title={mode ? TITLES[mode] : undefined}
      footer={
        <Button disabled={!valid} onClick={submit}>
          Рассчитать КБЖУ
        </Button>
      }
    >
      {mode === 'text' && (
        <Group footer="ИИ оценит вес порции и КБЖУ. Чем точнее описание, тем лучше результат.">
          <textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: омлет из двух яиц с сыром и тост с маслом"
            className="w-full resize-none bg-transparent p-4 text-body outline-none"
          />
        </Group>
      )}

      {mode === 'manual' && (
        <Group footer="КБЖУ рассчитает ИИ по названию и весу.">
          <FieldRow label="Название" value={name} onChange={setName} type="text" placeholder="Гречка варёная" wide />
          <FieldRow label="Вес" value={weight} onChange={setWeight} unit="г" placeholder="200" />
        </Group>
      )}

      {mode === 'barcode' && (
        <Group footer="Введите цифры под штрихкодом. Значения рассчитает ИИ, поэтому проверьте результат перед сохранением.">
          <input
            autoFocus
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
            placeholder="4600682120021"
            className="w-full bg-transparent p-4 text-body tabular outline-none"
          />
        </Group>
      )}
    </Sheet>
  );
}
