import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { verifyTelegramAuth } from '@/lib/server/telegram-auth';
import { calculateTargets } from '@/lib/nutrition';
import { z } from 'zod';

const SettingsUpdateSchema = z.object({
  preferredAiProvider: z.enum(['gemini', 'openai']).optional(),
  darkMode: z.boolean().optional(),
  calorieTarget: z.number().int().positive().optional(),
  proteinTarget: z.number().int().positive().optional(),
  fatTarget: z.number().int().positive().optional(),
  carbTarget: z.number().int().positive().optional(),
  waterTarget: z.number().int().min(500).max(10000).optional(),
  fitnessGoal: z.string().optional(),

  // Physical parameters for BMR/TDEE calculations (null = not provided)
  isOnboarded: z.boolean().optional(),
  weight: z.number().positive().nullish(),
  height: z.number().positive().nullish(),
  age: z.number().int().positive().nullish(),
  gender: z.enum(['male', 'female']).nullish(),
});

export async function PUT(request: Request) {
  try {
    const initDataRaw = request.headers.get('x-telegram-init-data');
    if (!initDataRaw) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const tgUser = verifyTelegramAuth(initDataRaw);
    const userId = String(tgUser.id);

    const body = await request.json();
    const data = SettingsUpdateSchema.parse(body);

    const { fitnessGoal, ...settingsData } = data;

    // 1. Fetch current settings to read existing physical params
    const current = await prisma.userSettings.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!current) {
      return NextResponse.json({ success: false, error: 'UserSettings not found' }, { status: 404 });
    }

    // Determine final values
    const finalWeight = settingsData.weight ?? current.weight;
    const finalHeight = settingsData.height ?? current.height;
    const finalAge = settingsData.age ?? current.age;
    const finalGender = settingsData.gender ?? current.gender;
    const finalGoal = fitnessGoal ?? current.user.fitnessGoal;

    // 2. Perform Onboarding Calculations if physical parameters exist (Mifflin-St Jeor)
    const calculated = calculateTargets({
      weight: finalWeight,
      height: finalHeight,
      age: finalAge,
      gender: finalGender,
      goal: finalGoal,
    });

    // Merge calculated targets into final settings payload if not explicitly overridden
    if (calculated) {
      if (settingsData.calorieTarget === undefined) settingsData.calorieTarget = calculated.calories;
      if (settingsData.proteinTarget === undefined) settingsData.proteinTarget = calculated.protein;
      if (settingsData.fatTarget === undefined) settingsData.fatTarget = calculated.fat;
      if (settingsData.carbTarget === undefined) settingsData.carbTarget = calculated.carbs;
    }

    // 3. Update database settings
    const updatedSettings = await prisma.userSettings.update({
      where: { userId },
      data: settingsData,
    });

    // 4. Update user fitness goal
    if (fitnessGoal) {
      await prisma.user.update({
        where: { id: userId },
        data: { fitnessGoal },
      });
    }

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });

  } catch (error: any) {
    console.error('🔴 [SETTINGS-PUT] Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('signature') ? 401 : 500 }
    );
  }
}
