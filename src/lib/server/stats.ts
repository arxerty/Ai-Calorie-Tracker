import { prisma } from '@/lib/server/prisma';

export interface DayStats {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  meals: number;
  waterMl: number;
}

/**
 * Per-day totals (calories, macros, number of logged items, water) for an inclusive date range.
 * Only days that have food or water are returned; the client fills in the gaps.
 */
export async function loadDayStats(userId: string, from: string, to: string): Promise<DayStats[]> {
  const [logs, water] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: { foodItems: true },
    }),
    prisma.waterLog.findMany({ where: { userId, date: { gte: from, lte: to } } }),
  ]);

  const byDate = new Map<string, DayStats>();
  const entry = (date: string) => {
    let s = byDate.get(date);
    if (!s) {
      s = { date, calories: 0, protein: 0, fat: 0, carbs: 0, meals: 0, waterMl: 0 };
      byDate.set(date, s);
    }
    return s;
  };

  for (const log of logs) {
    if (log.foodItems.length === 0) continue;
    const s = entry(log.date);
    for (const item of log.foodItems) {
      s.calories += item.calories;
      s.protein += item.proteinG;
      s.fat += item.fatG;
      s.carbs += item.carbsG;
      s.meals += 1;
    }
  }
  for (const w of water) {
    if (w.ml > 0) entry(w.date).waterMl = w.ml;
  }

  return [...byDate.values()]
    .map((s) => ({
      ...s,
      calories: Math.round(s.calories),
      protein: Math.round(s.protein),
      fat: Math.round(s.fat),
      carbs: Math.round(s.carbs),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
