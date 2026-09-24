import dayjs from 'dayjs';

/** Calendar day in local time, formatted `YYYY-MM-DD`. */
export type DateKey = string;

const DAY_MS = 86_400_000;

/** Days since epoch for a date key. Uses UTC maths so DST never shifts a day. */
export function toNum(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromNum(n: number): DateKey {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(key: DateKey, n: number): DateKey {
  return fromNum(toNum(key) + n);
}

/** a - b in whole days. */
export function diffDays(a: DateKey, b: DateKey): number {
  return toNum(a) - toNum(b);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key: DateKey): number {
  return new Date(toNum(key) * DAY_MS).getUTCDay();
}

/** Monday of the week containing `key`. */
export function weekStart(key: DateKey): DateKey {
  return addDays(key, -((weekday(key) + 6) % 7));
}

export function dateKey(date: Date = new Date()): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local timestamp at 00:00 of the given day. */
export function startOfDay(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** A day must be logged before midnight at the end of the following day (24h after it ends). */
export function logDeadline(key: DateKey): number {
  return startOfDay(addDays(key, 2));
}

export function range(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let n = toNum(from), end = toNum(to); n <= end; n++) out.push(fromNum(n));
  return out;
}

export const minKey = (a: DateKey, b: DateKey) => (a < b ? a : b);
export const maxKey = (a: DateKey, b: DateKey) => (a > b ? a : b);

export function fmt(key: DateKey, pattern: string): string {
  return dayjs(key).format(pattern);
}

export function relativeDay(key: DateKey, today: DateKey): string {
  const d = diffDays(key, today);
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  if (d === 1) return 'Tomorrow';
  if (d > 1 && d < 7) return fmt(key, 'dddd');
  return fmt(key, 'ddd D MMM');
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
