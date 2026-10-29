import { NextResponse } from 'next/server';
import { verifyTelegramAuth } from '@/lib/server/telegram-auth';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Verifies the Telegram initData header and returns the user id. Throws HttpError(401). */
export function requireUserId(request: Request): string {
  const initDataRaw = request.headers.get('x-telegram-init-data');
  if (!initDataRaw) throw new HttpError(401, 'Authentication required');
  try {
    return String(verifyTelegramAuth(initDataRaw).id);
  } catch (e: any) {
    throw new HttpError(401, e.message || 'Authentication failed');
  }
}

export function handleError(tag: string, error: any) {
  console.error(`🔴 [${tag}]`, error);
  if (error instanceof HttpError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  if (error?.name === 'ZodError') {
    return NextResponse.json({ success: false, error: 'Invalid request data' }, { status: 400 });
  }
  return NextResponse.json(
    { success: false, error: error?.message || 'Internal server error' },
    { status: 500 }
  );
}
