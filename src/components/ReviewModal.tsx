'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTma } from './tma-provider';
import { X, Flame, Sparkles, Heart, Apple, Check, ArrowLeft, Lock, Unlock } from 'lucide-react';

interface FoodAnalysis {
  dish_name: string;
  weight_g: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  confidence: number;
  ingredients: string[];
  ai_notes: string;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: FoodAnalysis | null;
  photoId?: string;
  photoUrl?: string | null;
  onSave: (finalData: FoodAnalysis) => Promise<void>;
}

export default function ReviewModal({
  isOpen,
  onClose,
  initialData,
  photoId,
  photoUrl,
  onSave,
}: ReviewModalProps) {
  const { theme, hapticImpact, hapticNotification, hapticSelectionChange } = useTma();
  const [dishName, setDishName] = useState('');
  
  // Base single serving macros (to scale proportionally)
  const [baseMacros, setBaseMacros] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    weight: 0
  });

  const [portion, setPortion] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);

  // Editable macros values
  const [weight, setWeight] = useState(0);
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [fat, setFat] = useState(0);
  const [carbs, setCarbs] = useState(0);

  // Sync state when modal opens
  useEffect(() => {
    if (initialData) {
      setDishName(initialData.dish_name);
      setWeight(initialData.weight_g);
      setCalories(initialData.calories);
      setProtein(initialData.protein_g);
      setFat(initialData.fat_g);
      setCarbs(initialData.carbs_g);
      
      setBaseMacros({
        calories: initialData.calories,
        protein: initialData.protein_g,
        fat: initialData.fat_g,
        carbs: initialData.carbs_g,
        weight: initialData.weight_g
      });
      setPortion(1);
      setShowManualEditor(false);
      setManualOverride(false);
    }
  }, [initialData]);

  if (!initialData) return null;

  const handlePortionChange = (newPortion: number) => {
    if (newPortion < 0.25 || newPortion > 10) return;
    setPortion(newPortion);
    
    setWeight(Math.round(baseMacros.weight * newPortion));
    
    if (!manualOverride) {
      setCalories(Math.round(baseMacros.calories * newPortion));
      setProtein(Math.round(baseMacros.protein * newPortion * 10) / 10);
      setFat(Math.round(baseMacros.fat * newPortion * 10) / 10);
      setCarbs(Math.round(baseMacros.carbs * newPortion * 10) / 10);
    }
    
    hapticSelectionChange();
  };

  const handleManualWeightChange = (newVal: number) => {
    const ratio = newVal / (weight || 1);
    setWeight(newVal);
    
    if (!manualOverride) {
      setCalories(Math.round(calories * ratio));
      setProtein(Math.round(protein * ratio * 10) / 10);
      setFat(Math.round(fat * ratio * 10) / 10);
      setCarbs(Math.round(carbs * ratio * 10) / 10);
    }
    
    hapticSelectionChange();
  };

  const handleSave = async () => {
    hapticImpact('medium');
    setIsSaving(true);
    try {
      await onSave({
        dish_name: dishName,
        weight_g: weight,
        calories: calories,
        protein_g: protein,
        fat_g: fat,
        carbs_g: carbs,
        confidence: initialData.confidence,
        ingredients: initialData.ingredients,
        ai_notes: initialData.ai_notes,
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

  const handleToggleOverride = () => {
    hapticImpact('light');
    setManualOverride(!manualOverride);
  };

  // Heuristic nutrition quality score (Health Score, e.g. 7/10)
  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const proteinRatio = proteinCals / (calories || 1);
  const fatRatio = fatCals / (calories || 1);
  let score = 5; 
  if (proteinRatio > 0.25) score += 2;
  if (proteinRatio > 0.35) score += 1;
  if (fatRatio < 0.3) score += 2;
  if (fatRatio > 0.45) score -= 1;
  const healthScore = Math.max(3, Math.min(10, score));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
          
          {/* Background Ambient Glow Spots for Liquid Glass feel */}
          <div className="glow-blob bg-purple-600/25 top-12 left-[-100px]" />
          <div className="glow-blob bg-cyan-600/20 bottom-24 right-[-100px]" />

          {/* Cover Photo Header */}
          <div className="relative h-72 w-full bg-black/20 dark:bg-[#111111] z-10">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={dishName}
                className="h-full w-full object-cover rounded-b-[2.5rem]"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-black/5 dark:bg-zinc-950 rounded-b-[2.5rem] border-b border-[var(--border-color)]">
                <span className="text-5xl">🍲</span>
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent rounded-b-[2.5rem]" />

            {/* Float Navigation buttons overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <button
                onClick={() => {
                  hapticImpact('light');
                  onClose();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 active:scale-95 transition-transform"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10">
                Анализ КБЖУ
              </div>
            </div>
          </div>

          {/* Details Body - Bound to var(--container-bg) for theme change support */}
          <div className="relative -mt-8 rounded-t-[2.5rem] bg-[var(--container-bg)] backdrop-blur-[28px] border-t border-[var(--border-color)] px-6 pt-8 pb-32 z-10 shadow-2xl">
            
            {/* Title & Portion capsule row */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none focus:border-b border-[var(--border-color)] pb-1 truncate"
                />
                <span className="mt-1 block text-xs text-[var(--text-secondary)] font-semibold">
                  Определено ИИ с точностью {Math.round(initialData.confidence * 100)}%
                </span>
              </div>

              {/* Sleek portion picker capsule */}
              <div className="flex items-center rounded-full border border-[var(--border-color)] bg-black/5 dark:bg-white/5 p-1">
                <button
                  onClick={() => handlePortionChange(portion - 0.25)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black active:bg-white/10 transition-colors"
                >
                  -
                </button>
                <span className="px-2.5 font-mono text-xs font-bold whitespace-nowrap">
                  {portion}x
                </span>
                <button
                  onClick={() => handlePortionChange(portion + 0.25)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black active:bg-white/10 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Calories Card Box */}
            <div className="mb-4 rounded-3xl glass p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                  <Flame size={20} className="fill-orange-500/20" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">Калории</span>
                  <div className="font-mono text-2xl font-black">{calories} ккал</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[var(--text-secondary)]">Вес порции</span>
                <div className="font-mono text-sm font-bold">{weight} г</div>
              </div>
            </div>

            {/* Macros Row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {/* Protein */}
              <div className="rounded-2xl glass p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] block">Белки</span>
                <span className="font-mono text-base font-black mt-1 block">{protein}г</span>
              </div>
              {/* Carbs */}
              <div className="rounded-2xl glass p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] block">Углеводы</span>
                <span className="font-mono text-base font-black mt-1 block">{carbs}г</span>
              </div>
              {/* Fats */}
              <div className="rounded-2xl glass p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] block">Жиры</span>
                <span className="font-mono text-base font-black mt-1 block">{fat}г</span>
              </div>
            </div>

            {/* Health Score Progress panel */}
            <div className="mb-6 rounded-3xl glass p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <Heart size={14} className="text-red-500 fill-red-500" />
                  Оценка пользы (Health Score)
                </span>
                <span className="font-mono text-xs font-black">{healthScore}/10</span>
              </div>
              <div className="h-1.5 w-full bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${healthScore * 10}%` }}
                />
              </div>
            </div>

            {/* Manual sliders adjustments block */}
            {showManualEditor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 space-y-4 rounded-3xl glass p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold uppercase tracking-wider">Корректировка порции</div>
                  
                  <button
                    onClick={handleToggleOverride}
                    className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] hover:text-white transition-colors"
                  >
                    {manualOverride ? (
                      <>
                        <Unlock size={11} className="text-orange-400" />
                        <span>БЖУ разблокировано</span>
                      </>
                    ) : (
                      <>
                        <Lock size={11} className="text-zinc-500" />
                        <span>БЖУ заблокировано</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Weight slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>Вес блюда</span>
                    <span className="font-mono font-bold">{weight} г</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="5"
                    value={weight}
                    onChange={(e) => handleManualWeightChange(parseInt(e.target.value, 10))}
                    className="h-1 w-full appearance-none bg-black/10 dark:bg-white/10 rounded-lg accent-[var(--accent-color)]"
                  />
                </div>

                {/* Calories slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>Калории</span>
                    <span className="font-mono font-bold">{calories} ккал</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="2000"
                    step="10"
                    disabled={!manualOverride}
                    value={calories}
                    onChange={(e) => {
                      setCalories(parseInt(e.target.value, 10));
                      hapticSelectionChange();
                    }}
                    className={`h-1 w-full appearance-none bg-black/10 dark:bg-white/10 rounded-lg accent-[var(--accent-color)] ${
                      !manualOverride ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                {/* Macros grid inputs */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center bg-black/5 dark:bg-black/40 rounded-xl p-2 border border-[var(--border-color)]">
                    <span className="text-[9px] uppercase text-[var(--text-secondary)]">Белки (г)</span>
                    <input
                      type="number"
                      value={protein}
                      disabled={!manualOverride}
                      readOnly={!manualOverride}
                      onChange={(e) => setProtein(parseFloat(e.target.value) || 0)}
                      className={`w-full text-center bg-transparent font-mono text-xs font-bold outline-none select-text ${
                        !manualOverride ? 'opacity-65 text-zinc-500 cursor-not-allowed' : 'text-[var(--foreground)] border-b border-[var(--border-color)]'
                      }`}
                    />
                  </div>
                  <div className="text-center bg-black/5 dark:bg-black/40 rounded-xl p-2 border border-[var(--border-color)]">
                    <span className="text-[9px] uppercase text-[var(--text-secondary)]">Жиры (г)</span>
                    <input
                      type="number"
                      value={fat}
                      disabled={!manualOverride}
                      readOnly={!manualOverride}
                      onChange={(e) => setFat(parseFloat(e.target.value) || 0)}
                      className={`w-full text-center bg-transparent font-mono text-xs font-bold outline-none select-text ${
                        !manualOverride ? 'opacity-65 text-zinc-500 cursor-not-allowed' : 'text-[var(--foreground)] border-b border-[var(--border-color)]'
                      }`}
                    />
                  </div>
                  <div className="text-center bg-black/5 dark:bg-black/40 rounded-xl p-2 border border-[var(--border-color)]">
                    <span className="text-[9px] uppercase text-[var(--text-secondary)]">Углеводы (г)</span>
                    <input
                      type="number"
                      value={carbs}
                      disabled={!manualOverride}
                      readOnly={!manualOverride}
                      onChange={(e) => setCarbs(parseFloat(e.target.value) || 0)}
                      className={`w-full text-center bg-transparent font-mono text-xs font-bold outline-none select-text ${
                        !manualOverride ? 'opacity-65 text-zinc-500 cursor-not-allowed' : 'text-[var(--foreground)] border-b border-[var(--border-color)]'
                      }`}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Ingredients block */}
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Ингредиенты</span>
              <div className="flex flex-wrap gap-2">
                {initialData.ingredients.map((ing, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-black/5 dark:bg-white/5 border border-[var(--border-color)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Notes advisor */}
            {initialData.ai_notes && (
              <div className="mb-6 rounded-3xl border border-dashed border-[var(--border-color)] bg-black/5 dark:bg-white/5 p-4">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <Apple size={14} className="text-emerald-500" />
                  Совет ИИ диетолога:
                </span>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{initialData.ai_notes}</p>
              </div>
            )}
          </div>

          {/* CTA Action Buttons panel at bottom */}
          <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md bg-[var(--container-bg)] backdrop-blur-md border-t border-[var(--border-color)] p-4 flex gap-3 shadow-2xl justify-between">
            <button
              onClick={() => {
                hapticImpact('light');
                setShowManualEditor(!showManualEditor);
              }}
              className="flex items-center justify-center gap-2 rounded-full border border-[var(--border-color)] bg-black/5 dark:bg-white/5 px-5 py-4 text-xs font-bold text-[var(--foreground)] w-[45%] active:scale-[0.98] transition-colors"
            >
              <Sparkles size={14} className="text-purple-400" />
              <span>{showManualEditor ? 'Скрыть правки' : 'Изменить данные'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--accent-color)] px-5 py-4 text-xs font-bold text-[var(--background)] w-[50%] active:scale-[0.98] disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--background)] border-t-transparent" />
              ) : (
                <>
                  <Check size={14} />
                  <span>Готово</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}
    </AnimatePresence>
  );
}
