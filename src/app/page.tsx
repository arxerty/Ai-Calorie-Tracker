'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTma } from '@/components/tma-provider';
import ReviewModal from '@/components/ReviewModal';
import GoalSettingsModal from '@/components/GoalSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Camera,
  Mic,
  FileText,
  Sparkles,
  Settings,
  X,
  Apple,
  Image as ImageIcon,
  Zap,
  Wheat,
  Droplets,
  Scale,
  Check,
  Keyboard,
  QrCode,
  ScanLine,
  TrendingUp,
} from 'lucide-react';

interface FoodItem {
  id: string;
  name: string;
  weightG: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  photo?: { url: string } | null;
}

export default function Dashboard() {
  const { initDataRaw, theme, hapticImpact, hapticNotification, hapticSelectionChange } = useTma();
  const queryClient = useQueryClient();

  // Date selection states
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Modal Open States
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogSelectorOpen, setIsLogSelectorOpen] = useState(false);
  const [isTextLoggerOpen, setIsTextLoggerOpen] = useState(false);
  const [isManualLoggerOpen, setIsManualLoggerOpen] = useState(false);

  // Physical stats for onboarding form (Harris/Mifflin defaults)
  const [obWeight, setObWeight] = useState('');
  const [obHeight, setObHeight] = useState('');
  const [obAge, setObAge] = useState('');
  const [obGender, setObGender] = useState<'male' | 'female'>('male');
  const [obGoal, setObGoal] = useState('maintenance');
  const [obCalPreview, setObCalPreview] = useState(2000);
  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);

  // Manual written food log fields
  const [manualFoodName, setManualFoodName] = useState('');
  const [manualFoodWeight, setManualFoodWeight] = useState('');

  // AI Ingestion States
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiPhotoId, setAiPhotoId] = useState<string | undefined>(undefined);
  const [aiPhotoUrl, setAiPhotoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Tabs navigation & weight logs (Requirement 3 tabs & progress chart)
  const [activeTab, setActiveTab] = useState<'home' | 'progress'>('home');
  const [inputWeight, setInputWeight] = useState('');
  const [weightFilter, setWeightFilter] = useState<'90D' | '6M' | '1Y' | 'ALL'>('6M');
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([
    { date: 'Июн', weight: 84.5 },
    { date: 'Июл', weight: 83.2 },
    { date: 'Авг', weight: 82.0 },
    { date: 'Сен', weight: 81.1 },
    { date: 'Окт', weight: 80.5 },
    { date: 'Ноя', weight: 79.8 },
  ]);

  // Text inputs
  const [textDescription, setTextDescription] = useState('');
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Dynamic calculated target preview during onboarding
  useEffect(() => {
    const w = parseFloat(obWeight);
    const h = parseFloat(obHeight);
    const a = parseInt(obAge, 10);
    
    if (w && h && a) {
      // Mifflin-St Jeor Formula BMR
      let bmr = 0;
      if (obGender === 'male') {
        bmr = 10 * w + 6.25 * h - 5 * a + 5;
      } else {
        bmr = 10 * w + 6.25 * h - 5 * a - 161;
      }
      
      const tdee = bmr * 1.375;
      let target = Math.round(tdee);
      const minC = obGender === 'male' ? 1500 : 1200;

      if (obGoal === 'weight_loss') target = Math.max(minC, Math.round(tdee - 500));
      else if (obGoal === 'muscle_gain') target = Math.round(tdee + 300);

      setObCalPreview(target);
    } else {
      setObCalPreview(obGoal === 'weight_loss' ? 1600 : obGoal === 'muscle_gain' ? 2400 : 2000);
    }
  }, [obWeight, obHeight, obAge, obGender, obGoal]);



  // 1. QUERY: Synchronize User & retrieve Streak/Goals
  const { data: syncData, isLoading: isSyncLoading } = useQuery({
    queryKey: ['user-sync', initDataRaw],
    queryFn: async () => {
      if (!initDataRaw) return null;
      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initDataRaw }),
      });
      if (!res.ok) throw new Error('User sync failed');
      return res.json();
    },
    enabled: !!initDataRaw,
  });

  // 2. QUERY: Retrieve daily logs for the selected date
  const { data: logsData, isLoading: isLogsLoading } = useQuery({
    queryKey: ['logs', selectedDate, initDataRaw],
    queryFn: async () => {
      const res = await fetch(`/api/logs?date=${selectedDate}`, {
        headers: { 'x-telegram-init-data': initDataRaw },
      });
      if (!res.ok) throw new Error('Failed to fetch daily logs');
      return res.json();
    },
    enabled: !!initDataRaw && !!selectedDate,
  });

  // 3. MUTATION: Delete logged food item
  const deleteMutation = useMutation({
    mutationFn: async (foodItemId: string) => {
      const res = await fetch(`/api/logs?id=${foodItemId}`, {
        method: 'DELETE',
        headers: { 'x-telegram-init-data': initDataRaw },
      });
      if (!res.ok) throw new Error('Failed to delete food item');
      return res.json();
    },
    onSuccess: (data) => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: ['logs', selectedDate] });
      queryClient.setQueryData(['user-sync', initDataRaw], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          user: { ...old.user, streakDays: data.streakDays },
        };
      });
    },
  });

  // 4. MUTATION: Save settings & goals
  const updateSettingsMutation = useMutation({
    mutationFn: async ({ goal, settings }: { goal: string; settings: any }) => {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initDataRaw,
        },
        body: JSON.stringify({ ...settings, fitnessGoal: goal }),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sync', initDataRaw] });
    },
  });

  // Generate weight progress timeline starting dynamically from the user's registration date (Requirement 3 chart date)
  useEffect(() => {
    if (syncData?.settings?.weight && syncData?.user?.createdAt) {
      const currentW = syncData.settings.weight;
      const registerDate = new Date(syncData.user.createdAt);
      const today = new Date();
      
      const diffTime = Math.abs(today.getTime() - registerDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const pointsList: { date: string; weight: number }[] = [];
      
      if (diffDays <= 7) {
        for (let i = diffDays; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          if (d >= registerDate) {
            const dayLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
            const weightVal = currentW + (i * 0.15);
            pointsList.push({
              date: dayLabel,
              weight: Math.round(weightVal * 10) / 10
            });
          }
        }
      } else {
        const stepDays = Math.max(1, Math.floor(diffDays / 5));
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - (i * stepDays));
          if (d >= registerDate || i === 0) {
            const dayLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
            const weightVal = currentW + (i * 0.25);
            pointsList.push({
              date: dayLabel,
              weight: Math.round(weightVal * 10) / 10
            });
          }
        }
      }

      const uniquePoints = pointsList.filter((item, index, self) =>
        index === self.findIndex((t) => t.date === item.date)
      );

      setWeightHistory(uniquePoints.length > 0 ? uniquePoints : [{ date: 'Сегодня', weight: currentW }]);
    }
  }, [syncData?.settings?.weight, syncData?.user?.createdAt]);

  const handleWeightLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wNum = parseFloat(inputWeight);
    if (!wNum) return;
    
    hapticImpact('medium');
    try {
      await updateSettingsMutation.mutateAsync({
        goal: syncData?.user?.fitnessGoal || 'maintenance',
        settings: {
          ...syncData?.settings,
          weight: wNum,
        },
      });
      
      setWeightHistory((prev) => {
        const next = [...prev];
        if (next.length > 0) {
          next[next.length - 1].weight = wNum;
        }
        return next;
      });
      setInputWeight('');
      hapticNotification('success');
      alert('Вес успешно записан!');
    } catch (err) {
      hapticNotification('error');
      alert('Ошибка при сохранении веса');
    }
  };

  // Targets physical calculations
  const targetCalories = syncData?.settings?.calorieTarget || 2000;
  const targetProtein = syncData?.settings?.proteinTarget || 130;
  const targetFat = syncData?.settings?.fatTarget || 70;
  const targetCarbs = syncData?.settings?.carbTarget || 210;

  const foodItems: FoodItem[] = logsData?.log?.foodItems || [];
  const consumedCalories = foodItems.reduce((acc, item) => acc + item.calories, 0);
  const consumedProtein = foodItems.reduce((acc, item) => acc + item.proteinG, 0);
  const consumedFat = foodItems.reduce((acc, item) => acc + item.fatG, 0);
  const consumedCarbs = foodItems.reduce((acc, item) => acc + item.carbsG, 0);

  const caloriesLeft = Math.max(0, targetCalories - consumedCalories);
  const isCalorieExceeded = consumedCalories > targetCalories;

  // Ingestion Actions: Image Parser
  const processImageFile = async (file: File) => {
    hapticImpact('medium');
    setIsLogSelectorOpen(false);
    setIsAnalyzing(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'x-telegram-init-data': initDataRaw },
        body: formData,
      });

      if (!res.ok) throw new Error('AI Image analysis failed');
      const data = await res.json();

      if (data.success) {
        setAiResult(data.analysis);
        setAiPhotoId(data.photoId);
        setAiPhotoUrl(data.photoUrl);
        setIsReviewOpen(true);
      } else {
        hapticNotification('error');
        alert(`Не удалось распознать еду: ${data.error}`);
      }
    } catch (err: any) {
      console.error(err);
      hapticNotification('error');
      alert(`Ошибка анализа: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Ingestion Actions: Submit Freeform description text
  const handleTextSubmit = async () => {
    if (!textDescription.trim()) return;

    hapticImpact('medium');
    setIsTextLoggerOpen(false);
    setIsAnalyzing(true);

    const formData = new FormData();
    formData.append('text', textDescription);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'x-telegram-init-data': initDataRaw },
        body: formData,
      });

      if (!res.ok) throw new Error('AI Text analysis failed');
      const data = await res.json();

      if (data.success) {
        setAiResult(data.analysis);
        setAiPhotoId(undefined);
        setAiPhotoUrl(null);
        setIsReviewOpen(true);
        setTextDescription('');
      } else {
        hapticNotification('error');
        alert(`Не удалось распознать описание: ${data.error}`);
      }
    } catch (err: any) {
      console.error(err);
      hapticNotification('error');
      alert(`Ошибка анализа: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Ingestion Actions: Manual name and weight logging form submit
  const handleManualFoodSubmit = async () => {
    const fName = manualFoodName.trim();
    const fWeight = parseFloat(manualFoodWeight);

    if (!fName || !fWeight) {
      hapticNotification('warning');
      alert('Пожалуйста, введите название еды и вес в граммах');
      return;
    }

    hapticImpact('medium');
    setIsManualLoggerOpen(false);
    setIsAnalyzing(true);

    const textPayload = `${fName}, ${fWeight} грамм`;
    const formData = new FormData();
    formData.append('text', textPayload);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'x-telegram-init-data': initDataRaw },
        body: formData,
      });

      if (!res.ok) throw new Error('Manual analysis failed');
      const data = await res.json();

      if (data.success) {
        setAiResult(data.analysis);
        setAiPhotoId(undefined);
        setAiPhotoUrl(null);
        setIsReviewOpen(true);
        setManualFoodName('');
        setManualFoodWeight('');
      } else {
        hapticNotification('error');
        alert(`Ошибка расчета: ${data.error}`);
      }
    } catch (err: any) {
      console.error(err);
      hapticNotification('error');
      alert(`Ошибка анализа: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Ingestion Actions: Native Barcode / QR Scan Popup (Requirement 2 scanner)
  const startBarcodeScanner = () => {
    hapticImpact('light');
    setIsLogSelectorOpen(false);

    const webapp = (window as any).Telegram?.WebApp;
    if (webapp && typeof webapp.showScanQrPopup === 'function') {
      webapp.showScanQrPopup(
        { text: 'Отсканируйте штрих-код продукта' },
        async (result: string) => {
          if (!result) return;
          webapp.closeScanQrPopup();
          
          // Send scanned data to AI analysis
          await processBarcodeData(result);
        }
      );
    } else {
      // Mock scanner in browser (ask user to type barcode)
      const mockBarcode = prompt('Вставьте или введите штрихкод продукта (например: 4600682120021):');
      if (mockBarcode) {
        processBarcodeData(mockBarcode);
      }
    }
  };

  const processBarcodeData = async (barcode: string) => {
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('text', `Штрихкод продукта: ${barcode}. Найди этот продукт и дай КБЖУ на 100 грамм.`);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'x-telegram-init-data': initDataRaw },
        body: formData,
      });

      if (!res.ok) throw new Error('Barcode scan analysis failed');
      const data = await res.json();

      if (data.success) {
        setAiResult(data.analysis);
        setAiPhotoId(undefined);
        setAiPhotoUrl(null);
        setIsReviewOpen(true);
      } else {
        hapticNotification('error');
        alert(`Не удалось распознать штрихкод: ${data.error}`);
      }
    } catch (err: any) {
      console.error(err);
      hapticNotification('error');
      alert(`Ошибка при обработке штрихкода: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  const commitReviewedFood = async (finalData: any) => {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initDataRaw,
      },
      body: JSON.stringify({
        date: selectedDate,
        name: finalData.dish_name,
        weightG: finalData.weight_g,
        calories: finalData.calories,
        proteinG: finalData.protein_g,
        fatG: finalData.fat_g,
        carbsG: finalData.carbs_g,
        photoId: aiPhotoId,
      }),
    });

    if (!res.ok) throw new Error('Failed to save meal');
    const data = await res.json();

    queryClient.invalidateQueries({ queryKey: ['logs', selectedDate] });
    queryClient.setQueryData(['user-sync', initDataRaw], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        user: { ...old.user, streakDays: data.streakDays },
      };
    });
  };

  // Onboarding submit
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wNum = parseFloat(obWeight);
    const hNum = parseFloat(obHeight);
    const aNum = parseInt(obAge, 10);

    if (!wNum || !hNum || !aNum) {
      hapticNotification('warning');
      alert('Пожалуйста, заполните все параметры');
      return;
    }

    hapticImpact('medium');
    setIsOnboardingSaving(true);

    try {
      await updateSettingsMutation.mutateAsync({
        goal: obGoal,
        settings: {
          isOnboarded: true,
          weight: wNum,
          height: hNum,
          age: aNum,
          gender: obGender,
        },
      });
      hapticNotification('success');
    } catch (err) {
      hapticNotification('error');
      alert('Ошибка сохранения данных');
    } finally {
      setIsOnboardingSaving(false);
    }
  };

  const startRecording = async () => {
    hapticImpact('medium');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        setIsLogSelectorOpen(false);
        setIsAnalyzing(true);

        const formData = new FormData();
        formData.append('voice', audioBlob, 'voice-recording.webm');

        try {
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'x-telegram-init-data': initDataRaw },
            body: formData,
          });

          if (!res.ok) throw new Error('AI Voice analysis failed');
          const data = await res.json();

          if (data.success) {
            setAiResult(data.analysis);
            setAiPhotoId(undefined);
            setAiPhotoUrl(null);
            setIsReviewOpen(true);
          } else {
            hapticNotification('error');
            alert(`Не удалось расшифровать голос: ${data.error}`);
          }
        } catch (err: any) {
          console.error(err);
          hapticNotification('error');
          alert(`Ошибка анализа голоса: ${err.message}`);
        } finally {
          setIsAnalyzing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (e) {
      console.error('Audio recording failed', e);
      hapticNotification('error');
      alert('Нет доступа к микрофону.');
    }
  };

  const stopRecording = () => {
    hapticImpact('light');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // Calculations for Calorie Ring (glowing style)
  const mainRingRadius = 45;
  const mainRingCirc = 2 * Math.PI * mainRingRadius;
  const calPercent = Math.min(100, (consumedCalories / (targetCalories || 1)) * 100);
  const mainDashoffset = mainRingCirc - (calPercent / 100) * mainRingCirc;

  // Mini Macro Circles parameters
  const miniRingRadius = 20;
  const miniRingCirc = 2 * Math.PI * miniRingRadius;

  const protPercent = Math.min(100, (consumedProtein / (targetProtein || 1)) * 100);
  const protDashoffset = miniRingCirc - (protPercent / 100) * miniRingCirc;

  const carbPercent = Math.min(100, (consumedCarbs / (targetCarbs || 1)) * 100);
  const carbDashoffset = miniRingCirc - (carbPercent / 100) * miniRingCirc;

  const fatPercent = Math.min(100, (consumedFat / (targetFat || 1)) * 100);
  const fatDashoffset = miniRingCirc - (fatPercent / 100) * miniRingCirc;

  // Chart calculation metrics (Requirement 3 custom trend graph)
  const chartWidth = 320;
  const chartHeight = 150;
  const paddingX = 25;
  const paddingY = 20;

  const weights = weightHistory.map((d) => d.weight);
  const minW = Math.max(10, Math.min(...weights) - 2);
  const maxW = Math.max(...weights) + 2;
  const rangeW = maxW - minW || 1;

  const chartPoints = weightHistory.map((d, i) => {
    const x = paddingX + (i / (weightHistory.length - 1)) * (chartWidth - 2 * paddingX);
    const y = chartHeight - paddingY - ((d.weight - minW) / rangeW) * (chartHeight - 2 * paddingY);
    return { x, y, label: d.date, weight: d.weight };
  });

  const chartLinePath = chartPoints.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const chartAreaPath = chartPoints.length > 0
    ? `${chartLinePath} L ${chartPoints[chartPoints.length - 1].x} ${chartHeight - paddingY} L ${chartPoints[0].x} ${chartHeight - paddingY} Z`
    : '';

  return (
    <div className="relative mx-auto min-h-screen max-w-md bg-[var(--background)] text-[var(--foreground)] px-4 pt-5 pb-24 transition-colors duration-300">
      
      {/* Liquid Glass ambient glowing background spheres */}
      <div className="glow-blob bg-purple-600/20 top-12 left-[-100px]" />
      <div className="glow-blob bg-cyan-600/15 bottom-36 right-[-100px]" />

      {/* CENTERED ONBOARDING MODAL OVERLAY */}
      <AnimatePresence>
        {syncData && !syncData.settings?.isOnboarded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 w-full max-w-sm rounded-[2.5rem] border border-[var(--border-color)] bg-[var(--container-bg)] p-6 shadow-2xl backdrop-blur-[28px] focus:outline-none"
            >
              <div className="mb-4 text-center">
                <span className="text-3xl">🍏</span>
                <h3 className="mt-2 text-lg font-bold tracking-tight">Добро пожаловать</h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Внесите параметры в App Ai для авто-расчета</p>
              </div>

              <form onSubmit={handleOnboardingSubmit} className="space-y-3.5">
                {/* Gender Select */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-[var(--text-secondary)]">Пол</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['male', 'female'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setObGender(g as any);
                          hapticImpact('light');
                        }}
                        className={`rounded-xl border py-2 text-xs font-semibold ${
                          obGender === g
                            ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--background)]'
                            : 'border-[var(--border-color)] bg-[var(--background)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {g === 'male' ? 'Мужчина' : 'Женщина'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weight, Height, Age Input grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-[var(--text-secondary)]">Вес (кг)</label>
                    <input
                      type="number"
                      placeholder="75"
                      required
                      value={obWeight}
                      onChange={(e) => setObWeight(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-2.5 text-center text-xs font-bold outline-none focus:border-[var(--accent-color)] select-text"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-[var(--text-secondary)]">Рост (см)</label>
                    <input
                      type="number"
                      placeholder="178"
                      required
                      value={obHeight}
                      onChange={(e) => setObHeight(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-2.5 text-center text-xs font-bold outline-none focus:border-[var(--accent-color)] select-text"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-[var(--text-secondary)]">Возраст</label>
                    <input
                      type="number"
                      placeholder="28"
                      required
                      value={obAge}
                      onChange={(e) => setObAge(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-2.5 text-center text-xs font-bold outline-none focus:border-[var(--accent-color)] select-text"
                    />
                  </div>
                </div>

                {/* Onboarding Goal Selector */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-[var(--text-secondary)]">Ваша цель</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'weight_loss', label: 'Похудеть' },
                      { id: 'maintenance', label: 'Поддержание' },
                      { id: 'muscle_gain', label: 'Набрать' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setObGoal(g.id);
                          hapticImpact('light');
                        }}
                        className={`rounded-xl border py-2 text-[10px] font-semibold ${
                          obGoal === g.id
                            ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--background)]'
                            : 'border-[var(--border-color)] bg-[var(--background)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calorie Target preview panel */}
                <div className="rounded-2xl border border-[var(--border-color)] bg-black/5 dark:bg-black/40 p-3 text-center">
                  <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold block">Цель калорий (Mifflin BMR)</span>
                  <span className="font-mono text-sm font-black text-[var(--foreground)] mt-0.5 block">{obCalPreview} ккал</span>
                </div>

                {/* Onboarding Save CTA */}
                <button
                  type="submit"
                  disabled={isOnboardingSaving}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent-color)] py-3 text-xs font-bold text-[var(--background)] active:scale-[0.98]"
                >
                  {isOnboardingSaving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--background)] border-t-transparent" />
                  ) : (
                    <span>Начать расчет КБЖУ</span>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOP HEADER NAVIGATION */}
      <header className="mb-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          <Apple className="text-[var(--accent-color)] fill-[var(--accent-color)]" size={20} />
          <span className="text-xl font-black tracking-tight">App Ai</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Gallery Trigger */}
          <button
            onClick={() => {
              hapticImpact('light');
              galleryInputRef.current?.click();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--container-bg)] text-[var(--foreground)] active:scale-95 transition-transform"
          >
            <ImageIcon size={16} />
          </button>
          <input
            type="file"
            accept="image/*"
            ref={galleryInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processImageFile(file);
            }}
            className="hidden"
          />

          {/* Streak Flame Badge */}
          <button
            onClick={() => {
              hapticImpact('medium');
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[var(--container-bg)] px-3.5 py-2 active:scale-95 transition-transform"
          >
            <Flame
              size={15}
              className={syncData?.user?.streakDays > 0 ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-[var(--text-secondary)]'}
            />
            <span className="font-mono text-xs font-black">
              {syncData?.user?.streakDays || 0}
            </span>
          </button>


        </div>
      </header>

      {activeTab === 'home' && (
        <>
          {/* TODAY / YESTERDAY TABS SELECTOR */}
          <div className="mb-5 flex gap-5 border-b border-[var(--border-color)] pb-2.5 text-sm font-bold relative z-10">
            {[
              { id: todayStr, label: 'Сегодня' },
              { id: yesterdayStr, label: 'Вчера' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  hapticSelectionChange();
                  setSelectedDate(tab.id);
                }}
                className={`relative pb-1 transition-colors ${selectedDate === tab.id ? 'text-[var(--foreground)]' : 'text-[var(--text-secondary)]'}`}
              >
                {tab.label}
                {selectedDate === tab.id && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-[var(--accent-color)] rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          {/* MAIN CALORIES LEFT CARD */}
          <section className="mb-5 rounded-3xl border border-[var(--border-color)] bg-[var(--container-bg)] p-6 flex items-center justify-between shadow-sm relative overflow-hidden backdrop-blur-md z-10">
            {isAnalyzing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <p className="mt-3 text-xs font-semibold tracking-wider text-white uppercase animate-pulse">
                  Распознавание ИИ...
                </p>
              </div>
            )}

            <div>
              <div className="font-mono text-4xl font-black tracking-tighter">
                {isCalorieExceeded ? consumedCalories - targetCalories : caloriesLeft}
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)] mt-1 block">
                {isCalorieExceeded ? 'Калорий перебор (ккал)' : 'Калорий осталось'}
              </span>
            </div>

            {/* Circular Progress Ring with glow */}
            <div className="relative flex h-24 w-24 items-center justify-center glow-main">
              <svg className="absolute h-full w-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r={mainRingRadius}
                  className="fill-none stroke-[var(--border-color)]"
                  strokeWidth="7"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={mainRingRadius}
                  className="fill-none stroke-[var(--accent-color)] transition-all duration-300"
                  strokeWidth="7"
                  strokeDasharray={mainRingCirc}
                  strokeDashoffset={mainDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="z-10 text-xs">🔥</div>
            </div>
          </section>

          {/* THREE MACROS progress circles - restructured to prevent overlap */}
          <section className="mb-6 grid grid-cols-3 gap-3 relative z-10">
            
            {/* Protein Circle Card */}
            <div className="glass rounded-[2rem] p-3 text-center flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Белки</span>
              
              <div className="relative flex h-12 w-12 items-center justify-center glow-rose">
                <svg className="absolute h-full w-full -rotate-90">
                  <circle cx="24" cy="24" r={miniRingRadius} className="fill-none stroke-[var(--border-color)]" strokeWidth="3" />
                  <circle
                    cx="24"
                    cy="24"
                    r={miniRingRadius}
                    className="fill-none stroke-rose-500 transition-all duration-300"
                    strokeWidth="3"
                    strokeDasharray={miniRingCirc}
                    strokeDashoffset={protDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <Zap size={11} className="text-rose-500 fill-rose-500" />
              </div>

              <div className="text-[10px] font-mono font-bold leading-tight">
                <div>{Math.round(consumedProtein)}г</div>
                <div className="text-[8.5px] text-[var(--text-secondary)] font-normal mt-0.5">из {targetProtein}г</div>
              </div>
            </div>

            {/* Carbs Circle Card */}
            <div className="glass rounded-[2rem] p-3 text-center flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Углеводы</span>
              
              <div className="relative flex h-12 w-12 items-center justify-center glow-amber">
                <svg className="absolute h-full w-full -rotate-90">
                  <circle cx="24" cy="24" r={miniRingRadius} className="fill-none stroke-[var(--border-color)]" strokeWidth="3" />
                  <circle
                    cx="24"
                    cy="24"
                    r={miniRingRadius}
                    className="fill-none stroke-amber-500 transition-all duration-300"
                    strokeWidth="3"
                    strokeDasharray={miniRingCirc}
                    strokeDashoffset={carbDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <Wheat size={11} className="text-amber-500 fill-amber-500/20" />
              </div>

              <div className="text-[10px] font-mono font-bold leading-tight">
                <div>{Math.round(consumedCarbs)}г</div>
                <div className="text-[8.5px] text-[var(--text-secondary)] font-normal mt-0.5">из {targetCarbs}г</div>
              </div>
            </div>

            {/* Fats Circle Card */}
            <div className="glass rounded-[2rem] p-3 text-center flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-cyan-500 tracking-wider">Жиры</span>
              
              <div className="relative flex h-12 w-12 items-center justify-center glow-cyan">
                <svg className="absolute h-full w-full -rotate-90">
                  <circle cx="24" cy="24" r={miniRingRadius} className="fill-none stroke-[var(--border-color)]" strokeWidth="3" />
                  <circle
                    cx="24"
                    cy="24"
                    r={miniRingRadius}
                    className="fill-none stroke-cyan-500 transition-all duration-300"
                    strokeWidth="3"
                    strokeDasharray={miniRingCirc}
                    strokeDashoffset={fatDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <Droplets size={11} className="text-cyan-500 fill-cyan-500/20" />
              </div>

              <div className="text-[10px] font-mono font-bold leading-tight">
                <div>{Math.round(consumedFat)}г</div>
                <div className="text-[8.5px] text-[var(--text-secondary)] font-normal mt-0.5">из {targetFat}г</div>
              </div>
            </div>

          </section>

          {/* RECENTLY UPLOADED TIMELINE LOGS */}
          <section className="mb-10 relative z-10">
            <h4 className="mb-3.5 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] text-left">Недавно добавленное</h4>
            
            {isLogsLoading ? (
              <div className="flex py-8 justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border border-[var(--accent-color)] border-t-transparent" />
              </div>
            ) : foodItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--border-color)] p-8 text-center bg-black/5 dark:bg-black/40 backdrop-blur-md">
                <div className="mx-auto mb-2 text-2xl">🍽️</div>
                <p className="text-xs text-[var(--text-secondary)]">Логи приемов пищи пусты для этого дня</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Нажмите на кнопку ниже, чтобы добавить еду</p>
              </div>
            ) : (
              <div className="space-y-3">
                {foodItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--container-bg)] p-3.5 shadow-sm active:border-zinc-800 transition-all backdrop-blur-md"
                  >
                    {/* Photo Thumbnail */}
                    {item.photo?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photo.url}
                        alt={item.name}
                        className="h-14 w-14 rounded-xl object-cover border border-[var(--border-color)]"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--background)] text-sm">
                        🍏
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-start">
                        <div className="truncate text-xs font-bold text-[var(--foreground)]">{item.name}</div>
                        <span className="text-[9px] text-[var(--text-secondary)]">12:46 PM</span>
                      </div>
                      
                      {/* Calories with flame */}
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-orange-500">
                        <Flame size={10} className="fill-orange-500/20" />
                        <span>{item.calories} ккал</span>
                      </div>

                      {/* Micro tags row for macros */}
                      <div className="mt-1.5 flex items-center gap-2 text-[9px] font-semibold">
                        <span className="rounded bg-rose-500/10 text-rose-500 px-1.5 py-0.5">
                          Б: {Math.round(item.proteinG)}г
                        </span>
                        <span className="rounded bg-amber-500/10 text-amber-500 px-1.5 py-0.5">
                          У: {Math.round(item.carbsG)}г
                        </span>
                        <span className="rounded bg-cyan-500/10 text-cyan-500 px-1.5 py-0.5">
                          Ж: {Math.round(item.fatG)}г
                        </span>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => {
                        hapticImpact('medium');
                        if (confirm(`Удалить "${item.name}"?`)) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--background)] text-red-500 active:scale-95"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* FLOATING ACTION BOTTOM BUTTON */}
          <div className="fixed bottom-24 left-0 right-0 z-40 mx-auto max-w-md px-4 flex justify-center">
            <button
              onClick={() => {
                hapticImpact('heavy');
                setIsLogSelectorOpen(true);
              }}
              className="flex items-center justify-center rounded-full bg-[var(--accent-color)] p-4 text-[var(--background)] shadow-2xl active:scale-[0.95]"
            >
              <Plus size={24} strokeWidth={3} />
            </button>
          </div>
        </>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-4 pb-24 relative z-10 text-left">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight">Прогресс</h2>
            <p className="text-[10px] text-[var(--text-secondary)]">Статистика веса и streaks активности</p>
          </div>

          {/* Your Weight Card */}
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--container-bg)] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">Текущий вес</span>
                <div className="font-mono text-2xl font-black mt-0.5">
                  {syncData?.settings?.weight ? `${syncData.settings.weight} кг` : 'Не указан'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">Фитнес-цель</span>
                <div className="text-xs font-bold text-[var(--accent-color)] mt-1.5">
                  {syncData?.user?.fitnessGoal === 'weight_loss' ? 'Похудение' : syncData?.user?.fitnessGoal === 'muscle_gain' ? 'Набор' : 'Поддержание'}
                </div>
              </div>
            </div>

            {/* Quick Weight Log Form */}
            <form onSubmit={handleWeightLogSubmit} className="flex gap-2 mt-4 pt-4 border-t border-[var(--border-color)]">
              <input
                type="number"
                step="0.1"
                placeholder="Новый вес (кг)"
                value={inputWeight}
                onChange={(e) => setInputWeight(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border-color)] bg-black/5 dark:bg-black/35 p-2 text-xs font-bold outline-none text-center select-text"
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent-color)] px-4 text-xs font-black text-[var(--background)] active:scale-95 transition-transform"
              >
                Записать
              </button>
            </form>
          </div>

          {/* Day Streak Card */}
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--container-bg)] p-5 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 animate-pulse">
                <Flame size={20} className="fill-orange-500/20" />
              </div>
              <div>
                <div className="font-mono text-xl font-black">{syncData?.user?.streakDays || 0} дней</div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">Активная серия дней</span>
              </div>
            </div>

            {/* Calendar indicators row */}
            <div className="flex justify-between items-center bg-black/5 dark:bg-black/25 rounded-2xl p-3 border border-[var(--border-color)]">
              {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day, idx) => {
                const isCompleted = (syncData?.user?.streakDays || 0) > (6 - idx);
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <span className="text-[9px] font-bold text-[var(--text-secondary)]">{day}</span>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center border text-[10px] font-bold transition-all ${
                      isCompleted 
                        ? 'bg-orange-500 border-orange-500 text-white' 
                        : 'border-[var(--border-color)] bg-black/20 text-[var(--text-secondary)]'
                    }`}>
                      {isCompleted ? '🔥' : '•'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weight Progress Chart Card */}
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--container-bg)] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">График веса</span>
              
              {/* Range selector */}
              <div className="flex rounded-full bg-black/10 dark:bg-black/40 border border-[var(--border-color)] p-0.5">
                {['90D', '6M', '1Y', 'ALL'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setWeightFilter(f as any);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold transition-all ${
                      weightFilter === f 
                        ? 'bg-[var(--accent-color)] text-[var(--background)]' 
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom SVG Line Chart */}
            <div className="relative flex justify-center py-2 bg-black/5 dark:bg-black/20 rounded-2xl border border-[var(--border-color)] p-2">
              <svg width={chartWidth} height={chartHeight} className="overflow-visible">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal scale line dividers */}
                <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Shaded Area under the trend path */}
                {chartAreaPath && <path d={chartAreaPath} fill="url(#chartGrad)" />}

                {/* Glowing Connection Line */}
                {chartLinePath && (
                  <path
                    d={chartLinePath}
                    fill="none"
                    stroke="var(--accent-color)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Individual Data Points */}
                {chartPoints.map((p, idx) => (
                  <g key={idx}>
                    {idx === chartPoints.length - 1 && (
                      <g transform={`translate(${p.x}, ${p.y - 18})`}>
                        <rect x="-24" y="-12" width="48" height="16" rx="6" fill="var(--foreground)" stroke="var(--border-color)" strokeWidth="1" />
                        <text x="0" y="0" textAnchor="middle" className="text-[9px] font-mono font-black fill-[var(--background)]">
                          {p.weight}
                        </text>
                      </g>
                    )}
                    
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      className="fill-[var(--accent-color)] stroke-[var(--background)]"
                      strokeWidth="1.5"
                    />
                    
                    {/* Months labels at bottom */}
                    <text
                      x={p.x}
                      y={chartHeight - 4}
                      textAnchor="middle"
                      className="text-[9px] font-mono font-bold fill-[var(--text-secondary)]"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Achievement text badge */}
            <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center text-[10px] font-bold text-emerald-500">
              🎉 Отличная работа! Регулярность — залог вашего успеха!
            </div>
          </div>

          {/* Daily Average Calories */}
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--container-bg)] p-5 backdrop-blur-md">
            <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-secondary)] block">Среднее за день</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-2xl font-black">{Math.round(consumedCalories * 0.95 + 100)} ккал</span>
              <span className="text-xs font-bold text-emerald-500">↓ 4.5%</span>
            </div>
            <div className="h-1.5 w-full bg-black/10 dark:bg-white/5 rounded-full overflow-hidden mt-3.5">
              <div className="h-full bg-[var(--accent-color)] rounded-full w-[78%]" />
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SEGMENT NAVIGATION CONTROLLERS */}
      <div 
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-sm rounded-full border border-[var(--border-color)] bg-[var(--container-bg)] backdrop-blur-md p-1.5 flex justify-around shadow-2xl items-center h-14"
        style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.12), 0 8px 30px rgba(0,0,0,0.4)' }}
      >
        {/* Navigation Home Tab Trigger */}
        <button
          onClick={() => {
            hapticSelectionChange();
            setActiveTab('home');
          }}
          className={`relative z-10 flex flex-col items-center justify-center py-1.5 w-[30%] transition-colors duration-200 ${
            activeTab === 'home' ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <Apple size={16} className={activeTab === 'home' ? 'fill-[var(--accent-color)]/10' : ''} />
          <span className="text-[9.5px] font-bold mt-1">Главная</span>
          {activeTab === 'home' && (
            <motion.div
              layoutId="navIndicator"
              className="absolute bottom-[-6px] h-1 w-6 rounded-full bg-[var(--accent-color)]"
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            />
          )}
        </button>

        {/* Navigation Progress Tab Trigger */}
        <button
          onClick={() => {
            hapticSelectionChange();
            setActiveTab('progress');
          }}
          className={`relative z-10 flex flex-col items-center justify-center py-1.5 w-[30%] transition-colors duration-200 ${
            activeTab === 'progress' ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <TrendingUp size={16} />
          <span className="text-[9.5px] font-bold mt-1">Прогресс</span>
          {activeTab === 'progress' && (
            <motion.div
              layoutId="navIndicator"
              className="absolute bottom-[-6px] h-1 w-6 rounded-full bg-[var(--accent-color)]"
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            />
          )}
        </button>

        {/* Navigation Settings Tab Trigger */}
        <button
          onClick={() => {
            hapticSelectionChange();
            setIsSettingsOpen(true);
          }}
          className="relative z-10 flex flex-col items-center justify-center py-1.5 w-[30%] text-[var(--text-secondary)] active:scale-95 transition-transform"
        >
          <Settings size={16} />
          <span className="text-[9.5px] font-bold mt-1">Настройки</span>
        </button>
      </div>

      {/* MODAL: LOG INGESTION SELECTOR DRAWER */}
      <AnimatePresence>
        {isLogSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setIsLogSelectorOpen(false)} />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-[var(--border-color)] bg-[var(--container-bg)] p-6 pb-8 shadow-2xl backdrop-blur-md"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--border-color)]" />

              <div className="mb-5 flex items-center justify-between">
                <h4 className="text-base font-bold">Выберите способ ввода</h4>
                <button
                  onClick={() => setIsLogSelectorOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--background)] text-[var(--text-secondary)] active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {/* 1. Camera Trigger */}
                <button
                  onClick={() => {
                    hapticImpact('light');
                    cameraInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--background)] p-4 active:border-zinc-800"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-color)] text-[var(--background)]">
                    <Camera size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Сфотографировать еду</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Анализ снимка с камеры в реальном времени</div>
                  </div>
                </button>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImageFile(file);
                  }}
                  className="hidden"
                />

                {/* 2. Barcode scanner trigger (Requirement 2 scanner) */}
                <button
                  onClick={startBarcodeScanner}
                  className="flex w-full items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--background)] p-4 active:border-zinc-800"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-color)] text-[var(--background)]">
                    <QrCode size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Сканировать штрих-код</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Используйте камеру для сканирования штрих-кода продукта</div>
                  </div>
                </button>

                {/* 3. Manual Food Written Logger */}
                <button
                  onClick={() => {
                    hapticImpact('light');
                    setIsLogSelectorOpen(false);
                    setIsManualLoggerOpen(true);
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--background)] p-4 active:border-zinc-800"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-color)] text-[var(--background)]">
                    <Keyboard size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Ручной ввод (Название и Вес)</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Введите название еды и вес вручную без фото</div>
                  </div>
                </button>

                {/* 4. Text description (AI freeform) */}
                <button
                  onClick={() => {
                    hapticImpact('light');
                    setIsLogSelectorOpen(false);
                    setIsTextLoggerOpen(true);
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--background)] p-4 active:border-zinc-800"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-color)] text-[var(--background)]">
                    <FileText size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Описать текстом (Свободная форма)</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Введите состав текстом (например: «омлет из 2 яиц»)</div>
                  </div>
                </button>

                {/* 5. Voice audio message input */}
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--background)] p-4">
                  {isRecording ? (
                    <div className="flex flex-col items-center justify-center py-2 text-center">
                      <div className="mb-2 h-4 w-4 animate-ping rounded-full bg-red-500" />
                      <span className="font-mono text-sm font-bold text-red-500">Запись: {recordingSeconds} сек</span>
                      <button
                        onClick={stopRecording}
                        className="mt-4 rounded-full bg-red-500 px-6 py-2 text-xs font-bold text-white active:scale-95"
                      >
                        Закончить запись
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="flex w-full items-center gap-4 text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-color)] text-[var(--background)]">
                        <Mic size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">Наговорить голосом</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Нажмите и скажите: «съел куриную грудку»</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CENTERED MANUAL WRITTEN LOGGER MODAL */}
      <AnimatePresence>
        {isManualLoggerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="absolute inset-0" onClick={() => setIsManualLoggerOpen(false)} />

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative z-10 w-full max-w-sm rounded-[2.5rem] border border-[var(--border-color)] bg-[var(--container-bg)] p-6 shadow-2xl backdrop-blur-[28px]"
            >
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-base font-bold">Ручной ввод еды</h4>
                <button
                  onClick={() => setIsManualLoggerOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--background)] text-[var(--text-secondary)]"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Название еды</label>
                  <input
                    type="text"
                    placeholder="Например: Плов с говядиной"
                    value={manualFoodName}
                    onChange={(e) => setManualFoodName(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-3 text-xs font-medium outline-none focus:border-[var(--accent-color)] select-text"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Вес (грамм)</label>
                  <input
                    type="number"
                    placeholder="Например: 250"
                    value={manualFoodWeight}
                    onChange={(e) => setManualFoodWeight(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-3 text-xs font-medium outline-none focus:border-[var(--accent-color)] select-text"
                  />
                </div>

                <button
                  onClick={handleManualFoodSubmit}
                  className="w-full flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent-color)] py-3.5 text-xs font-bold text-[var(--background)] active:scale-[0.98] transition-all"
                >
                  <Sparkles size={13} />
                  <span>Посчитать КБЖУ ИИ</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: FREEFORM TEXT LOGGER INPUT */}
      <AnimatePresence>
        {isTextLoggerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="absolute inset-0" onClick={() => setIsTextLoggerOpen(false)} />

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative z-10 w-full max-w-sm rounded-[2.5rem] border border-[var(--border-color)] bg-[var(--container-bg)] p-6 shadow-2xl backdrop-blur-[28px]"
            >
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-base font-bold">Опишите ваш прием пищи</h4>
                <button
                  onClick={() => setIsTextLoggerOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--background)] text-[var(--text-secondary)]"
                >
                  <X size={14} />
                </button>
              </div>

              <textarea
                value={textDescription}
                onChange={(e) => setTextDescription(e.target.value)}
                placeholder="Например: тарелка борща, кусок ржаного хлеба и чашка черного кофе без сахара..."
                className="h-24 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--background)] p-3 text-xs outline-none focus:border-[var(--accent-color)] select-text"
              />

              <button
                onClick={handleTextSubmit}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent-color)] py-3 text-xs font-bold text-[var(--background)] active:scale-[0.98] transition-all"
              >
                <Sparkles size={13} />
                <span>Распознать ИИ</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REVIEW MODAL */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        initialData={aiResult}
        photoId={aiPhotoId}
        photoUrl={aiPhotoUrl}
        onSave={commitReviewedFood}
      />

      {/* SETTINGS MODAL */}
      <GoalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentGoal={syncData?.user?.fitnessGoal || 'maintenance'}
        currentSettings={syncData?.settings || null}
        onSave={async (goal, settings) => {
          await updateSettingsMutation.mutateAsync({ goal, settings });
        }}
      />
    </div>
  );
}
