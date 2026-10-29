import type { Gender, MealType } from '@/lib/nutrition';

export interface UserSettings {
  preferredAiProvider: string;
  darkMode: boolean;
  calorieTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbTarget: number;
  waterTarget: number;
  isOnboarded: boolean;
  weight: number | null;
  height: number | null;
  age: number | null;
  gender: Gender | null;
}

export interface SyncData {
  user: { id: string; streakDays: number; fitnessGoal: string; createdAt: string };
  settings: UserSettings;
}

export interface FoodItem {
  id: string;
  name: string;
  weightG: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  mealType: MealType | null;
  createdAt: string;
  photo?: { url: string } | null;
}

export interface NewFood {
  name: string;
  weightG: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  mealType: MealType;
  photoId?: string;
  /** Defaults to the currently selected day */
  date?: string;
}

/** A dish that can be re-logged in one tap (favorite or recent). */
export interface QuickFood {
  name: string;
  weightG: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface Favorite extends QuickFood {
  id: string;
}

export interface DayStats {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  meals: number;
  waterMl: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export interface FoodAnalysis {
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

export interface CoachReport {
  headline: string;
  summary: string;
  wins: string[];
  improvements: string[];
  next_steps: string[];
}

export interface CoachResponse {
  source: 'ai' | 'local';
  report: CoachReport;
  summary: {
    days: number;
    loggedDays: number;
    averages: { calories: number; protein: number; fat: number; carbs: number; waterMl: number };
    weight: { startKg: number; endKg: number; changeKg: number } | null;
  };
}
