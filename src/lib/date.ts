// All dates in the app are plain YYYY-MM-DD strings in the user's LOCAL timezone.
// (toISOString() would give UTC and shift the day for users late in the evening.)

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Dates from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

/** Monday of the week containing the given date. */
export function startOfWeek(s: string): string {
  const d = parseDateStr(s);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return toDateStr(d);
}

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function weekdayShort(s: string): string {
  return WEEKDAYS_SHORT[parseDateStr(s).getDay()];
}

export function dayOfMonth(s: string): number {
  return parseDateStr(s).getDate();
}

/** "Сегодня", "Вчера" or "29 октября". */
export function formatDayTitle(s: string, today: string = toDateStr()): string {
  if (s === today) return 'Сегодня';
  if (s === addDays(today, -1)) return 'Вчера';
  return parseDateStr(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** "29 окт" */
export function formatDayShort(s: string): string {
  return parseDateStr(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
