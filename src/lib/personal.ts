/**
 * Things that fit how you actually live: the nights you usually drink, what nicotine used to
 * cost, and the extra numbers that matter in the weekly review.
 */
import { addDays, weekday, type DateKey } from './dates';
import type { Summary } from './engine';
import { averageClock, sleepMinutes } from './sleep';
import type { DayLog } from './types';

/** Nights you usually drink: Friday and Saturday, plus any night you've drunk on twice in the last 8 weeks. */
export function drinkNights(summary: Summary, habitId = 'alcohol'): Set<number> {
  const nights = new Set([5, 6]);
  const counts = new Map<number, number>();
  for (const e of summary.evals.slice(-56)) {
    if (e.log?.avoid?.[habitId] !== 'slip') continue;
    const d = weekday(e.date);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  for (const [d, n] of counts) if (n >= 2) nights.add(d);
  return nights;
}

/** £ you didn't spend on a habit between two dates (inclusive), counting only days logged clean. */
export function savedBetween(days: Record<DateKey, DayLog>, habitId: string, from: DateKey, to: DateKey, perWeek: number): number {
  if (!(perWeek > 0)) return 0;
  let clean = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (days[d]?.avoid?.[habitId] === 'clean') clean++;
  return Math.round((clean * perWeek) / 7);
}

export interface WeekExtras {
  nicotine: { clean: number; slips: number; urges: number } | null;
  drinks: { nights: DateKey[]; limit: number } | null;
  sleep: { asleep: string; awake: string; mins: number; nights: number } | null;
}

/** The personal side of a Mon–Sun week: nicotine, drinking nights and Apple Watch sleep. */
export function weekExtras(summary: Summary, start: DateKey): WeekExtras {
  const end = addDays(start, 6);
  const evals = summary.evals.filter((e) => e.date >= start && e.date <= end);
  const has = (id: string) => summary.habits.find((h) => h.id === id);

  const nicotine = has('vape')
    ? {
        clean: evals.filter((e) => e.log?.avoid?.vape === 'clean').length,
        slips: evals.filter((e) => e.log?.avoid?.vape === 'slip').length,
        urges: evals.reduce((n, e) => n + (e.log?.urges?.vape ?? 0), 0),
      }
    : null;

  const alcohol = has('alcohol');
  const drinks = alcohol ? { nights: evals.filter((e) => e.log?.avoid?.alcohol === 'slip').map((e) => e.date), limit: alcohol.weeklyLimit ?? 0 } : null;

  const watched = evals.map((e) => e.log?.sleepAuto).filter((s): s is NonNullable<typeof s> => !!s);
  const sleep = watched.length
    ? {
        asleep: averageClock(watched.map((s) => s.asleep)) ?? '',
        awake: averageClock(watched.map((s) => s.awake)) ?? '',
        mins: Math.round(watched.reduce((n, s) => n + sleepMinutes(s.asleep, s.awake), 0) / watched.length),
        nights: watched.length,
      }
    : null;

  return { nicotine, drinks, sleep };
}
