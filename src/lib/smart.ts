/**
 * "Up next": looks at the time of day and what's left, and tells you the one or two things
 * that matter right now — instead of making you scan the whole list.
 */
import { birthdaysOn, eventsOn } from './calendar';
import { WATER_TARGET, scheduleLabel } from './config';
import { addDays, weekday, weekStart, type DateKey } from './dates';
import type { DayEval, Summary } from './engine';
import { chestReady } from './moments';
import type { AppData } from './types';

export type SuggestionAction =
  | { kind: 'tick'; label: string; habitIds: string[] }
  | { kind: 'water'; label: string }
  | { kind: 'lock'; label: string }
  | { kind: 'chest'; label: string }
  | { kind: 'scroll'; label: string; target: string };

export interface Suggestion {
  id: string;
  emoji: string;
  title: string;
  detail?: string;
  tone: 'info' | 'warn' | 'good';
  priority: number;
  action?: SuggestionAction;
}

function until(now: Date, h: number, m = 0): number {
  const t = new Date(now);
  t.setHours(h, m, 0, 0);
  if (t.getTime() < now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime() - now.getTime();
}

function dur(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

const list = (xs: string[], max = 3) => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} +${xs.length - max} more`);

export function suggestions(now: Date, date: DateKey, e: DayEval, summary: Summary, data: Pick<AppData, 'events' | 'birthdays' | 'settings'>): Suggestion[] {
  const out: Suggestion[] = [];
  const h = now.getHours();
  const item = (id: string) => e.items.find((i) => i.habit.id === id && i.visible);
  const open = e.items.filter((i) => i.required && !i.done && !i.missed && !i.skipped);

  if (e.dayOff) {
    return [{ id: 'dayoff', emoji: '🏖️', title: 'Day off — enjoy it', detail: 'Streaks are frozen. Back at it tomorrow.', tone: 'good', priority: 100 }];
  }

  if (chestReady(e, summary.today)) {
    out.push({ id: 'chest', emoji: '🎁', title: `${e.perfect ? 'Golden chest' : 'Reward chest'} ready`, detail: 'Locked in on time — open it for bonus XP.', tone: 'good', priority: 105, action: { kind: 'chest', label: 'Open' } });
  }

  if (e.perfect) {
    out.push({ id: 'perfect', emoji: '✨', title: 'Everything done. Proper day.', detail: 'You were better than yesterday.', tone: 'good', priority: 100 });
  }

  // Morning routine: one tap for the simple stuff (and a nudge later if it slipped)
  if (h >= 5) {
    const morning = open.filter((i) => i.habit.section === 'morning');
    const quick = morning.filter((i) => i.habit.kind === 'check' || i.habit.kind === 'dose');
    if (morning.length) {
      out.push({
        id: 'morning',
        emoji: '🌅',
        title: h < 12 ? 'Morning routine' : 'Still to do from this morning',
        detail: list(morning.map((i) => i.habit.label)),
        tone: h < 12 ? 'info' : 'warn',
        priority: h < 12 ? 90 : h < 21 ? 66 : 45,
        action: quick.length ? { kind: 'tick', label: `Done ${quick.length === morning.length ? 'all' : quick.length}`, habitIds: quick.map((i) => i.habit.id) } : undefined,
      });
    }
  }

  // Caffeine cutoff countdown
  const caffeine = item('caffeine');
  if (caffeine && !caffeine.done && !caffeine.missed && h >= 10 && h < 14) {
    const left = until(now, 14);
    out.push({ id: 'caffeine', emoji: '☕', title: `Caffeine cutoff in ${dur(left)}`, detail: 'Last coffee now if you want one.', tone: left < 3_600_000 ? 'warn' : 'info', priority: left < 3_600_000 ? 80 : 50 });
  }

  // Water
  const water = item('water');
  const bottles = e.log?.water ?? 0;
  if (water && !water.done && h >= 11) {
    const left = WATER_TARGET - bottles;
    out.push({
      id: 'water',
      emoji: '🚰',
      title: bottles === 0 ? 'No water yet today' : `${left} more bottle${left === 1 ? '' : 's'} of water`,
      detail: h >= 18 ? 'Get it done before bed.' : 'Drink one now.',
      tone: h >= 18 ? 'warn' : 'info',
      priority: h >= 18 ? 68 : 58,
      action: { kind: 'water', label: '+1 bottle' },
    });
  }

  // Training — only nag when the week is getting tight
  const target = data.settings.workoutTarget;
  const ws = weekStart(date);
  const week = summary.evals.filter((x) => x.date >= ws && x.date <= addDays(ws, 6));
  const sessions = week.filter((x) => x.workoutCount > 0).length;
  const daysLeft = 7 - ((weekday(date) + 6) % 7); // including today
  const needed = target - sessions;
  if (needed > 0 && e.workoutCount === 0) {
    const tight = needed >= daysLeft - 1;
    if (tight || h >= 15) {
      out.push({
        id: 'train',
        emoji: '🏋️',
        title: tight ? `Need ${needed} more session${needed === 1 ? '' : 's'} in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : `${sessions}/${target} sessions this week`,
        detail: weekday(date) === 1 ? 'Football tonight counts (optional).' : tight ? 'Go today — gym gives the most XP.' : 'Gym, home workout or football all count.',
        tone: tight ? 'warn' : 'info',
        priority: tight ? 76 : 35,
        action: { kind: 'scroll', label: 'Log it', target: 'training' },
      });
    }
  }

  // Overdue chores
  const overdue = open.filter((i) => i.overdueDays > 0).sort((a, b) => b.overdueDays - a.overdueDays);
  if (overdue.length) {
    const top = overdue[0];
    out.push({
      id: 'overdue',
      emoji: '🧹',
      title: overdue.length === 1 ? `${top.habit.label} is ${top.overdueDays}d overdue` : `${overdue.length} jobs carried over`,
      detail: overdue.length === 1 ? scheduleLabel(top.habit.schedule) : list(overdue.map((i) => i.habit.label)),
      tone: 'warn',
      priority: 55 + Math.min(20, top.overdueDays * 5),
      action: { kind: 'scroll', label: 'Show', target: `row-${top.habit.id}` },
    });
  }

  // Evening: nutrition, streaks at risk, bed, lock-in
  if (h >= 18 || h < 4) {
    const food = open.filter((i) => i.habit.id === 'macro' || i.habit.id === 'protein');
    if (food.length) {
      out.push({ id: 'food', emoji: '📱', title: food.length === 2 ? 'Log MacroFactor & check protein' : food[0].habit.label, tone: 'info', priority: 54 });
    }
    const atRisk = open.filter((i) => (summary.habitStreaks[i.habit.id]?.current ?? 0) >= 3);
    if (atRisk.length) {
      out.push({
        id: 'risk',
        emoji: '🔥',
        title: `${atRisk.length} streak${atRisk.length === 1 ? '' : 's'} at risk tonight`,
        detail: list(atRisk.map((i) => `${i.habit.label} (${summary.habitStreaks[i.habit.id].current})`)),
        tone: 'warn',
        priority: 86,
      });
    }
  }

  if (date === summary.today && (h >= 21 || h < 1) && item('sleep')) {
    const left = until(now, 1);
    out.push({ id: 'bed', emoji: '🌙', title: `Asleep by 1am — ${dur(left)} left`, detail: 'Phone down, face routine, lights off.', tone: left < 3_600_000 ? 'warn' : 'info', priority: left < 3_600_000 ? 88 : 78 });
  }

  if (!e.closed && (h >= 21 || h < 4)) {
    out.push({ id: 'lock', emoji: '🔒', title: 'Lock in before bed', detail: `Or it's £${data.settings.fineAmount} to charity after tomorrow.`, tone: 'warn', priority: 72, action: { kind: 'lock', label: 'Lock in' } });
  }

  // Tomorrow heads-up
  if (h >= 18 && date === summary.today) {
    const tomorrow = addDays(date, 1);
    const jobs = summary.habits.filter((x) => x.kind === 'chore' && summary.tracks[x.id]?.nextDue === tomorrow && !(x.schedule && 'every' in x.schedule && x.schedule.every === 1));
    const evs = eventsOn(data.events, tomorrow).map((x) => (x.time ? `${x.title} ${x.time}` : x.title));
    const bdays = birthdaysOn(data.birthdays, tomorrow).map((b) => `🎂 ${b.name}`);
    const things = [...bdays, ...evs, ...jobs.map((x) => x.label)];
    if (things.length) out.push({ id: 'tomorrow', emoji: '🔭', title: 'Tomorrow', detail: list(things, 4), tone: 'info', priority: 40 });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
