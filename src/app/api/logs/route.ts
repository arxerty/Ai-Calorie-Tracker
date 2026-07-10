import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { verifyTelegramAuth } from '@/lib/server/telegram-auth';
import { z } from 'zod';

const AddFoodSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  name: z.string().min(1),
  weightG: z.number().positive(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  photoId: z.string().uuid().optional(),
});

/**
 * GET: Retrieve food logs for a user on a specific date
 */
export async function GET(request: Request) {
  try {
    const initDataRaw = request.headers.get('x-telegram-init-data');
    if (!initDataRaw) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const tgUser = verifyTelegramAuth(initDataRaw);
    const userId = String(tgUser.id);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'Invalid date parameter. Use YYYY-MM-DD.' }, { status: 400 });
    }

    // Fetch the log with all items and photos
    const dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: { userId, date },
      },
      include: {
        foodItems: {
          include: {
            photo: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      log: dailyLog || { userId, date, foodItems: [] },
    });

  } catch (error: any) {
    console.error('🔴 [LOGS-GET] Error fetching daily logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('signature') ? 401 : 500 }
    );
  }
}

/**
 * POST: Add a new food item (manual or confirmed from AI)
 */
export async function POST(request: Request) {
  try {
    const initDataRaw = request.headers.get('x-telegram-init-data');
    if (!initDataRaw) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const tgUser = verifyTelegramAuth(initDataRaw);
    const userId = String(tgUser.id);

    const body = await request.json();
    const data = AddFoodSchema.parse(body);

    // 1. Get or Create DailyLog
    let dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: { userId, date: data.date },
      },
      include: {
        foodItems: true,
      },
    });

    const isFirstLogOfToday = !dailyLog || dailyLog.foodItems.length === 0;

    if (!dailyLog) {
      dailyLog = await prisma.dailyLog.create({
        data: {
          userId,
          date: data.date,
        },
        include: {
          foodItems: true,
        },
      });
    }

    // 2. Create the FoodItem
    const foodItem = await prisma.foodItem.create({
      data: {
        dailyLogId: dailyLog.id,
        name: data.name,
        weightG: data.weightG,
        calories: data.calories,
        proteinG: data.proteinG,
        fatG: data.fatG,
        carbsG: data.carbsG,
      },
    });

    // 3. Link Photo if photoId is provided
    if (data.photoId) {
      // Confirm the photo belongs to the user and link it
      await prisma.mealPhoto.updateMany({
        where: { id: data.photoId, userId },
        data: { foodItemId: foodItem.id },
      });
    }

    // 4. Update user streak if this is the first meal logged today
    let streakDays = 0;
    if (isFirstLogOfToday) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        // Check if they logged yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const yesterdayLog = await prisma.dailyLog.findUnique({
          where: { userId_date: { userId, date: yesterdayStr } },
          include: { foodItems: true },
        });

        const loggedYesterday = yesterdayLog && yesterdayLog.foodItems.length > 0;
        
        let newStreak = 1;
        if (loggedYesterday) {
          newStreak = user.streakDays + 1;
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { streakDays: newStreak },
        });
        streakDays = updatedUser.streakDays;
      }
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      streakDays = user?.streakDays || 0;
    }

    return NextResponse.json({
      success: true,
      foodItem,
      streakDays,
    });

  } catch (error: any) {
    console.error('🔴 [LOGS-POST] Error logging food:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('signature') ? 401 : 500 }
    );
  }
}

/**
 * DELETE: Remove a logged food item
 */
export async function DELETE(request: Request) {
  try {
    const initDataRaw = request.headers.get('x-telegram-init-data');
    if (!initDataRaw) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const tgUser = verifyTelegramAuth(initDataRaw);
    const userId = String(tgUser.id);

    const { searchParams } = new URL(request.url);
    const foodItemId = searchParams.get('id');

    if (!foodItemId) {
      return NextResponse.json({ success: false, error: 'Missing food item ID' }, { status: 400 });
    }

    // Verify ownership: foodItem -> dailyLog -> user
    const foodItem = await prisma.foodItem.findUnique({
      where: { id: foodItemId },
      include: {
        dailyLog: true,
      },
    });

    if (!foodItem || foodItem.dailyLog.userId !== userId) {
      return NextResponse.json({ success: false, error: 'Food item not found or unauthorized' }, { status: 404 });
    }

    // Delete the food item
    await prisma.foodItem.delete({
      where: { id: foodItemId },
    });

    // Clean up associated photo relations if any (cascade handled or manual SetNull)
    // MealPhoto's relation is fields: [foodItemId] -> onDelete: SetNull, so it is automatically cleared.

    // If DailyLog has no items left, let's recalculate streak
    const remainingItems = await prisma.foodItem.count({
      where: { dailyLogId: foodItem.dailyLogId },
    });

    let streakDays = 0;
    if (remainingItems === 0) {
      // Re-evaluate streak
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        // If they had a streak, decrement or reset if they have no other recent logs
        const recentLogs = await prisma.dailyLog.findMany({
          where: {
            userId,
            foodItems: { some: {} },
            id: { not: foodItem.dailyLogId },
          },
          orderBy: { date: 'desc' },
          take: 1,
        });

        let newStreak = 0;
        if (recentLogs.length > 0) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          if (recentLogs[0].date === yesterdayStr) {
            // Keep previous streak
            newStreak = Math.max(0, user.streakDays - 1);
          }
        }
        
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { streakDays: newStreak },
        });
        streakDays = updatedUser.streakDays;
      }
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      streakDays = user?.streakDays || 0;
    }

    return NextResponse.json({
      success: true,
      streakDays,
    });

  } catch (error: any) {
    console.error('🔴 [LOGS-DELETE] Error deleting food:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('signature') ? 401 : 500 }
    );
  }
}
