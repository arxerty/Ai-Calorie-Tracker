import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { DATE_RE, HttpError, handleError, requireUserId } from '@/lib/server/api';
import { z } from 'zod';

const AddWeightSchema = z.object({
  date: z.string().regex(DATE_RE, 'Date must be in YYYY-MM-DD format'),
  weightKg: z.number().min(20).max(400),
});

/**
 * GET: weight history, oldest first (the most recent 400 entries).
 */
export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);

    const rows = await prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 400,
      select: { id: true, date: true, weightKg: true },
    });

    return NextResponse.json({ success: true, entries: rows.reverse() });
  } catch (error) {
    return handleError('WEIGHT-GET', error);
  }
}

/**
 * POST: log (or overwrite) the weight for a day. When it is the newest entry,
 * the profile weight in UserSettings follows it.
 */
export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const data = AddWeightSchema.parse(await request.json());

    const entry = await prisma.weightEntry.upsert({
      where: { userId_date: { userId, date: data.date } },
      create: { userId, date: data.date, weightKg: data.weightKg },
      update: { weightKg: data.weightKg },
      select: { id: true, date: true, weightKg: true },
    });

    const latest = await prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    if (latest?.id === entry.id) {
      await prisma.userSettings.update({ where: { userId }, data: { weight: entry.weightKg } });
    }

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    return handleError('WEIGHT-POST', error);
  }
}

/**
 * DELETE: remove one weight entry.
 */
export async function DELETE(request: Request) {
  try {
    const userId = requireUserId(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Missing weight entry ID');

    const entry = await prisma.weightEntry.findUnique({ where: { id } });
    if (!entry || entry.userId !== userId) throw new HttpError(404, 'Weight entry not found');

    await prisma.weightEntry.delete({ where: { id } });

    // Keep the profile weight in sync with the newest remaining entry (if any)
    const latest = await prisma.weightEntry.findFirst({ where: { userId }, orderBy: { date: 'desc' } });
    if (latest) {
      await prisma.userSettings.update({ where: { userId }, data: { weight: latest.weightKg } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError('WEIGHT-DELETE', error);
  }
}
