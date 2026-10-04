/**
 * "Up next": looks at the time of day and what's left, and tells you the one or two things
 * that matter right now — instead of making you scan the whole list.
 */
import { birthdaysOn, eventsOn } from './calendar';
import { WATER_TARGET, WORKOUTS, caffeineCutoff, clockLabel, featureOn, habitLabel, scheduleLabel, sleepTargets } from './config';
import { addDays, fmt, weekday, weekStart, type DateKey } from './dates';
import type { DayEval, Summary } from './engine';
import { budgetStatus, money } from './budget';
import { chestReady, logicalNow } from './moments';
import { drinkNights } from './personal';
import { NICOTINE_MILESTONES } from './recovery';
import { carriedDays, openTodos } from './todos';
import type { AppData, WorkoutType } from './types';

export type SuggestionAction =
  | { kind: 'tick'; label: string; habitIds: string[] }
  | { kind: 'water'; label: string }
  | { kind: 'lock'; label: string }
  | { kind: 'chest'; label: string }
  | { kind: 'workout'; label: string; workout: WorkoutType }
  | { kind: 'scroll'; label: string; target: string }
  | { kind: 'card'; label: string }
  | { kind: 'wrap'; label: string };

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

export function suggestions(now: Date, date: DateKey, e: DayEval, summary: Summary, data: Pick<AppData, 'events' | 'birthdays' | 'settings'> & Partial<Pick<AppData, 'spending' | 'todos'>>): Suggestion[] {
  const out: Suggestion[] = [];
  const h = now.getHours();
  const item = (id: string) => e.items.find((i) => i.habit.id === id && i.visible);
  const open = e.items.filter((i) => i.required && !i.done && !i.missed && !i.skipped);

  if (e.dayOff) {
    return [{ id: 'dayoff', emoji: '🏖️', title: 'Day off — enjoy it', detail: 'Streaks are frozen. Back at it tomorrow.', tone: 'good', priority: 100 }];
  }

  if (featureOn(data.settings, 'chest') && chestReady(e, summary.today)) {
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
        detail: list(morning.map((i) => habitLabel(i.habit, data.settings, date))),
        tone: h < 12 ? 'info' : 'warn',
        priority: h < 12 ? 90 : h < 21 ? 66 : 45,
        action: quick.length ? { kind: 'tick', label: `Done ${quick.length === morning.length ? 'all' : quick.length}`, habitIds: quick.map((i) => i.habit.id) } : undefined,
      });
    }
  }

  // Caffeine cutoff countdown (the 4 hours before it)
  const caffeine = item('caffeine');
  const [ch, cm] = caffeineCutoff(data.settings).split(':').map(Number);
  const cutoffAt = ch + cm / 60;
  const hour = h + now.getMinutes() / 60;
  if (caffeine && !caffeine.done && !caffeine.missed && hour >= cutoffAt - 4 && hour < cutoffAt) {
    const left = until(now, ch, cm);
    out.push({ id: 'caffeine', emoji: '☕', title: `Caffeine cutoff in ${dur(left)}`, detail: 'Last coffee now if you want one.', tone: left < 3_600_000 ? 'warn' : 'info', priority: left < 3_600_000 ? 80 : 50 });
  }

  // Water
  const water = item('water');
  const bottles = e.log?.water ?? 0;
  if (water && !water.done && !water.missed && h >= 11) {
    const left = (water.habit.target ?? WATER_TARGET) - bottles;
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

  // Training — only nag when the week is getting tight. Only the gym counts towards the target.
  const target = data.settings.workoutTarget;
  const ws = weekStart(date);
  const week = summary.evals.filter((x) => x.date >= ws && x.date <= addDays(ws, 6));
  const sessions = week.filter((x) => x.gym).length;
  const daysLeft = 7 - ((weekday(date) + 6) % 7); // including today
  const needed = target - sessions;
  const football = WORKOUTS.find((w) => w.id === 'football');
  if (weekday(date) === 1 && h >= 15 && football && date === summary.today && !e.log?.workouts?.includes('football')) {
    // Monday football: optional extra, but one tap when you've played.
    out.push({
      id: 'train',
      emoji: '⚽',
      title: 'Football tonight?',
      detail: `Optional extra — doesn't count towards your ${target} gym sessions (${sessions}/${target} this week). Tap when you've played.`,
      tone: 'info',
      priority: 60,
      action: { kind: 'workout', label: `Played +${football.points}`, workout: 'football' },
    });
  } else if (needed > 0 && !e.gym) {
    const tight = needed >= daysLeft - 1;
    if (tight || h >= 15) {
      out.push({
        id: 'train',
        emoji: '🏋️',
        title: tight ? `Need ${needed} more gym session${needed === 1 ? '' : 's'} in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : `${sessions}/${target} gym sessions this week`,
        detail: tight ? 'Go today — only the gym counts towards the target.' : 'Football and home workouts are extra — the gym is what counts.',
        tone: tight ? 'warn' : 'info',
        priority: tight ? 76 : 35,
        action: { kind: 'scroll', label: 'Log it', target: 'training' },
      });
    }
  }

  // The morning after a drinking night
  const lastNight = summary.evals.find((x) => x.date === addDays(date, -1));
  if (date === summary.today && h >= 5 && h < 13 && lastNight?.log?.avoid?.alcohol === 'slip') {
    out.push({
      id: 'after',
      emoji: '🥤',
      title: 'Big night? Water first',
      detail: 'A bottle before anything else, then the morning routine. Today still counts.',
      tone: 'info',
      priority: 84,
      action: water && !water.done ? { kind: 'water', label: '+1 bottle' } : undefined,
    });
  }

  // Drinking nights: one a week is fine. On the nights you usually go out, say where you stand.
  const drink = item('alcohol');
  if (drink?.allowance && date === summary.today && (h >= 17 || h < 4) && !e.log?.avoid?.alcohol && drinkNights(summary).has(weekday(date))) {
    const left = drink.allowance.limit - drink.allowance.used;
    const bed = clockLabel(sleepTargets(data.settings, addDays(date, 1)).sleep);
    if (left > 0) {
      out.push({ id: 'drinks', emoji: '🍺', title: `${left} drinking night${left === 1 ? '' : 's'} left this week`, detail: `If tonight's the night: eat first, water between drinks, bed by ${bed}.`, tone: 'info', priority: 77 });
    } else {
      const used = week.find((x) => x.date < date && x.log?.avoid?.alcohol === 'slip');
      out.push({ id: 'drinks', emoji: '🍺', title: `Drinking night used${used ? ` (${fmt(used.date, 'ddd')})` : ''}`, detail: "Tonight's a dry one — another would count as a slip.", tone: 'warn', priority: 80 });
    }
  }

  // Nicotine-free milestones, on the day you reach them
  const clean = summary.habits.some((x) => x.id === 'vape') ? (summary.habitStreaks.vape?.current ?? 0) : 0;
  const milestone = NICOTINE_MILESTONES.find((m) => m.days === clean);
  if (milestone && date === summary.today) {
    out.push({ id: 'milestone', emoji: milestone.emoji, title: `${milestone.title} nicotine-free`, detail: milestone.text, tone: 'good', priority: 95 });
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

  // To-dos: today's, plus anything carried over from earlier days (those get louder the longer they wait)
  if (data.todos && date === summary.today) {
    const pending = openTodos(data.todos, date);
    if (pending.length) {
      const carried = pending.filter((t) => carriedDays(t, date) > 0).sort((a, b) => carriedDays(b, date) - carriedDays(a, date));
      const oldest = carried[0];
      const late = oldest ? carriedDays(oldest, date) : 0;
      const starred = pending.filter((t) => t.important);
      out.push({
        id: 'todos',
        emoji: starred.length ? '⭐' : '📝',
        title: pending.length === 1 ? pending[0].title : `${pending.length} to-dos still open`,
        detail: oldest
          ? `${carried.length === 1 ? `"${oldest.title}" has` : `${carried.length} have`} been carried over for ${late} day${late === 1 ? '' : 's'}.`
          : pending.length === 1
            ? pending[0].time
              ? `Today at ${pending[0].time}.`
              : "On today's list."
            : list(pending.map((t) => t.title)),
        tone: oldest || starred.length ? 'warn' : 'info',
        priority: oldest ? 68 + Math.min(12, late * 3) : starred.length ? 66 : h >= 12 ? 57 : 44,
        action: { kind: 'scroll', label: 'Show', target: 'todos' },
      });
    }
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

  // Tonight's bedtime (later on Friday and Saturday nights)
  const bed = sleepTargets(data.settings, h < 4 ? date : addDays(date, 1)).sleep;
  const [bh, bm] = bed.split(':').map(Number);
  if (date === logicalNow(now).date && (h >= 21 || h < bh) && item('sleep')) {
    const left = until(now, bh, bm);
    out.push({ id: 'bed', emoji: '🌙', title: `Asleep by ${clockLabel(bed)} — ${dur(left)} left`, detail: 'Phone down, face routine, lights off.', tone: left < 3_600_000 ? 'warn' : 'info', priority: left < 3_600_000 ? 88 : 78 });
  }

  if (!e.closed && (h >= 21 || h < 4)) {
    // Things left? Go through them one at a time, then lock in.
    out.push(
      open.length >= 2
        ? { id: 'lock', emoji: '🌙', title: `Wrap up: ${open.length} things left`, detail: `Two minutes, one at a time, then lock in. Or it's £${data.settings.fineAmount} to charity after tomorrow.`, tone: 'warn', priority: 72, action: { kind: 'wrap', label: 'Start' } }
        : { id: 'lock', emoji: '🔒', title: 'Lock in before bed', detail: `Or it's £${data.settings.fineAmount} to charity after tomorrow.`, tone: 'warn', priority: 72, action: { kind: 'lock', label: 'Lock in' } },
    );
  }

  // Credit card: weekly update, or a warning if you're over pace
  if (date === summary.today && data.spending && featureOn(data.settings, 'budget')) {
    const card = budgetStatus(data.spending, data.settings, date);
    if (card.needsUpdate) {
      out.push({ id: 'card', emoji: '💳', title: 'Update your card spending', detail: 'What have you spent this month so far? +10 XP.', tone: 'info', priority: weekday(date) === 0 ? 70 : 42, action: { kind: 'card', label: 'Update' } });
    } else if (card.state === 'over-limit') {
      out.push({ id: 'card', emoji: '💳', title: `${money(card.spent - card.limit)} over your ${money(card.limit)} card limit`, detail: 'Try not to use the card again this month.', tone: 'warn', priority: 62, action: { kind: 'card', label: 'See' } });
    } else if (card.state === 'over-pace' && card.daysLeft) {
      out.push({ id: 'card', emoji: '💳', title: `Card: ${money(card.perDay)} a day max`, detail: `${money(card.vsPace)} ahead of pace — that finishes under ${money(card.limit)}.`, tone: 'warn', priority: 52, action: { kind: 'card', label: 'See' } });
    }
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
