'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTma } from './tma-provider';
import { X, Check, Flame, Moon, Sun, Scale, ToggleLeft, ToggleRight } from 'lucide-react';

interface UserSettings {
  preferredAiProvider: string;
  darkMode: boolean;
  calorieTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbTarget: number;
  weight?: number | null;
  height?: number | null;
  age?: number | null;
  gender?: string | null;
}

interface GoalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoal: string;
  currentSettings: UserSettings | null;
  onSave: (goal: string, settings: any) => Promise<void>;
}

export default function GoalSettingsModal({
  isOpen,
  onClose,
  currentGoal,
  currentSettings,
  onSave,
}: GoalSettingsModalProps) {
  const { theme, setTheme, hapticImpact, hapticNotification, hapticSelectionChange } = useTma();
  
  const [goal, setGoal] = useState('maintenance');
  const [calories, setCalories] = useState(2000);
  const [protein, setProtein] = useState(130);
  const [fat, setFat] = useState(70);
  const [carbs, setCarbs] = useState(210);
  
  // Physical stats
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  
  // Toggle auto-recalculation
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (currentGoal) setGoal(currentGoal);
    if (currentSettings) {
      setCalories(currentSettings.calorieTarget);
      setProtein(currentSettings.proteinTarget);
      setFat(currentSettings.fatTarget);
      setCarbs(currentSettings.carbTarget);
      setWeight(currentSettings.weight ? String(currentSettings.weight) : '');
      setHeight(currentSettings.height ? String(currentSettings.height) : '');
      setAge(currentSettings.age ? String(currentSettings.age) : '');
      setGender((currentSettings.gender as 'male' | 'female') || 'male');
    }
  }, [currentGoal, currentSettings]);

  // Recalculate targets in real-time if autoCalculate is active (Mifflin-St Jeor)
  useEffect(() => {
    if (!autoCalculate) return;
    
    const wNum = parseFloat(weight);
    const hNum = parseFloat(height);
    const aNum = parseInt(age, 10);
    
    if (wNum && hNum && aNum) {
      let bmr = 0;
      if (gender === 'male') {
        bmr = 10 * wNum + 6.25 * hNum - 5 * aNum + 5;
      } else {
        bmr = 10 * wNum + 6.25 * hNum - 5 * aNum - 161;
      }
      
      const tdee = bmr * 1.375;
      let cTarget = Math.round(tdee);
      const minCals = gender === 'male' ? 1500 : 1200;

      if (goal === 'weight_loss') {
        cTarget = Math.max(minCals, Math.round(tdee - 500));
      } else if (goal === 'muscle_gain') {
        cTarget = Math.round(tdee + 300);
      }
      
      const pTarget = Math.round((goal === 'maintenance' ? 1.6 : 2.0) * wNum);
      const fTarget = Math.round(0.9 * wNum);
      const remainingCals = cTarget - (pTarget * 4) - (fTarget * 9);
      const cbTarget = Math.max(50, Math.round(remainingCals / 4));

      setCalories(cTarget);
      setProtein(pTarget);
      setFat(fTarget);
      setCarbs(cbTarget);
    }
  }, [weight, height, age, gender, goal, autoCalculate]);

  if (!currentSettings) return null;

  const handleGoalChange = (newGoal: string) => {
    setGoal(newGoal);
    hapticImpact('light');
  };

  const handleSave = async () => {
    hapticImpact('medium');
    setIsSaving(true);
    try {
      const wNum = parseFloat(weight);
      const hNum = parseFloat(height);
      const aNum = parseInt(age, 10);

      await onSave(goal, {
        preferredAiProvider: 'gemini',
        darkMode: theme === 'dark',
        calorieTarget: calories,
        proteinTarget: protein,
        fatTarget: fat,
        carbTarget: carbs,
        weight: wNum || null,
        height: hNum || null,
        age: aNum || null,
        gender: gender,
      });
      hapticNotification('success');
      onClose();
    } catch (e) {
      console.error(e);
      hapticNotification('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="absolute inset-0" onClick={onClose} />

          {/* Centered Modal Dialogue Card - Premium Liquid Glass styling */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative z-10 w-full max-w-[350px] rounded-[2rem] border border-[var(--border-color)] bg-[var(--container-bg)] p-6 shadow-2xl backdrop-blur-[32px] focus:outline-none text-[var(--foreground)]"
            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.12), 0 12px 40px rgba(0,0,0,0.5)' }}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Настройки App Ai</h3>
                <p className="text-[10px] text-[var(--text-secondary)]">Фитнес цели и физические параметры</p>
              </div>
              <button
                onClick={() => {
                  hapticImpact('light');
                  onClose();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-color)] bg-white/5 dark:bg-black/20 text-[var(--text-secondary)] active:scale-95 transition-transform"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[62vh] pr-1">
              
              {/* Theme Segment Switcher with sliding pill control (Requirement 3 theme toggle) */}
              <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--border-color)] bg-white/5 dark:bg-black/20 p-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] block text-left">Тема оформления</span>
                <div className="relative flex rounded-full bg-black/5 dark:bg-black/45 border border-[var(--border-color)] p-0.5 h-8 items-center mt-1">
                  
                  {/* Sliding active indicator block */}
                  <motion.div
                    layoutId="themePill"
                    className="absolute inset-y-0.5 rounded-full bg-[var(--accent-color)] shadow-md w-[48%]"
                    style={{
                      left: theme === 'light' ? '2%' : '50%'
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setTheme('light');
                    }}
                    className={`relative z-10 flex flex-1 items-center justify-center gap-1 py-1 text-[11px] font-bold transition-colors duration-200 ${
                      theme === 'light' ? 'text-[var(--background)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <Sun size={11} className={theme === 'light' ? 'text-yellow-500 fill-yellow-500/20' : ''} />
                    <span>Светлая</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setTheme('dark');
                    }}
                    className={`relative z-10 flex flex-1 items-center justify-center gap-1 py-1 text-[11px] font-bold transition-colors duration-200 ${
                      theme === 'dark' ? 'text-[var(--background)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <Moon size={11} className={theme === 'dark' ? 'text-indigo-400 fill-indigo-400/20' : ''} />
                    <span>Темная</span>
                  </button>
                </div>
              </div>

              {/* Physical Profile Parameters */}
              <div className="space-y-3 rounded-2xl border border-[var(--border-color)] bg-white/5 dark:bg-black/20 p-3.5">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  <Scale size={11} />
                  Мои параметры
                </span>
                
                {/* Gender selection */}
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                  {['male', 'female'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setGender(g as any);
                        hapticImpact('light');
                      }}
                      className={`rounded-xl border py-2 text-[11px] font-bold transition-all ${
                        gender === g
                          ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--background)]'
                          : 'border-[var(--border-color)] bg-black/5 dark:bg-black/35 text-[var(--text-secondary)]'
                      }`}
                    >
                      {g === 'male' ? 'Мужчина' : 'Женщина'}
                    </button>
                  ))}
                </div>

                {/* Weight, Height, Age */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-[var(--text-secondary)] font-semibold">Вес (кг)</label>
                    <input
                      type="number"
                      placeholder="80"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full h-8 rounded-xl border border-[var(--border-color)] bg-black/5 dark:bg-black/35 p-2 text-center text-xs font-bold outline-none focus:border-[var(--accent-color)] select-text"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-[var(--text-secondary)] font-semibold">Рост (см)</label>
                    <input
                      type="number"
                      placeholder="180"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full h-8 rounded-xl border border-[var(--border-color)] bg-black/5 dark:bg-black/35 p-2 text-center text-xs font-bold outline-none focus:border-[var(--accent-color)] select-text"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-[var(--text-secondary)] font-semibold">Возраст</label>
                    <input
                      type="number"
                      placeholder="25"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full h-8 rounded-xl border border-[var(--border-color)] bg-black/5 dark:bg-black/35 p-2 text-center text-xs font-bold outline-none focus:border-[var(--accent-color)] select-text"
                    />
                  </div>
                </div>
              </div>

              {/* Goal Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Фитнес цель</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'weight_loss', label: 'Похудение' },
                    { id: 'maintenance', label: 'Поддержание' },
                    { id: 'muscle_gain', label: 'Набор массы' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleGoalChange(g.id)}
                      className={`rounded-xl border py-2.5 text-[10px] font-bold transition-all ${
                        goal === g.id
                          ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--background)]'
                          : 'border-[var(--border-color)] bg-black/5 dark:bg-black/35 text-[var(--text-secondary)]'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lock Auto Calc Switch */}
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] bg-white/5 dark:bg-black/20 p-3">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold">Авто-расчет по формуле</span>
                  <span className="text-[9px] text-[var(--text-secondary)]">Расчет Mifflin-St Jeor</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact('light');
                    setAutoCalculate(!autoCalculate);
                  }}
                  className="text-[var(--accent-color)] active:scale-90 transition-transform"
                >
                  {autoCalculate ? (
                    <ToggleRight size={26} className="text-emerald-500 fill-emerald-500/10" />
                  ) : (
                    <ToggleLeft size={26} className="text-[var(--text-secondary)]" />
                  )}
                </button>
              </div>

              {/* Real-time target editor boxes */}
              <div className="space-y-3 rounded-2xl border border-[var(--border-color)] bg-white/5 dark:bg-black/20 p-3.5">
                
                {/* Calories target */}
                <div className="flex items-center justify-between h-8">
                  <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold">
                    <Flame size={12} className="text-orange-500" />
                    Цель калорий
                  </span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      value={calories}
                      disabled={autoCalculate}
                      readOnly={autoCalculate}
                      onChange={(e) => setCalories(parseInt(e.target.value, 10) || 0)}
                      className={`w-16 h-8 bg-transparent text-right font-mono text-xs font-bold outline-none select-text ${
                        autoCalculate ? 'opacity-65 text-[var(--text-secondary)] cursor-not-allowed' : 'text-[var(--foreground)] border-b border-[var(--border-color)]'
                      }`}
                    />
                    <span className="text-[10px] text-[var(--text-secondary)]">ккал</span>
                  </div>
                </div>

                <div className="h-px bg-[var(--border-color)]" />

                {/* Macro Target input capsules */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  
                  {/* Protein */}
                  <div className="bg-black/5 dark:bg-black/35 rounded-xl p-2 border border-[var(--border-color)]">
                    <label className="text-[9px] uppercase text-[var(--text-secondary)] font-bold block">Белки</label>
                    <div className="mt-1 flex items-center justify-center gap-0.5 h-7">
                      <input
                        type="number"
                        value={protein}
                        disabled={autoCalculate}
                        readOnly={autoCalculate}
                        onChange={(e) => setProtein(parseInt(e.target.value, 10) || 0)}
                        className={`w-14 h-7 text-center bg-transparent font-mono text-xs font-bold outline-none select-text py-0.5 ${
                          autoCalculate ? 'opacity-65 text-[var(--text-secondary)] cursor-not-allowed' : 'text-[var(--foreground)]'
                        }`}
                      />
                      <span className="text-[9px] text-[var(--text-secondary)] font-bold">г</span>
                    </div>
                  </div>

                  {/* Fats */}
                  <div className="bg-black/5 dark:bg-black/35 rounded-xl p-2 border border-[var(--border-color)]">
                    <label className="text-[9px] uppercase text-[var(--text-secondary)] font-bold block">Жиры</label>
                    <div className="mt-1 flex items-center justify-center gap-0.5 h-7">
                      <input
                        type="number"
                        value={fat}
                        disabled={autoCalculate}
                        readOnly={autoCalculate}
                        onChange={(e) => setFat(parseInt(e.target.value, 10) || 0)}
                        className={`w-14 h-7 text-center bg-transparent font-mono text-xs font-bold outline-none select-text py-0.5 ${
                          autoCalculate ? 'opacity-65 text-[var(--text-secondary)] cursor-not-allowed' : 'text-[var(--foreground)]'
                        }`}
                      />
                      <span className="text-[9px] text-[var(--text-secondary)] font-bold">г</span>
                    </div>
                  </div>

                  {/* Carbs */}
                  <div className="bg-black/5 dark:bg-black/35 rounded-xl p-2 border border-[var(--border-color)]">
                    <label className="text-[9px] uppercase text-[var(--text-secondary)] font-bold block">Углеводы</label>
                    <div className="mt-1 flex items-center justify-center gap-0.5 h-7">
                      <input
                        type="number"
                        value={carbs}
                        disabled={autoCalculate}
                        readOnly={autoCalculate}
                        onChange={(e) => setCarbs(parseInt(e.target.value, 10) || 0)}
                        className={`w-14 h-7 text-center bg-transparent font-mono text-xs font-bold outline-none select-text py-0.5 ${
                          autoCalculate ? 'opacity-65 text-[var(--text-secondary)] cursor-not-allowed' : 'text-[var(--foreground)]'
                        }`}
                      />
                      <span className="text-[9px] text-[var(--text-secondary)] font-bold">г</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Save CTA */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent-color)] py-3 text-xs font-bold text-[var(--background)] active:scale-[0.98] disabled:opacity-40 transition-colors duration-200"
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--background)] border-t-transparent" />
              ) : (
                <>
                  <Check size={14} />
                  <span>Сохранить настройки</span>
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
