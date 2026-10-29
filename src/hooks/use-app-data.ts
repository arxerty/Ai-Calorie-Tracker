'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTma } from '@/components/tma-provider';
import { toDateStr } from '@/lib/date';
import type {
  CoachResponse,
  DayStats,
  Favorite,
  FoodItem,
  NewFood,
  QuickFood,
  SyncData,
  UserSettings,
  WeightEntry,
} from '@/lib/types';
import type { MealType } from '@/lib/nutrition';

/** fetch wrapper: adds the Telegram auth header, parses JSON and throws on `success: false`. */
export function useApi() {
  const { initDataRaw } = useTma();

  return useCallback(
    async <T = any>(path: string, init: RequestInit = {}): Promise<T> => {
      const hasJsonBody = typeof init.body === 'string';
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
          'x-telegram-init-data': initDataRaw,
          ...init.headers,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Запрос не выполнен (${res.status})`);
      }
      return data as T;
    },
    [initDataRaw]
  );
}

// ---------------------------------------------------------------- user

export function useSync() {
  const { initDataRaw } = useTma();
  return useQuery<SyncData>({
    queryKey: ['user-sync', initDataRaw],
    queryFn: async () => {
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
}

export function useUpdateSettings() {
  const api = useApi();
  const qc = useQueryClient();
  const { initDataRaw } = useTma();

  return useMutation({
    mutationFn: ({ goal, settings }: { goal?: string; settings: Partial<UserSettings> }) =>
      api('/api/user/settings', { method: 'PUT', body: JSON.stringify({ ...settings, fitnessGoal: goal }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-sync', initDataRaw] }),
  });
}

// ---------------------------------------------------------------- food log

export function useDayLog(date: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: ['logs', date],
    queryFn: async () => {
      const data = await api<{ log: { foodItems: FoodItem[] } }>(`/api/logs?date=${date}`);
      return data.log.foodItems;
    },
    enabled,
  });
}

export function useFoodMutations() {
  const api = useApi();
  const qc = useQueryClient();
  const { initDataRaw } = useTma();

  const afterChange = (streakDays?: number) => {
    qc.invalidateQueries({ queryKey: ['logs'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['favorites'] });
    if (streakDays !== undefined) {
      qc.setQueryData<SyncData>(['user-sync', initDataRaw], (old) =>
        old ? { ...old, user: { ...old.user, streakDays } } : old
      );
    }
  };

  const add = useMutation({
    mutationFn: (food: NewFood) =>
      api<{ foodItem: FoodItem; streakDays: number }>('/api/logs', { method: 'POST', body: JSON.stringify(food) }),
    onSuccess: (data) => afterChange(data.streakDays),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<{ streakDays: number }>(`/api/logs?id=${id}`, { method: 'DELETE' }),
    onSuccess: (data) => afterChange(data.streakDays),
  });

  const patch = useMutation({
    mutationFn: (p: { id: string; mealType?: MealType; scale?: number }) =>
      api('/api/logs', { method: 'PATCH', body: JSON.stringify(p) }),
    onSuccess: () => afterChange(),
  });

  return { add, remove, patch };
}

// ---------------------------------------------------------------- water

export function useWater(date: string, enabled: boolean) {
  const api = useApi();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['water', date],
    queryFn: async () => (await api<{ ml: number }>(`/api/water?date=${date}`)).ml,
    enabled,
  });

  const add = useMutation({
    mutationFn: (deltaMl: number) => api<{ ml: number }>('/api/water', { method: 'POST', body: JSON.stringify({ date, deltaMl }) }),
    // Optimistic: the counter must react instantly to taps
    onMutate: async (deltaMl) => {
      await qc.cancelQueries({ queryKey: ['water', date] });
      const prev = qc.getQueryData<number>(['water', date]) ?? 0;
      qc.setQueryData(['water', date], Math.max(0, prev + deltaMl));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['water', date], ctx?.prev ?? 0),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['water', date] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  return { ml: query.data ?? 0, add };
}

// ---------------------------------------------------------------- stats & weight

export function useStats(from: string, to: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: ['stats', from, to],
    queryFn: async () => (await api<{ days: DayStats[] }>(`/api/stats?from=${from}&to=${to}`)).days,
    enabled,
  });
}

export function useWeight(enabled: boolean) {
  const api = useApi();
  const qc = useQueryClient();
  const { initDataRaw } = useTma();

  const query = useQuery({
    queryKey: ['weight'],
    queryFn: async () => (await api<{ entries: WeightEntry[] }>('/api/weight')).entries,
    enabled,
  });

  const onDone = () => {
    qc.invalidateQueries({ queryKey: ['weight'] });
    qc.invalidateQueries({ queryKey: ['user-sync', initDataRaw] });
  };

  const add = useMutation({
    mutationFn: (p: { date: string; weightKg: number }) => api('/api/weight', { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: onDone,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/weight?id=${id}`, { method: 'DELETE' }),
    onSuccess: onDone,
  });

  return { entries: query.data ?? [], isLoading: query.isLoading, add, remove };
}

// ---------------------------------------------------------------- favorites

export function useFavorites(enabled: boolean) {
  const api = useApi();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api<{ favorites: Favorite[]; recent: QuickFood[] }>('/api/favorites'),
    enabled,
  });

  const add = useMutation({
    mutationFn: (food: QuickFood) => api('/api/favorites', { method: 'POST', body: JSON.stringify(food) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/favorites?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  return {
    favorites: query.data?.favorites ?? [],
    recent: query.data?.recent ?? [],
    add,
    remove,
  };
}

// ---------------------------------------------------------------- coach

/** Manual-trigger query: the report is only generated when the user asks, then cached per period. */
export function useCoach(days: 7 | 14 | 30) {
  const api = useApi();
  return useQuery({
    queryKey: ['coach', days],
    queryFn: () =>
      api<CoachResponse>('/api/coach', { method: 'POST', body: JSON.stringify({ days, today: toDateStr() }) }),
    enabled: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
  });
}
