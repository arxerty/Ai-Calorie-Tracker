import { z } from 'zod';
import type { DayStats } from '@/lib/server/stats';

export const CoachReportSchema = z.object({
  headline: z.string().describe('Короткий заголовок разбора, до 60 символов'),
  summary: z.string().describe('Общий вывод в 2-3 предложения'),
  wins: z.array(z.string()).describe('Что получается хорошо'),
  improvements: z.array(z.string()).describe('Что стоит улучшить'),
  next_steps: z.array(z.string()).describe('Конкретные шаги на следующую неделю'),
});

export type CoachReport = z.infer<typeof CoachReportSchema>;

export interface CoachContext {
  days: number; // length of the analysed window
  goal: string; // weight_loss | maintenance | muscle_gain
  targets: { calories: number; protein: number; fat: number; carbs: number; waterMl: number };
  loggedDays: number;
  averages: { calories: number; protein: number; fat: number; carbs: number; waterMl: number }; // per logged day
  daily: DayStats[];
  weight: { startKg: number; endKg: number; changeKg: number } | null;
  topFoods: { name: string; count: number }[];
}

const GOAL_RU: Record<string, string> = {
  weight_loss: 'похудение',
  maintenance: 'поддержание веса',
  muscle_gain: 'набор мышечной массы',
};

export const COACH_SYSTEM_PROMPT = `
Вы — внимательный ИИ-диетолог внутри приложения для подсчёта калорий.
Вам дают сводку питания пользователя за несколько дней: цели, средние значения, данные по дням, динамику веса и частые продукты.

Правила:
1. Отвечайте строго в формате JSON без текста до или после.
2. Язык — русский, тон дружелюбный и конкретный, обращение на «вы».
3. Опирайтесь только на присланные цифры. Не выдумывайте данные, которых нет.
4. В каждом списке — от 1 до 4 коротких пунктов (одно предложение).
5. Шаги должны быть практичными и выполнимыми на следующей неделе.
6. Не ставьте диагнозов и не давайте медицинских назначений. При явно экстремальных значениях мягко советуйте обратиться к врачу.
`;

export function buildCoachPrompt(ctx: CoachContext): string {
  const lines = [
    `Период анализа: последние ${ctx.days} дн., дней с записями: ${ctx.loggedDays}.`,
    `Цель пользователя: ${GOAL_RU[ctx.goal] ?? ctx.goal}.`,
    `Дневные цели: ${ctx.targets.calories} ккал, белки ${ctx.targets.protein} г, жиры ${ctx.targets.fat} г, углеводы ${ctx.targets.carbs} г, вода ${ctx.targets.waterMl} мл.`,
    `Среднее за день с записями: ${ctx.averages.calories} ккал, белки ${ctx.averages.protein} г, жиры ${ctx.averages.fat} г, углеводы ${ctx.averages.carbs} г, вода ${ctx.averages.waterMl} мл.`,
  ];

  if (ctx.weight) {
    const sign = ctx.weight.changeKg > 0 ? '+' : '';
    lines.push(`Вес: ${ctx.weight.startKg} → ${ctx.weight.endKg} кг (${sign}${ctx.weight.changeKg} кг).`);
  } else {
    lines.push('Вес за период не записывался.');
  }

  if (ctx.topFoods.length > 0) {
    lines.push(`Частые блюда: ${ctx.topFoods.map((f) => `${f.name} (${f.count})`).join(', ')}.`);
  }

  lines.push('', 'По дням (дата: ккал / Б / Ж / У / вода мл):');
  for (const d of ctx.daily) {
    lines.push(`${d.date}: ${d.calories} / ${d.protein} / ${d.fat} / ${d.carbs} / ${d.waterMl}`);
  }

  return lines.join('\n');
}

const MIN_DAYS_FOR_ANALYSIS = 3;

const fmtKg = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`;

/**
 * Rule-based report used when no AI provider is configured or all of them fail.
 */
export function buildLocalReport(ctx: CoachContext): CoachReport {
  // One or two logged days say nothing about habits: don't pass judgement on them
  if (ctx.loggedDays < MIN_DAYS_FOR_ANALYSIS) {
    return {
      headline: 'Пока мало данных',
      summary:
        ctx.loggedDays === 0
          ? `За последние ${ctx.days} дн. нет ни одной записи о еде, поэтому разбирать нечего.`
          : `За последние ${ctx.days} дн. есть записей только за ${ctx.loggedDays} дн. Для осмысленного разбора нужно хотя бы ${MIN_DAYS_FOR_ANALYSIS}.`,
      wins: [],
      improvements: [],
      next_steps: ['Записывайте приёмы пищи в течение нескольких дней — тогда появится разбор с выводами.'],
    };
  }

  const wins: string[] = [];
  const improvements: string[] = [];
  const nextSteps: string[] = [];
  const { averages: avg, targets: t } = ctx;

  // Calories
  const calRatio = avg.calories / (t.calories || 1);
  const calDiff = Math.abs(Math.round(avg.calories - t.calories));
  if (calRatio >= 0.9 && calRatio <= 1.1) {
    wins.push(`Калорийность держится у цели: в среднем ${avg.calories} ккал при цели ${t.calories}.`);
  } else if (calRatio > 1.1) {
    improvements.push(`В среднем вы съедаете на ${calDiff} ккал больше цели (${avg.calories} из ${t.calories}).`);
    nextSteps.push('Сократите самый калорийный приём пищи или перекусы — этого обычно хватает, чтобы вернуться к цели.');
  } else {
    improvements.push(`В среднем вы недоедаете ${calDiff} ккал до цели (${avg.calories} из ${t.calories}).`);
    nextSteps.push('Добавьте к одному из приёмов пищи полноценный белковый продукт, чтобы приблизиться к цели.');
  }

  // Protein
  const protRatio = avg.protein / (t.protein || 1);
  if (protRatio >= 0.9) {
    wins.push(`Белка достаточно: ${avg.protein} г в день при цели ${t.protein} г.`);
  } else {
    improvements.push(`Белка мало: ${avg.protein} г в день при цели ${t.protein} г.`);
    nextSteps.push('Добавляйте источник белка в каждый приём пищи: яйца, творог, рыбу, птицу или бобовые.');
  }

  // Consistency
  const consistency = ctx.loggedDays / ctx.days;
  if (consistency >= 0.8) {
    wins.push(`Вы ведёте дневник почти каждый день: ${ctx.loggedDays} из ${ctx.days}.`);
  } else if (consistency < 0.5) {
    improvements.push(`Записи есть только за ${ctx.loggedDays} из ${ctx.days} дней, поэтому картина неполная.`);
    nextSteps.push('Старайтесь записывать еду сразу после приёма пищи — так не придётся вспоминать вечером.');
  }

  // Water
  if (avg.waterMl > 0) {
    if (avg.waterMl >= t.waterMl * 0.9) {
      wins.push(`Питьевой режим в порядке: в среднем ${avg.waterMl} мл при цели ${t.waterMl} мл.`);
    } else {
      improvements.push(`Воды мало: в среднем ${avg.waterMl} мл при цели ${t.waterMl} мл.`);
      nextSteps.push('Ставьте стакан воды рядом с рабочим местом и отмечайте его в приложении.');
    }
  } else {
    nextSteps.push('Попробуйте отмечать воду в приложении — это помогает достичь дневной нормы.');
  }

  // Weight vs. goal
  if (ctx.weight) {
    const { changeKg } = ctx.weight;
    if (ctx.goal === 'weight_loss' && changeKg < -0.1) {
      wins.push(`Вес снижается: ${fmtKg(changeKg)} кг за период.`);
    } else if (ctx.goal === 'muscle_gain' && changeKg > 0.1) {
      wins.push(`Вес растёт в нужную сторону: ${fmtKg(changeKg)} кг за период.`);
    } else if (ctx.goal === 'maintenance' && Math.abs(changeKg) <= 0.5) {
      wins.push(`Вес стабилен: ${fmtKg(changeKg)} кг за период.`);
    } else {
      improvements.push(`Динамика веса (${fmtKg(changeKg)} кг) пока не совпадает с целью.`);
    }
  }

  const headline =
    improvements.length === 0
      ? 'Отличная неделя'
      : wins.length >= improvements.length
        ? 'Хороший ход, есть что улучшить'
        : 'Есть над чем поработать';

  return {
    headline,
    summary: `За ${ctx.days} дн. вы вели записи ${ctx.loggedDays} дн. В среднем ${avg.calories} ккал, белки ${avg.protein} г, жиры ${avg.fat} г, углеводы ${avg.carbs} г в день.`,
    wins,
    improvements,
    next_steps: nextSteps.slice(0, 3),
  };
}
