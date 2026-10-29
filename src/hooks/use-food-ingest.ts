'use client';

import { useCallback, useState } from 'react';
import { useTma } from '@/components/tma-provider';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/hooks/use-app-data';
import type { FoodAnalysis } from '@/lib/types';

export interface IngestResult {
  analysis: FoodAnalysis;
  photoId?: string;
  photoUrl?: string | null;
}

const MAX_IMAGE_SIDE = 1280;

/** Downscales big phone photos before upload (3–12 MB → ~200 KB). Falls back to the original file. */
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/**
 * One pipeline for every way of adding food (photo, text, manual, voice, barcode):
 * send to /api/analyze, hold the AI result until the user confirms it in the review sheet.
 */
export function useFoodIngest() {
  const api = useApi();
  const toast = useToast();
  const { hapticImpact, hapticNotification } = useTma();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const run = useCallback(
    async (form: FormData, failMessage: string) => {
      hapticImpact('medium');
      setIsAnalyzing(true);
      try {
        const data = await api<{ analysis: FoodAnalysis; photoId?: string; photoUrl?: string | null }>('/api/analyze', {
          method: 'POST',
          body: form,
        });
        setResult({ analysis: data.analysis, photoId: data.photoId, photoUrl: data.photoUrl });
      } catch (e: any) {
        console.error(e);
        hapticNotification('error');
        toast({ kind: 'error', message: `${failMessage}: ${e.message}` });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [api, toast, hapticImpact, hapticNotification]
  );

  const analyzeImage = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append('image', await shrinkImage(file));
      return run(form, 'Не удалось распознать еду');
    },
    [run]
  );

  const analyzeText = useCallback(
    (text: string) => {
      const form = new FormData();
      form.append('text', text);
      return run(form, 'Не удалось распознать описание');
    },
    [run]
  );

  const analyzeVoice = useCallback(
    (audio: Blob) => {
      const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('voice', audio, `voice-recording.${ext}`);
      return run(form, 'Не удалось расшифровать голос');
    },
    [run]
  );

  const analyzeBarcode = useCallback(
    (barcode: string) => {
      const form = new FormData();
      form.append('text', `Штрихкод продукта: ${barcode}. Найди этот продукт и дай КБЖУ на 100 грамм.`);
      return run(form, 'Не удалось распознать штрихкод');
    },
    [run]
  );

  const clear = useCallback(() => setResult(null), []);

  return { isAnalyzing, result, clear, analyzeImage, analyzeText, analyzeVoice, analyzeBarcode };
}
