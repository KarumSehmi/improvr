/**
 * Pure logic: what's due, scores, streaks, fines, XP. No React, no storage — easy to test.
 */
// .js endings because this file also runs on the server (server/notify.ts).
import { BONUS, LEVEL_TITLES, WATER_TARGET, WORKOUTS, habitsFor, type Habit } from './config.js';
import { addDays, diffDays, fromNum, logDeadline, maxKey, toNum, weekday, weekStart, type DateKey } from './dates.js';
import type { AppData, DayLog, Settings } from './types.js';

// ---------------------------------------------------------------------------
// Chores: carry over every day until done
// ---------------------------------------------------------------------------

export interface ChoreDay {
  due: boolean;
  overdueDays: number;
  done: boolean;
  skipped: boolean;
}

export interface ChoreTrack {
  byDate: Record<DateKey, ChoreDay>;
  /** Next due date after everything up to and including `until`. */
  nextDue: DateKey;
}

function weeklyAnchor(h: Habit, settings: Settings, wd: number, start: DateKey): DateKey {
  const custom = settings.anchors?.[h.id];
  if (custom && weekday(custom) === wd) return custom;
  return addDays(start, (wd - weekday(start) + 7) % 7);
}

function occurrenceOnOrAfter(anchor: DateKey, period: number, from: DateKey): DateKey {
  const n = Math.ceil(diffDays(from, anchor) / period);
  return addDays(anchor, n * period);
}

export function trackChore(h: Habit, data: AppData, until: DateKey): ChoreTrack {
  const { settings, days } = data;
  const s = h.schedule;
  if (!s) throw new Error(`${h.id} has no schedule`);
  const start = maxKey(settings.startDate, h.since ?? settings.startDate);

  let nextDue: DateKey;
  let advance: (doneOn: DateKey, due: DateKey) => DateKey;
  if ('every' in s) {
    nextDue = addDays(start, s.offset ?? 0);
    advance = (doneOn) => addDays(doneOn, s.every);
  } else {
    const period = 7 * (s.everyWeeks ?? 1);
    const anchor = weeklyAnchor(h, settings, s.weekday, start);
    nextDue = occurrenceOnOrAfter(anchor, period, start);
    // Doing it early covers the upcoming one; doing it late covers everything missed.
    advance = (doneOn, due) => occurrenceOnOrAfter(anchor, period, addDays(maxKey(doneOn, due), 1));
  }

  const byDate: Record<DateKey, ChoreDay> = {};
  for (let n = toNum(start), end = toNum(until); n <= end; n++) {
    const d = fromNum(n);
    const log = days[d];
    const due = nextDue <= d;
    const done = log?.done?.[h.id] === true;
    const skipped = !done && log?.skipped?.[h.id] === true;
    byDate[d] = { due, overdueDays: due ? diffDays(d, nextDue) : 0, done, skipped };
    if (done || skipped) nextDue = advance(d, nextDue);
  }
  return { byDate, nextDue };
}

// ---------------------------------------------------------------------------
// Single day
// ---------------------------------------------------------------------------

export function isDone(h: Habit, log: DayLog | undefined): boolean {
  if (!log) return false;
  switch (h.kind) {
    case 'water':
      return (log.water ?? 0) >= WATER_TARGET;
    case 'dose':
      return (log.finMl ?? 0) > 0;
    case 'avoid':
      return log.avoid?.[h.id] === 'clean';
    default: {
      const ticked = log.done?.[h.id];
      if (ticked != null) return ticked === true;
      // Weigh-in used to be a number; those days still count.
      return h.id === 'weigh' && (log.weight ?? 0) > 0;
    }
  }
}

export interface ItemEval {
  habit: Habit;
  /** Shown on this day's checklist. */
  visible: boolean;
  /** Counts towards the day's score. */
  required: boolean;
  done: boolean;
  skipped: boolean;
  overdueDays: number;
  /** Explicit "no" (missed sleep/wake target, or slipped past your allowance). */
  missed: boolean;
  /** Stay-clean habits with a weekly allowance: slips used this week so far. */
  allowance?: { used: number; limit: number; allowed: boolean };
}

export interface DayEval {
  date: DateKey;
  log: DayLog | undefined;
  dayOff: boolean;
  closed: boolean;
  onTime: boolean;
  items: ItemEval[];
  required: number;
  completed: number;
  /** 0–100, null on a day off. */
  pct: number | null;
  points: number;
  perfect: boolean;
  workoutCount: number;
}

export function evaluateDay(date: DateKey, data: AppData, tracks: Record<string, ChoreTrack>, habits = habitsFor(data.settings)): DayEval {
  const log = data.days[date];
  const dayOff = !!log?.dayOff;

  const items: ItemEval[] = habits.map((habit) => {
    if (habit.since && date < habit.since) {
      return { habit, visible: false, required: false, done: false, skipped: false, overdueDays: 0, missed: false };
    }
    if (habit.kind === 'chore') {
      const cd = tracks[habit.id]?.byDate[date];
      const done = !!cd?.done;
      const skipped = !!cd?.skipped;
      const visible = !!cd && (cd.due || done || skipped);
      return { habit, visible, required: visible && !skipped, done, skipped, overdueDays: cd?.overdueDays ?? 0, missed: false };
    }
    const done = isDone(habit, log);
    if (habit.kind === 'avoid') {
      const slipped = log?.avoid?.[habit.id] === 'slip';
      if (habit.weeklyLimit != null) {
        // e.g. one drinking night a week is fine; the second one counts as a slip.
        const used = slipsThisWeek(data, habit.id, date);
        const allowed = slipped && used <= habit.weeklyLimit;
        return { habit, visible: true, required: true, done: done || allowed, skipped: false, overdueDays: 0, missed: slipped && !allowed, allowance: { used, limit: habit.weeklyLimit, allowed } };
      }
      return { habit, visible: true, required: true, done, skipped: false, overdueDays: 0, missed: slipped };
    }
    // Only an honest "no" is a miss (late night / late up). Unticking something isn't.
    const missed = habit.kind === 'time' && log?.done?.[habit.id] === false;
    return { habit, visible: true, required: true, done, skipped: false, overdueDays: 0, missed };
  });

  const req = items.filter((i) => i.required);
  const required = dayOff ? 0 : req.length;
  const completed = dayOff ? 0 : req.filter((i) => i.done).length;
  const pct = dayOff ? null : required === 0 ? 100 : Math.round((completed / required) * 100);
  const closed = !!log?.closedAt;
  const onTime = closed && (log!.closedAt as number) < logDeadline(date);
  const perfect = !dayOff && required > 0 && completed === required;

  const workouts = new Set(log?.workouts ?? []);
  // A slip inside your allowance keeps the streak alive but doesn't earn XP.
  let points = items.reduce((sum, i) => sum + (i.done && !i.allowance?.allowed ? i.habit.points : 0), 0);
  for (const n of Object.values(log?.urges ?? {})) points += BONUS.urge * Math.min(n, BONUS.urgeCap);
  points += WORKOUTS.reduce((sum, w) => sum + (workouts.has(w.id) ? w.points : 0), 0);
  if (onTime) points += BONUS.loggedOnTime;
  if (perfect) points += BONUS.perfectDay;

  return { date, log, dayOff, closed, onTime, items, required, completed, pct, points, perfect, workoutCount: workouts.size };
}

/** Slip days for a habit from Monday up to and including `date`. */
export function slipsThisWeek(data: Pick<AppData, 'days'>, habitId: string, date: DateKey): number {
  let n = 0;
  for (let d = weekStart(date); d <= date; d = addDays(d, 1)) if (data.days[d]?.avoid?.[habitId] === 'slip') n++;
  return n;
}

export function grade(pct: number | null): { letter: string; color: string } {
  if (pct == null) return { letter: '😌', color: 'blue' };
  if (pct >= 100) return { letter: 'S', color: 'yellow' };
  if (pct >= 85) return { letter: 'A', color: 'teal' };
  if (pct >= 70) return { letter: 'B', color: 'green' };
  if (pct >= 50) return { letter: 'C', color: 'lime' };
  if (pct >= 30) return { letter: 'D', color: 'orange' };
  return { letter: 'F', color: 'red' };
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export type Outcome = 'success' | 'fail' | 'neutral';

export interface Streak {
  current: number;
  best: number;
}

export function runStreak(outcomes: Outcome[]): Streak {
  let best = 0;
  let run = 0;
  for (const o of outcomes) {
    if (o === 'success') best = Math.max(best, ++run);
    else if (o === 'fail') run = 0;
  }
  let current = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i] === 'success') current++;
    else if (outcomes[i] === 'fail') break;
  }
  return { current, best };
}

/**
 * A day is "open" until its logging deadline (midnight at the end of the next day) passes —
 * nothing counts against you before then. Equivalent to `now < logDeadline(date)`.
 */
export function isOpen(date: DateKey, today: DateKey): boolean {
  return diffDays(today, date) < 2;
}

export function habitOutcome(item: ItemEval, e: DayEval, open: boolean): Outcome {
  if (item.done) return 'success';
  if (item.missed) return 'fail';
  if (!item.required) return 'neutral';
  return open || e.dayOff ? 'neutral' : 'fail';
}

export function logOutcome(e: DayEval, open: boolean): Outcome {
  if (e.onTime) return 'success';
  return open ? 'neutral' : 'fail';
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export interface LevelInfo {
  level: number;
  title: string;
  into: number;
  need: number;
}

export function levelFor(xp: number): LevelInfo {
  let level = 1;
  let need = 300;
  let rem = Math.max(0, xp);
  while (rem >= need) {
    rem -= need;
    level++;
    need = 300 + 400 * (level - 1);
  }
  return { level, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)], into: rem, need };
}

// ---------------------------------------------------------------------------
// Everything at once
// ---------------------------------------------------------------------------

export interface WeekTraining {
  start: DateKey;
  sessions: number;
  outcome: Outcome;
}

export interface Summary {
  today: DateKey;
  settings: Settings;
  habits: Habit[];
  tracks: Record<string, ChoreTrack>;
  evals: DayEval[];
  evalByDate: Record<DateKey, DayEval>;
  habitStreaks: Record<string, Streak>;
  logStreak: Streak;
  trainingStreak: Streak;
  weeks: WeekTraining[];
  totalXp: number;
  level: LevelInfo;
  /** Days that missed the logging deadline → each costs the fine amount. */
  fineDays: DateKey[];
  fineTotal: number;
  paid: number;
  owed: number;
  /** Days still inside the logging window that aren't locked in yet. */
  openUnlogged: DateKey[];
}

export function summarize(data: AppData, today: DateKey): Summary {
  const start = data.settings.startDate;
  const until = maxKey(today, start);
  const habits = habitsFor(data.settings);
  const tracks: Record<string, ChoreTrack> = {};
  for (const c of habits) if (c.kind === 'chore') tracks[c.id] = trackChore(c, data, until);

  const evals: DayEval[] = [];
  if (start <= today) {
    for (let n = toNum(start), end = toNum(today); n <= end; n++) evals.push(evaluateDay(fromNum(n), data, tracks, habits));
  }
  const evalByDate = Object.fromEntries(evals.map((e) => [e.date, e]));
  const openFlags = evals.map((e) => isOpen(e.date, today));

  const habitStreaks: Record<string, Streak> = {};
  habits.forEach((h, idx) => {
    habitStreaks[h.id] = runStreak(evals.map((e, i) => habitOutcome(e.items[idx], e, openFlags[i])));
  });
  const logStreak = runStreak(evals.map((e, i) => logOutcome(e, openFlags[i])));

  // Training: X sessions per Mon–Sun week. Football, gym and home workouts all count.
  const target = data.settings.workoutTarget;
  const weeks: WeekTraining[] = [];
  if (evals.length) {
    const byWeek = new Map<DateKey, number>();
    for (const e of evals) {
      const w = weekStart(e.date);
      byWeek.set(w, (byWeek.get(w) ?? 0) + (e.workoutCount > 0 ? 1 : 0));
    }
    const current = weekStart(today);
    for (const [w, sessions] of byWeek) {
      let outcome: Outcome = sessions >= target ? 'success' : 'fail';
      // The current week isn't over, and a first week that started mid-week isn't fair to judge.
      if (outcome === 'fail' && (w === current || w < start)) outcome = 'neutral';
      weeks.push({ start: w, sessions, outcome });
    }
  }
  const trainingStreak = runStreak(weeks.map((w) => w.outcome));

  const totalXp = evals.reduce((s, e) => s + e.points, 0);
  const fineDays = evals.filter((e, i) => !openFlags[i] && !e.onTime).map((e) => e.date);
  const fineTotal = fineDays.length * data.settings.fineAmount;
  const paid = Object.values(data.payments).reduce((s, p) => s + p.amount, 0);
  const openUnlogged = evals.filter((e, i) => openFlags[i] && !e.closed).map((e) => e.date);

  return {
    today,
    settings: data.settings,
    habits,
    tracks,
    evals,
    evalByDate,
    habitStreaks,
    logStreak,
    trainingStreak,
    weeks,
    totalXp,
    level: levelFor(totalXp),
    fineDays,
    fineTotal,
    paid,
    owed: Math.max(0, fineTotal - paid),
    openUnlogged,
  };
}

/** One day off per Mon–Sun week. Returns the day already used this week, if any. */
export function dayOffUsedInWeek(days: Record<DateKey, DayLog>, date: DateKey): DateKey | null {
  const ws = weekStart(date);
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    if (d !== date && days[d]?.dayOff) return d;
  }
  return null;
}

export interface SlipStats {
  habit: Habit;
  slips7: number;
  slips30: number;
  slipsAll: number;
  cleanDays: number;
  daysSinceSlip: number | null;
  lastSlip: DateKey | null;
  urges7: number;
  urgesPrev7: number;
  urgesAll: number;
  /** £ not spent: clean days × what it cost per day (null if you haven't set a cost). */
  saved: number | null;
  savedSinceSlip: number | null;
}

export function slipStats(summary: Summary): SlipStats[] {
  const { evals, today } = summary;
  return summary.habits.filter((h) => h.kind === 'avoid').map((habit) => {
    let slips7 = 0;
    let slips30 = 0;
    let slipsAll = 0;
    let cleanDays = 0;
    let cleanSinceSlip = 0;
    let urges7 = 0;
    let urgesPrev7 = 0;
    let urgesAll = 0;
    let lastSlip: DateKey | null = null;
    for (const e of evals) {
      const a = e.log?.avoid?.[habit.id];
      const u = e.log?.urges?.[habit.id] ?? 0;
      const ago = diffDays(today, e.date);
      urgesAll += u;
      if (ago < 7) urges7 += u;
      else if (ago < 14) urgesPrev7 += u;
      if (a === 'clean') {
        cleanDays++;
        cleanSinceSlip++;
      }
      if (a !== 'slip') continue;
      cleanSinceSlip = 0;
      slipsAll++;
      lastSlip = e.date;
      if (ago < 7) slips7++;
      if (ago < 30) slips30++;
    }
    const perDay = (summary.settings.costPerWeek?.[habit.id] ?? 0) / 7;
    return {
      habit,
      slips7,
      slips30,
      slipsAll,
      cleanDays,
      lastSlip,
      daysSinceSlip: lastSlip ? diffDays(today, lastSlip) : null,
      urges7,
      urgesPrev7,
      urgesAll,
      saved: perDay > 0 ? Math.round(cleanDays * perDay) : null,
      savedSinceSlip: perDay > 0 ? Math.round(cleanSinceSlip * perDay) : null,
    };
  });
}

/** Total £ saved across every stay-clean habit you've given a cost to (null if none set). */
export function totalSaved(summary: Summary): number | null {
  const list = slipStats(summary).filter((s) => s.saved != null);
  return list.length ? list.reduce((sum, s) => sum + (s.saved ?? 0), 0) : null;
}

/** Longest run of days actually answered "Clean" (allowances and days off don't extend it). */
export function cleanBest(summary: Summary, habitId: string): number | null {
  if (!summary.habits.some((h) => h.id === habitId)) return null;
  let best = 0;
  let run = 0;
  for (const e of summary.evals) {
    const a = e.log?.avoid?.[habitId];
    if (a === 'clean') best = Math.max(best, ++run);
    else if (a === 'slip' || (!e.dayOff && !isOpen(e.date, summary.today))) run = 0;
  }
  return best;
}

/** Completion % for a habit over the last `n` days (only days it was required, excluding days off). */
export function completionRate(summary: Summary, habitId: string, n: number): number | null {
  const idx = summary.habits.findIndex((h) => h.id === habitId);
  if (idx < 0) return null;
  let req = 0;
  let done = 0;
  for (const e of summary.evals.slice(-n)) {
    if (e.dayOff) continue;
    const it = e.items[idx];
    if (!it.required && !it.done) continue;
    req++;
    if (it.done) done++;
  }
  return req ? Math.round((done / req) * 100) : null;
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

export interface HabitRate {
  habit: Habit;
  done: number;
  required: number;
  rate: number;
}

export interface WeekStats {
  start: DateKey;
  /** Days of this week that have been tracked so far. */
  days: number;
  logged: number;
  perfect: number;
  daysOff: number;
  avgPct: number | null;
  xp: number;
  sessions: number;
  slips: Record<string, number>;
  moodAvg: number | null;
  rates: HabitRate[];
}

/** Completion per habit over a set of days (days off excluded). */
export function habitRates(summary: Summary, evals: DayEval[]): HabitRate[] {
  return summary.habits.map((habit, idx) => {
    let done = 0;
    let required = 0;
    for (const e of evals) {
      if (e.dayOff) continue;
      const it = e.items[idx];
      if (!it?.required && !it?.done) continue;
      required++;
      if (it.done) done++;
    }
    return { habit, done, required, rate: required ? done / required : 0 };
  });
}

/** Stats for the Mon–Sun week starting `start`, optionally only up to `until` (for like-for-like comparisons). */
export function weekStats(summary: Summary, start: DateKey, until?: DateKey): WeekStats {
  const end = until && until < addDays(start, 6) ? until : addDays(start, 6);
  const evals = summary.evals.filter((e) => e.date >= start && e.date <= end);
  const scored = evals.filter((e) => e.pct != null);
  const moods = evals.filter((e) => e.log?.mood).map((e) => e.log!.mood as number);
  const slips: Record<string, number> = {};
  for (const h of summary.habits) if (h.kind === 'avoid') slips[h.id] = evals.filter((e) => e.log?.avoid?.[h.id] === 'slip').length;
  return {
    start,
    days: evals.length,
    logged: evals.filter((e) => e.onTime).length,
    perfect: evals.filter((e) => e.perfect).length,
    daysOff: evals.filter((e) => e.dayOff).length,
    avgPct: scored.length ? Math.round(scored.reduce((s, e) => s + (e.pct ?? 0), 0) / scored.length) : null,
    xp: evals.reduce((s, e) => s + e.points, 0),
    sessions: evals.filter((e) => e.workoutCount > 0).length,
    slips,
    moodAvg: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
    rates: habitRates(summary, evals),
  };
}
