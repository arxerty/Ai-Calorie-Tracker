import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { verifyTelegramAuth } from '@/lib/server/telegram-auth';
import { z } from 'zod';

const SyncRequestSchema = z.object({
  initData: z.string(),
  fitnessGoal: z.string().optional(),
  preferredAiProvider: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    let initData = '';
    let fitnessGoal = 'maintenance';
    let preferredAiProvider = 'gemini';

    // Robust request body / header parsing
    try {
      const body = await request.json();
      const parsed = SyncRequestSchema.parse(body);
      initData = parsed.initData;
      fitnessGoal = parsed.fitnessGoal || 'maintenance';
      preferredAiProvider = parsed.preferredAiProvider || 'gemini';
    } catch (e) {
      const headerInit = request.headers.get('x-telegram-init-data');
      if (headerInit) {
        initData = headerInit;
      } else {
        return NextResponse.json({ success: false, error: 'Missing initData payload or header' }, { status: 400 });
      }
    }
    
    // 1. Verify Telegram Authentication cryptographically
    const telegramUser = verifyTelegramAuth(initData);
    const telegramId = String(telegramUser.id);
    
    // 2. Fetch or Create User with default settings
    let user = await prisma.user.findUnique({
      where: { id: telegramId },
      include: { settings: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: telegramId,
          fitnessGoal: fitnessGoal || 'maintenance',
          settings: {
            create: {
              preferredAiProvider: preferredAiProvider || 'gemini',
              darkMode: true,
              isOnboarded: false,
              calorieTarget: fitnessGoal === 'weight_loss' ? 1600 : fitnessGoal === 'muscle_gain' ? 2400 : 2000,
              proteinTarget: fitnessGoal === 'weight_loss' ? 120 : fitnessGoal === 'muscle_gain' ? 150 : 130,
              fatTarget: 70,
              carbTarget: fitnessGoal === 'weight_loss' ? 160 : fitnessGoal === 'muscle_gain' ? 290 : 210,
            },
          },
        },
        include: { settings: true },
      });
    }

    // 3. Dynamic Streak Recalculation
    const recentLogs = await prisma.dailyLog.findMany({
      where: {
        userId: telegramId,
        foodItems: { some: {} }, // only logs containing at least one item
      },
      orderBy: { date: 'desc' },
      take: 2,
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = user.streakDays;

    if (recentLogs.length === 0) {
      newStreak = 0;
    } else {
      const latestLogDate = recentLogs[0].date;
      if (latestLogDate !== todayStr && latestLogDate !== yesterdayStr) {
        newStreak = 0;
      }
    }

    if (newStreak !== user.streakDays) {
      user = await prisma.user.update({
        where: { id: telegramId },
        data: { streakDays: newStreak },
        include: { settings: true },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        streakDays: user.streakDays,
        fitnessGoal: user.fitnessGoal,
        createdAt: user.createdAt,
      },
      settings: user.settings,
    });

  } catch (error: any) {
    console.error('🔴 [USER-SYNC] Error syncing user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('signature') || error.message?.includes('expired') ? 401 : 500 }
    );
  }
}
