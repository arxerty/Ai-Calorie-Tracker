import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { DATE_RE, HttpError, handleError, requireUserId } from '@/lib/server/api';
import { z } from 'zod';

const MAX_DAILY_ML = 10000;

const WaterSchema = z.object({
  date: z.string().regex(DATE_RE, 'Date must be in YYYY-MM-DD format'),
  deltaMl: z.number().int().min(-MAX_DAILY_ML).max(MAX_DAILY_ML),
});

/**
 * GET: water drunk on a given day.
 */
export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const date = new URL(request.url).searchParams.get('date');
    if (!date || !DATE_RE.test(date)) throw new HttpError(400, 'Invalid date parameter. Use YYYY-MM-DD.');

    const log = await prisma.waterLog.findUnique({ where: { userId_date: { userId, date } } });
    return NextResponse.json({ success: true, ml: log?.ml ?? 0 });
  } catch (error) {
    return handleError('WATER-GET', error);
  }
}

/**
 * POST: add (or subtract, with a negative delta) water for a day. The total never drops below 0.
 */
export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const { date, deltaMl } = WaterSchema.parse(await request.json());

    const current = await prisma.waterLog.findUnique({ where: { userId_date: { userId, date } } });
    const ml = Math.min(MAX_DAILY_ML, Math.max(0, (current?.ml ?? 0) + deltaMl));

    await prisma.waterLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ml },
      update: { ml },
    });

    return NextResponse.json({ success: true, ml });
  } catch (error) {
    return handleError('WATER-POST', error);
  }
}
