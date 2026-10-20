/** Small helpers for sleep and wake times: what you logged, what the Apple Watch sent, and the chips to log them. */
import { clockMinutes, nightMinutes, sleepTargets } from './config';
import { addDays, weekday, type DateKey } from './dates';
import type { DayLog, Settings } from './types';

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Minutes from falling asleep to waking (handles going to bed before midnight). */
export function sleepMinutes(asleep: string, awake: string): number {
  return (toMin(awake) - toMin(asleep) + 24 * 60) % (24 * 60);
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Average of clock times, treating evening times as "before midnight" (so 23:30 and 00:30 average to 00:00). */
export function averageClock(times: string[]): string | null {
  if (!times.length) return null;
  const vals = times.map((t) => {
    const m = toMin(t);
    return m >= 18 * 60 ? m - 24 * 60 : m;
  });
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const x = ((avg % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

/** Any number of minutes (even negative, or past midnight) back to a clock time: -30 → '23:30'. */
export function minutesToClock(mins: number): string {
  const x = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

/**
 * Where a time sits on its habit's scale, so times compare properly: falling asleep runs noon to noon
 * ('23:30' → -30, '01:00' → 60), getting up is plain minutes past midnight ('08:30' → 510).
 */
export function timeScale(habitId: string, hhmm: string): number {
  return habitId === 'sleep' ? nightMinutes(hhmm) : clockMinutes(hhmm);
}

/** The time a sleep or wake habit has to beat on a day (later at the weekend). */
export function targetFor(habitId: string, settings: Settings, date: DateKey): string {
  const t = sleepTargets(settings, date);
  return habitId === 'sleep' ? t.sleep : t.wake;
}

/** How a logged time sat against its target: "40m early", "1h 05m late", or "just missed" right on it. */
export function offBy(habitId: string, time: string, target: string): string {
  const diff = timeScale(habitId, target) - timeScale(habitId, time);
  if (diff === 0) return 'just missed';
  const mins = Math.abs(diff);
  const d = mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
  return diff > 0 ? `${d} early` : `${d} late`;
}

/** '23:00' → '11pm', '23:30' → '11:30', '00:00' → '12am': short labels for time chips. */
export function shortClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return m ? `${h % 12 || 12}:${String(m).padStart(2, '0')}` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
}

/** The middle of your logged times (one odd night doesn't move it), or null with nothing logged. */
export function typicalTime(habitId: string, times: string[]): string | null {
  if (!times.length) return null;
  const vals = times.map((t) => timeScale(habitId, t)).sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  return minutesToClock(vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2);
}

/** Chips run within these: 8pm–8am for falling asleep, 4am–4pm for getting up (on each habit's scale). */
const CHIP_WINDOW: Record<'sleep' | 'wake', [number, number]> = { sleep: [-240, 480], wake: [240, 960] };

/**
 * Times to offer as one-tap chips: every half hour from 2 hours before the target to 2 hours after,
 * stretched to take in your usual time if that's further out.
 */
export function timeChoices(habitId: string, target: string, usual?: string | null): string[] {
  const half = (m: number) => Math.round(m / 30) * 30;
  const t = half(timeScale(habitId, target));
  let from = t - 120;
  let to = t + 120;
  if (usual) {
    const u = half(timeScale(habitId, usual));
    from = Math.min(from, u - 30);
    to = Math.max(to, u + 30);
  }
  const [lo, hi] = CHIP_WINDOW[habitId === 'sleep' ? 'sleep' : 'wake'];
  const out: string[] = [];
  for (let m = Math.max(from, lo); m <= Math.min(to, hi); m += 30) out.push(minutesToClock(m));
  return out;
}

export interface Night {
  /** When you fell asleep (what you logged, or the Watch's time). */
  asleep: string | null;
  /** When you got up. */
  awake: string | null;
  /** How long you slept, when both are known and it adds up to a real night (1–16 hours). */
  mins: number | null;
}

/** Last night from a day's log. Days are logged the morning after, so asleep and awake are the same night. */
export function nightOf(log: DayLog | undefined): Night {
  const asleep = log?.times?.sleep ?? log?.sleepAuto?.asleep ?? null;
  const awake = log?.times?.wake ?? log?.sleepAuto?.awake ?? null;
  const mins = asleep && awake ? sleepMinutes(asleep, awake) : null;
  return { asleep, awake, mins: mins != null && mins >= 60 && mins <= 16 * 60 ? mins : null };
}

/** The time logged for a sleep or wake habit on a day (yours, or the Watch's), if any. */
export function loggedTime(habitId: string, log: DayLog | undefined): string | null {
  const n = nightOf(log);
  return habitId === 'sleep' ? n.asleep : habitId === 'wake' ? n.awake : (log?.times?.[habitId] ?? null);
}

const isWeekend = (d: DateKey) => [0, 6].includes(weekday(d));

/**
 * Your usual time over the 3 weeks before `date`: the middle of what you logged, from the same kind of day
 * (weekend lie-ins aren't mixed in with weekdays) once there are 3 of those. Null until there are 3 times at all.
 */
export function usualTime(days: Record<DateKey, DayLog>, habitId: string, date: DateKey): string | null {
  const all: { date: DateKey; time: string }[] = [];
  for (let i = 1; i <= 21; i++) {
    const d = addDays(date, -i);
    const time = loggedTime(habitId, days[d]);
    if (time) all.push({ date: d, time });
  }
  const same = all.filter((x) => isWeekend(x.date) === isWeekend(date));
  const pick = same.length >= 3 ? same : all;
  return pick.length >= 3 ? typicalTime(habitId, pick.map((x) => x.time)) : null;
}
