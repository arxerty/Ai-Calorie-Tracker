// Shared (client + server) nutrition helpers. Safe to import from both sides: no Node-only APIs.

export type Goal = 'weight_loss' | 'maintenance' | 'muscle_gain';
export type Gender = 'male' | 'female';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Targets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const GOALS: { id: Goal; label: string }[] = [
  { id: 'weight_loss', label: 'Похудение' },
  { id: 'maintenance', label: 'Поддержание' },
  { id: 'muscle_gain', label: 'Набор массы' },
];

export const MEAL_TYPES: { id: MealType; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Завтрак', emoji: '🍳' },
  { id: 'lunch', label: 'Обед', emoji: '🥗' },
  { id: 'dinner', label: 'Ужин', emoji: '🍝' },
  { id: 'snack', label: 'Перекус', emoji: '🍎' },
];

export function isMealType(v: unknown): v is MealType {
  return v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack';
}

export function goalLabel(goal?: string | null): string {
  return GOALS.find((g) => g.id === goal)?.label ?? 'Поддержание';
}

/** Meal slot by time of day. */
export function mealTypeForHour(hour: number): MealType {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 21) return 'dinner';
  return 'snack';
}

export function defaultMealType(now: Date = new Date()): MealType {
  return mealTypeForHour(now.getHours());
}

/**
 * Daily targets from Mifflin-St Jeor BMR with a light-activity multiplier.
 * Returns null until all body parameters are known.
 */
export function calculateTargets(p: {
  weight?: number | null;
  height?: number | null;
  age?: number | null;
  gender?: Gender | string | null;
  goal?: Goal | string | null;
}): Targets | null {
  const { weight, height, age, gender, goal } = p;
  if (!weight || !height || !age || !gender) return null;

  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const tdee = bmr * 1.375;
  const minCals = gender === 'male' ? 1500 : 1200;

  let calories = Math.round(tdee);
  if (goal === 'weight_loss') calories = Math.max(minCals, Math.round(tdee - 500));
  else if (goal === 'muscle_gain') calories = Math.round(tdee + 300);

  const protein = Math.round((goal === 'maintenance' ? 1.6 : 2.0) * weight);
  const fat = Math.round(0.9 * weight);
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, fat, carbs };
}

/** ~30 ml per kg of body weight, rounded to 50 ml. */
export function suggestWaterTarget(weight?: number | null): number {
  if (!weight) return 2000;
  return Math.min(4000, Math.max(1500, Math.round((weight * 30) / 50) * 50));
}

/** Rough 3–10 score from the protein/fat share of calories. */
export function healthScore(calories: number, protein: number, fat: number): number {
  const total = calories || 1;
  const proteinRatio = (protein * 4) / total;
  const fatRatio = (fat * 9) / total;
  let score = 5;
  if (proteinRatio > 0.25) score += 2;
  if (proteinRatio > 0.35) score += 1;
  if (fatRatio < 0.3) score += 2;
  if (fatRatio > 0.45) score -= 1;
  return Math.max(3, Math.min(10, score));
}
