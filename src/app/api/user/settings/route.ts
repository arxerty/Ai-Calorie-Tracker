import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { verifyTelegramAuth } from '@/lib/server/telegram-auth';
import { z } from 'zod';

const SettingsUpdateSchema = z.object({
  preferredAiProvider: z.enum(['gemini', 'openai']).optional(),
  darkMode: z.boolean().optional(),
  calorieTarget: z.number().int().positive().optional(),
  proteinTarget: z.number().int().positive().optional(),
  fatTarget: z.number().int().positive().optional(),
  carbTarget: z.number().int().positive().optional(),
  fitnessGoal: z.string().optional(),
  
  // Physical parameters for BMR/TDEE calculations
  isOnboarded: z.boolean().optional(),
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  age: z.number().int().positive().optional(),
  gender: z.enum(['male', 'female']).optional(),
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
    if (finalWeight && finalHeight && finalAge && finalGender) {
      let bmr = 0;
      if (finalGender === 'male') {
        bmr = 10 * finalWeight + 6.25 * finalHeight - 5 * finalAge + 5;
      } else {
        bmr = 10 * finalWeight + 6.25 * finalHeight - 5 * finalAge - 161;
      }

      // Moderate activity index
      const tdee = bmr * 1.375;

      let calorieTarget = Math.round(tdee);
      const minCals = finalGender === 'male' ? 1500 : 1200;

      if (finalGoal === 'weight_loss') {
        calorieTarget = Math.max(minCals, Math.round(tdee - 500));
      } else if (finalGoal === 'muscle_gain') {
        calorieTarget = Math.round(tdee + 300);
      }

      // Macro distributions:
      // Protein: 2.0g per kg of bodyweight for weight loss/muscle gain, 1.6g for maintenance
      const proteinTarget = Math.round((finalGoal === 'maintenance' ? 1.6 : 2.0) * finalWeight);
      // Fat: 0.9g per kg of bodyweight
      const fatTarget = Math.round(0.9 * finalWeight);
      // Carbs: Remaining calories allocated to carbs (4 kcal/g)
      const remainingCals = calorieTarget - (proteinTarget * 4) - (fatTarget * 9);
      const carbTarget = Math.max(50, Math.round(remainingCals / 4));

      // Merge Mifflin-calculated targets into final settings payload if not explicitly overridden
      if (settingsData.calorieTarget === undefined) settingsData.calorieTarget = calorieTarget;
      if (settingsData.proteinTarget === undefined) settingsData.proteinTarget = proteinTarget;
      if (settingsData.fatTarget === undefined) settingsData.fatTarget = fatTarget;
      if (settingsData.carbTarget === undefined) settingsData.carbTarget = carbTarget;
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
