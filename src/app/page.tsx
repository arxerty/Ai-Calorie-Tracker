'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Settings, Sparkles, TrendingUp, Utensils } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import TabBar, { type TabItem } from '@/components/ui/TabBar';
import Button, { Spinner } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import TodayScreen from '@/components/screens/TodayScreen';
import ProgressScreen from '@/components/screens/ProgressScreen';
import CoachScreen from '@/components/screens/CoachScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import AddFoodSheet, { type InputMode } from '@/components/sheets/AddFoodSheet';
import TextEntrySheet from '@/components/sheets/TextEntrySheet';
import ReviewSheet from '@/components/sheets/ReviewSheet';
import EntrySheet from '@/components/sheets/EntrySheet';
import OnboardingSheet, { type OnboardingValues } from '@/components/sheets/OnboardingSheet';
import { useFoodIngest } from '@/hooks/use-food-ingest';
import { useDayLog, useFavorites, useFoodMutations, useSync, useUpdateSettings, useWeight } from '@/hooks/use-app-data';
import { defaultMealType, suggestWaterTarget, type MealType } from '@/lib/nutrition';
import { toDateStr } from '@/lib/date';
import type { FoodItem, NewFood, QuickFood } from '@/lib/types';

type Tab = 'today' | 'progress' | 'coach' | 'settings';

const TABS: TabItem<Tab>[] = [
  { id: 'today', label: 'Сегодня', icon: Utensils },
  { id: 'progress', label: 'Прогресс', icon: TrendingUp },
  { id: 'coach', label: 'Диетолог', icon: Sparkles },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

/** Today's date in the user's timezone, kept fresh when the app is reopened after midnight. */
function useToday() {
  const [today, setToday] = useState(() => toDateStr());
  useEffect(() => {
    const refresh = () => setToday(toDateStr());
    document.addEventListener('visibilitychange', refresh);
    const id = setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(id);
    };
  }, []);
  return today;
}

export default function App() {
  const { hapticImpact, hapticNotification } = useTma();
  const toast = useToast();

  const { data: sync, isError, refetch } = useSync();
  const ready = !!sync;

  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const prevToday = useRef(today);
  useEffect(() => {
    // The day rolled over while the app was open on "today": follow it
    if (selectedDate === prevToday.current) setSelectedDate(today);
    prevToday.current = today;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const [tab, setTab] = useState<Tab>('today');
  const [addOpen, setAddOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<MealType>(() => defaultMealType());
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);

  const ingest = useFoodIngest();
  const food = useFoodMutations();
  const favorites = useFavorites(ready);
  const dayLog = useDayLog(selectedDate, ready);
  const updateSettings = useUpdateSettings();
  const weightLog = useWeight(false);

  const entry: FoodItem | null = dayLog.data?.find((i) => i.id === entryId) ?? null;

  // ---- adding food

  const openAdd = (meal?: MealType) => {
    setAddMeal(meal ?? defaultMealType());
    setAddOpen(true);
  };

  const addAndNotify = async (item: NewFood) => {
    try {
      const res = await food.add.mutateAsync({ ...item, date: selectedDate });
      hapticNotification('success');
      toast({
        message: `«${item.name}» добавлено`,
        action: { label: 'Отменить', onClick: () => food.remove.mutate(res.foodItem.id) },
      });
    } catch (e: any) {
      hapticNotification('error');
      toast({ kind: 'error', message: e.message || 'Не удалось сохранить' });
      throw e;
    }
  };

  const saveReviewed = async (item: Omit<NewFood, 'mealType' | 'date'>, saveToFavorites: boolean) => {
    await addAndNotify({ ...item, mealType: addMeal });
    if (saveToFavorites) {
      favorites.add.mutate({
        name: item.name,
        weightG: item.weightG,
        calories: item.calories,
        proteinG: item.proteinG,
        fatG: item.fatG,
        carbsG: item.carbsG,
      });
    }
    ingest.clear();
  };

  const quickAdd = (item: QuickFood) => {
    setAddOpen(false);
    addAndNotify({ ...item, mealType: addMeal }).catch(() => {});
  };

  const openInput = (mode: InputMode) => {
    const webapp = (window as any).Telegram?.WebApp;
    if (mode === 'barcode' && typeof webapp?.showScanQrPopup === 'function') {
      webapp.showScanQrPopup({ text: 'Отсканируйте штрих-код продукта' }, (result: string) => {
        if (!result) return;
        webapp.closeScanQrPopup();
        ingest.analyzeBarcode(result);
      });
      return;
    }
    setInputMode(mode);
  };

  // ---- onboarding

  const finishOnboarding = async (v: OnboardingValues) => {
    hapticImpact('medium');
    setIsOnboarding(true);
    try {
      await updateSettings.mutateAsync({
        goal: v.goal,
        settings: {
          isOnboarded: true,
          gender: v.gender,
          weight: v.weight,
          height: v.height,
          age: v.age,
          waterTarget: suggestWaterTarget(v.weight),
        },
      });
      await weightLog.add.mutateAsync({ date: toDateStr(), weightKg: v.weight });
      hapticNotification('success');
    } catch (e: any) {
      hapticNotification('error');
      toast({ kind: 'error', message: e.message || 'Не удалось сохранить данные' });
    } finally {
      setIsOnboarding(false);
    }
  };

  // ---- loading / error shells

  if (isError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-headline font-semibold">Не удалось загрузить данные</p>
        <p className="text-callout text-label2">Проверьте соединение и попробуйте ещё раз.</p>
        <Button size="md" onClick={() => refetch()}>
          Повторить
        </Button>
      </main>
    );
  }

  if (!sync) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-label2">
        <Spinner className="h-8 w-8" />
      </main>
    );
  }

  return (
    <>
      {tab === 'today' && (
        <TodayScreen
          sync={sync}
          selectedDate={selectedDate}
          today={today}
          onSelectDate={setSelectedDate}
          onAdd={openAdd}
          onOpenEntry={(item) => setEntryId(item.id)}
          onOpenProgress={() => setTab('progress')}
        />
      )}
      {tab === 'progress' && <ProgressScreen sync={sync} today={today} />}
      {tab === 'coach' && <CoachScreen />}
      {tab === 'settings' && <SettingsScreen sync={sync} />}

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <AddFoodSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mealType={addMeal}
        onMealTypeChange={setAddMeal}
        favorites={favorites.favorites}
        recent={favorites.recent}
        onPickImage={ingest.analyzeImage}
        onVoice={ingest.analyzeVoice}
        onOpenInput={openInput}
        onQuickAdd={quickAdd}
      />

      <TextEntrySheet
        mode={inputMode}
        onClose={() => setInputMode(null)}
        onText={ingest.analyzeText}
        onBarcode={ingest.analyzeBarcode}
      />

      <ReviewSheet
        result={ingest.result}
        mealType={addMeal}
        onMealTypeChange={setAddMeal}
        onClose={ingest.clear}
        onSave={saveReviewed}
      />

      <EntrySheet
        item={entry}
        onClose={() => setEntryId(null)}
        favorites={favorites.favorites}
        onChangeMeal={(id, meal) => food.patch.mutate({ id, mealType: meal })}
        onScale={(id, scale) => food.patch.mutate({ id, scale })}
        onToggleFavorite={(item, existing) => (existing ? favorites.remove.mutate(existing.id) : favorites.add.mutate(item))}
        onDelete={(item) => {
          food.remove.mutate(item.id);
          setEntryId(null);
          hapticNotification('success');
          toast({ message: `«${item.name}» удалено` });
        }}
      />

      <OnboardingSheet open={!sync.settings.isOnboarded} isSaving={isOnboarding} onSubmit={finishOnboarding} />

      {ingest.isAnalyzing && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'var(--overlay)' }}
          role="alert"
          aria-busy="true"
        >
          <div className="material flex flex-col items-center gap-3 rounded-3xl px-8 py-6 shadow-2xl">
            <Spinner className="h-8 w-8 text-accent" />
            <p className="text-subhead font-medium">Распознаём…</p>
          </div>
        </div>
      )}
    </>
  );
}
