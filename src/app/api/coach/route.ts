import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { DATE_RE, HttpError, handleError, requireUserId } from '@/lib/server/api';
import { AIService } from '@/lib/server/ai-service';
import { buildCoachPrompt, buildLocalReport, type CoachContext } from '@/lib/server/coach';
import { loadDayStats } from '@/lib/server/stats';
import { addDays } from '@/lib/date';
import { z } from 'zod';

const aiService = new AIService();

const CoachRequestSchema = z.object({
  days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  // The client's local "today" (YYYY-MM-DD): the server must not guess the user's timezone
  today: z.string().regex(DATE_RE),
});

const avg = (values: number[]) => (values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length));

/**
 * POST: nutrition coaching report for the last N days.
 * Uses the AI provider when available and falls back to a rule-based report otherwise.
 */
export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const { days, today } = CoachRequestSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { settings: true } });
    if (!user?.settings) throw new HttpError(404, 'User not found');

    const from = addDays(today, -(days - 1));
    const [daily, weightRows, foodRows] = await Promise.all([
      loadDayStats(userId, from, today),
      prisma.weightEntry.findMany({
        where: { userId, date: { gte: from, lte: today } },
        orderBy: { date: 'asc' },
      }),
      prisma.foodItem.findMany({
        where: { dailyLog: { userId, date: { gte: from, lte: today } } },
        select: { name: true },
      }),
    ]);

    const foodDays = daily.filter((d) => d.meals > 0);
    const waterDays = daily.filter((d) => d.waterMl > 0);

    const foodCounts = new Map<string, { name: string; count: number }>();
    for (const { name } of foodRows) {
      const key = name.trim().toLowerCase();
      const cur = foodCounts.get(key) ?? { name: name.trim(), count: 0 };
      cur.count += 1;
      foodCounts.set(key, cur);
    }

    const first = weightRows[0];
    const last = weightRows[weightRows.length - 1];

    const ctx: CoachContext = {
      days,
      goal: user.fitnessGoal,
      targets: {
        calories: user.settings.calorieTarget,
        protein: user.settings.proteinTarget,
        fat: user.settings.fatTarget,
        carbs: user.settings.carbTarget,
        waterMl: user.settings.waterTarget,
      },
      loggedDays: foodDays.length,
      averages: {
        calories: avg(foodDays.map((d) => d.calories)),
        protein: avg(foodDays.map((d) => d.protein)),
        fat: avg(foodDays.map((d) => d.fat)),
        carbs: avg(foodDays.map((d) => d.carbs)),
        waterMl: avg(waterDays.map((d) => d.waterMl)),
      },
      daily,
      weight:
        first && last && first.id !== last.id
          ? {
              startKg: first.weightKg,
              endKg: last.weightKg,
              changeKg: Math.round((last.weightKg - first.weightKg) * 10) / 10,
            }
          : null,
      topFoods: [...foodCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    };

    let source: 'ai' | 'local' = 'local';
    let report = buildLocalReport(ctx);

    // Nothing to analyse without food logs: skip the AI call
    if (ctx.loggedDays > 0) {
      try {
        const provider = (user.settings.preferredAiProvider as 'gemini' | 'openai') || 'gemini';
        report = await aiService.generateCoachReport(buildCoachPrompt(ctx), provider);
        source = 'ai';
      } catch (e: any) {
        console.warn('⚠️ [COACH] AI report unavailable, using local analysis:', e.message);
      }
    }

    return NextResponse.json({
      success: true,
      source,
      report,
      summary: { days, loggedDays: ctx.loggedDays, averages: ctx.averages, weight: ctx.weight },
    });
  } catch (error) {
    return handleError('COACH-POST', error);
  }
}
