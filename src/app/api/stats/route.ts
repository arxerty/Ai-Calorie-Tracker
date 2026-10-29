import { NextResponse } from 'next/server';
import { DATE_RE, HttpError, handleError, requireUserId } from '@/lib/server/api';
import { loadDayStats } from '@/lib/server/stats';

const MAX_RANGE_DAYS = 120;

/**
 * GET: per-day totals for an inclusive date range (?from=YYYY-MM-DD&to=YYYY-MM-DD).
 */
export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      throw new HttpError(400, 'Invalid range. Use from/to in YYYY-MM-DD.');
    }
    const spanDays = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (spanDays > MAX_RANGE_DAYS) throw new HttpError(400, `Range is limited to ${MAX_RANGE_DAYS} days.`);

    return NextResponse.json({ success: true, days: await loadDayStats(userId, from, to) });
  } catch (error) {
    return handleError('STATS-GET', error);
  }
}
