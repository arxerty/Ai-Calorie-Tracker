import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { HttpError, handleError, requireUserId } from '@/lib/server/api';
import { z } from 'zod';

const FavoriteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  weightG: z.number().positive(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
});

const RECENT_LIMIT = 12;

/**
 * GET: the user's favorites plus recently logged dishes (distinct by name, newest first).
 */
export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);

    const [favorites, recentItems] = await Promise.all([
      prisma.favoriteFood.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.foodItem.findMany({
        where: { dailyLog: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: { name: true, weightG: true, calories: true, proteinG: true, fatG: true, carbsG: true },
      }),
    ]);

    const seen = new Set<string>();
    const recent = [];
    for (const item of recentItems) {
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recent.push(item);
      if (recent.length >= RECENT_LIMIT) break;
    }

    return NextResponse.json({ success: true, favorites, recent });
  } catch (error) {
    return handleError('FAVORITES-GET', error);
  }
}

/**
 * POST: add a dish to favorites. A dish with the same name is updated instead of duplicated.
 */
export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const data = FavoriteSchema.parse(await request.json());

    const existing = await prisma.favoriteFood.findMany({ where: { userId }, select: { id: true, name: true } });
    const duplicate = existing.find((f) => f.name.trim().toLowerCase() === data.name.toLowerCase());

    const favorite = duplicate
      ? await prisma.favoriteFood.update({ where: { id: duplicate.id }, data })
      : await prisma.favoriteFood.create({ data: { userId, ...data } });

    return NextResponse.json({ success: true, favorite });
  } catch (error) {
    return handleError('FAVORITES-POST', error);
  }
}

/**
 * DELETE: remove a favorite.
 */
export async function DELETE(request: Request) {
  try {
    const userId = requireUserId(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Missing favorite ID');

    const result = await prisma.favoriteFood.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new HttpError(404, 'Favorite not found');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError('FAVORITES-DELETE', error);
  }
}
