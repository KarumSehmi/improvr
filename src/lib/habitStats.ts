/**
 * Everything about one habit over time, for its stats page: how each day went, week by week, which days
 * of the week, its runs, when cravings hit, what goes with slips — and for sleep and wake, the times.
 * Pure functions over the summary, so they're easy to test.
 */
import { WEEKDAYS, clockLabel, sleepTargets, timeOnTarget, type Habit } from './config';
import { PARTS, partOf } from './cravings';
import { addDays, diffDays, fmt, maxKey, minKey, weekday, weekStart, type DateKey } from './dates';
import { habitOutcome, isOpen, slipFineAmount, type DayEval, type Summary } from './engine';
import { pctWithout } from './insights';
import { formatDuration, loggedTime, minutesToClock, nightOf, timeScale, typicalTime } from './sleep';

// ---------------------------------------------------------------------------
// The range you're looking at
// ---------------------------------------------------------------------------

export type StatsRange = '30' | '90' | 'all';

export const RANGES: { value: StatsRange; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All time' },
];

/** First day of the range: the last 30 or 90 days, or everything — never before you started. */
export function rangeStart(summary: Summary, range: StatsRange): DateKey {
  const first = summary.evals[0]?.date ?? summary.today;
  return range === 'all' ? first : maxKey(first, addDays(summary.today, -(Number(range) - 1)));
}

const inRange = (summary: Summary, from: DateKey) => summary.evals.filter((e) => e.date >= from);
const indexOf = (summary: Summary, habitId: string) => summary.habits.findIndex((h) => h.id === habitId);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ---------------------------------------------------------------------------
// One day at a time
// ---------------------------------------------------------------------------

/**
 * How a day went for a habit: done, missed (an honest no, a slip, or a finished day without it), a slip inside
 * your weekly allowance, blank (a stay-clean day that was never answered), still open, a day off, or not due.
 */
export type DayState = 'done' | 'missed' | 'allowed' | 'blank' | 'open' | 'off' | 'none';

export function dayState(summary: Summary, idx: number, e: DayEval | undefined): DayState {
  const item = e?.items[idx];
  if (!e || !item || !item.visible) return 'none';
  if (item.allowance?.allowed) return 'allowed';
  if (e.dayOff) return item.done ? 'done' : item.missed ? 'missed' : 'off';
  const open = isOpen(e.date, summary.today);
  const o = habitOutcome(item, e, open);
  if (o === 'success') return 'done';
  if (o === 'fail') return item.missed || item.habit.kind !== 'avoid' ? 'missed' : 'blank';
  return item.required && open ? 'open' : 'none';
}

/** Every day of a month (as a Mon–Sun grid needs them) with how it went; null pads the first week. */
export function monthDays(summary: Summary, habitId: string, month: DateKey): ({ date: DateKey; state: DayState } | null)[] {
  const idx = indexOf(summary, habitId);
  const first = `${month.slice(0, 7)}-01`;
  const pad = (weekday(first) + 6) % 7;
  const out: ({ date: DateKey; state: DayState } | null)[] = Array.from({ length: pad }, () => null);
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) out.push({ date: d, state: dayState(summary, idx, summary.evalByDate[d]) });
  return out;
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

export interface Tally {
  /** Days in the range so far. */
  days: number;
  done: number;
  missed: number;
  allowed: number;
  blank: number;
  open: number;
  off: number;
  /** Days with an outcome (done, missed, allowed or blank). */
  judged: number;
  /** Done (and allowed) out of judged, as a %. Null with nothing judged yet. */
  rate: number | null;
}

function tally(states: DayState[]): Tally {
  const n = (s: DayState) => states.filter((x) => x === s).length;
  const t = { days: states.length, done: n('done'), missed: n('missed'), allowed: n('allowed'), blank: n('blank'), open: n('open'), off: n('off') };
  const judged = t.done + t.missed + t.allowed + t.blank;
  return { ...t, judged, rate: pct(t.done + t.allowed, judged) };
}

/** How the range went, day by day, added up. */
export function rangeTally(summary: Summary, habitId: string, from: DateKey): Tally {
  const idx = indexOf(summary, habitId);
  return tally(inRange(summary, from).map((e) => dayState(summary, idx, e)));
}

/** The most recent day in the range that went a certain way (say the last miss), if any. */
export function lastDay(summary: Summary, habitId: string, from: DateKey, state: DayState): DateKey | null {
  const idx = indexOf(summary, habitId);
  return inRange(summary, from).findLast((e) => dayState(summary, idx, e) === state)?.date ?? null;
}

export interface Period extends Tally {
  start: DateKey;
  label: string;
}

/** Week by week through the range (month by month once it's longer than half a year), for the bar chart. */
export function periods(summary: Summary, habitId: string, from: DateKey): Period[] {
  const idx = indexOf(summary, habitId);
  const evals = inRange(summary, from);
  const monthly = diffDays(summary.today, from) > 26 * 7;
  const groups = new Map<DateKey, DayState[]>();
  for (const e of evals) {
    const key = monthly ? `${e.date.slice(0, 7)}-01` : weekStart(e.date);
    groups.set(key, [...(groups.get(key) ?? []), dayState(summary, idx, e)]);
  }
  return [...groups].map(([start, states]) => ({ start, label: fmt(start, monthly ? 'MMM' : 'D MMM'), ...tally(states) }));
}

export interface WeekdayStat extends Tally {
  /** 0 Sun … 6 Sat. */
  day: number;
}

/** Each day of the week across the range, Monday first. */
export function byWeekday(summary: Summary, habitId: string, from: DateKey): WeekdayStat[] {
  const idx = indexOf(summary, habitId);
  const evals = inRange(summary, from);
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, ...tally(evals.filter((e) => weekday(e.date) === day).map((e) => dayState(summary, idx, e))) }));
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export interface Run {
  from: DateKey;
  to: DateKey;
  length: number;
  /** Still going. */
  current: boolean;
}

/** Every run of days in a row, longest first — counted exactly like the streak on Today. */
export function runs(summary: Summary, habitId: string): Run[] {
  const idx = indexOf(summary, habitId);
  if (idx < 0) return [];
  const h = summary.habits[idx];
  const out: Run[] = [];
  let cur: Run | null = null;
  for (const e of summary.evals) {
    const item = e.items[idx];
    const open = isOpen(e.date, summary.today);
    const o = h.optional && item.visible && !item.done && !open && !e.dayOff ? 'fail' : habitOutcome(item, e, open);
    if (o === 'success') {
      if (cur) {
        cur.to = e.date;
        cur.length++;
      } else cur = { from: e.date, to: e.date, length: 1, current: false };
    } else if (o === 'fail' && cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push({ ...cur, current: true });
  return out.sort((a, b) => b.length - a.length || b.to.localeCompare(a.to));
}

// ---------------------------------------------------------------------------
// Stay-clean habits: slips and cravings
// ---------------------------------------------------------------------------

export interface CleanStats {
  clean: number;
  slips: number;
  /** Slips inside the weekly allowance (e.g. your one drinking night). */
  allowed: number;
  /** Days nobody answered. */
  unanswered: number;
  urges: number;
  /** Average days from one slip to the next (needs 2 slips). */
  gap: number | null;
}

export function cleanStats(summary: Summary, habitId: string, from: DateKey): CleanStats {
  const idx = indexOf(summary, habitId);
  const evals = inRange(summary, from);
  const slipDays = evals.filter((e) => e.log?.avoid?.[habitId] === 'slip').map((e) => e.date);
  const gaps = slipDays.slice(1).map((d, i) => diffDays(d, slipDays[i]));
  const states = evals.map((e) => dayState(summary, idx, e));
  return {
    clean: evals.filter((e) => e.log?.avoid?.[habitId] === 'clean').length,
    slips: slipDays.length,
    allowed: states.filter((s) => s === 'allowed').length,
    unanswered: states.filter((s) => s === 'blank').length,
    urges: evals.reduce((n, e) => n + (e.log?.urges?.[habitId] ?? 0), 0),
    gap: gaps.length ? Math.round(mean(gaps)!) : null,
  };
}

/** Cravings you beat, by part of the day (from the SOS and "beat an urge"). */
export function cravingTimes(summary: Summary, habitId: string, from: DateKey): { id: string; name: string; emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of inRange(summary, from)) for (const at of e.log?.urgeAt?.[habitId] ?? []) counts.set(partOf(at).id, (counts.get(partOf(at).id) ?? 0) + 1);
  return PARTS.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, count: counts.get(p.id) ?? 0 }));
}

export interface Slip {
  date: DateKey;
  /** Inside your weekly allowance (free, streak safe). */
  allowed: boolean;
  /** What it cost in charity fines (0 = nothing). */
  fine: number;
  lateNight: boolean;
  drinking: boolean;
  urges: number;
  note?: string;
}

/** Each slip in the range, newest first, with what else was going on that day. */
export function slipLog(summary: Summary, habitId: string, from: DateKey): Slip[] {
  const idx = indexOf(summary, habitId);
  return inRange(summary, from)
    .filter((e) => e.log?.avoid?.[habitId] === 'slip')
    .map((e) => {
      const allowed = !!e.items[idx]?.allowance?.allowed;
      return {
        date: e.date,
        allowed,
        fine: allowed ? 0 : slipFineAmount(summary.settings, habitId, e.date),
        lateNight: e.log?.done?.sleep === false,
        drinking: habitId !== 'alcohol' && e.log?.avoid?.alcohol === 'slip',
        urges: e.log?.urges?.[habitId] ?? 0,
        note: e.log?.note?.trim() || undefined,
      };
    })
    .reverse();
}

// ---------------------------------------------------------------------------
// Sleep and wake: the times themselves
// ---------------------------------------------------------------------------

export interface TimePoint {
  date: DateKey;
  time: string | null;
  /** On the habit's scale (minutes, the evening before midnight for sleep). */
  scale: number | null;
  ok: boolean | null;
  /** Hours asleep that night, in minutes (when both times are known). */
  mins: number | null;
}

export interface TimeStats {
  /** Every day in the range, oldest first. */
  points: TimePoint[];
  /** Days with a time, and days with an answer (a plain "yes" from before has no time). */
  logged: number;
  answered: number;
  onTarget: number;
  /** The middle of your times (one odd night doesn't move it). */
  usual: string | null;
  /** How far a time usually lands from the usual one, in minutes. */
  spread: number | null;
  weekdayUsual: string | null;
  weekendUsual: string | null;
  /** Average sleep a night (minutes) and how many nights that's from. */
  avgSleep: number | null;
  nights: number;
}

export function timeStats(summary: Summary, habitId: string, from: DateKey): TimeStats {
  const points: TimePoint[] = inRange(summary, from).map((e) => {
    const time = loggedTime(habitId, e.log);
    const answer = e.log?.done?.[habitId];
    return {
      date: e.date,
      time,
      scale: time ? timeScale(habitId, time) : null,
      ok: time ? (answer ?? timeOnTarget(habitId, time, sleepTargets(summary.settings, e.date))) : (answer ?? null),
      mins: nightOf(e.log).mins,
    };
  });
  const timed = points.filter((p) => p.time);
  const usual = typicalTime(habitId, timed.map((p) => p.time!));
  const weekend = (p: TimePoint) => [0, 6].includes(weekday(p.date));
  const typical = (ps: TimePoint[]) => (ps.length >= 3 ? typicalTime(habitId, ps.map((p) => p.time!)) : null);
  const spread = usual && timed.length >= 3 ? Math.round(mean(timed.map((p) => Math.abs(p.scale! - timeScale(habitId, usual))))! / 5) * 5 : null;
  const slept = points.filter((p) => p.mins != null);
  return {
    points,
    logged: timed.length,
    answered: points.filter((p) => p.ok != null).length,
    onTarget: points.filter((p) => p.ok === true).length,
    usual,
    spread,
    weekdayUsual: typical(timed.filter((p) => !weekend(p))),
    weekendUsual: typical(timed.filter(weekend)),
    avgSleep: slept.length ? Math.round(mean(slept.map((p) => p.mins!))!) : null,
    nights: slept.length,
  };
}

// ---------------------------------------------------------------------------
// Everyday habits: amounts and when you tick them off
// ---------------------------------------------------------------------------

/** When you usually tick it off (the middle of the tick times, to 5 minutes), once there are 5. */
export function usualTick(summary: Summary, habitId: string, from: DateKey): string | null {
  const mins = inRange(summary, from)
    .map((e) => e.log?.doneAt?.[habitId])
    .filter((at): at is number => at != null)
    .map((at) => {
      const m = new Date(at).getHours() * 60 + new Date(at).getMinutes();
      // The app's day runs 4am to 4am, so a tick at 1am is late in the evening, not early in the morning.
      return m < 240 ? m + 1440 : m;
    })
    .sort((a, b) => a - b);
  if (mins.length < 5) return null;
  const mid = Math.floor(mins.length / 2);
  const m = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
  return minutesToClock(Math.round(m / 5) * 5);
}

/** Water and count habits: the average a day (over days it was due) and how often you hit the target. */
export function amounts(summary: Summary, habit: Habit, from: DateKey): { avg: number | null; days: number } {
  const idx = indexOf(summary, habit.id);
  const due = inRange(summary, from).filter((e) => e.items[idx]?.visible && !e.dayOff && !isOpen(e.date, summary.today));
  const value = (e: DayEval) => (habit.kind === 'water' ? (e.log?.water ?? 0) : (e.log?.counts?.[habit.id] ?? 0));
  const avg = mean(due.map(value));
  return { avg: avg == null ? null : Math.round(avg * 10) / 10, days: due.length };
}

// ---------------------------------------------------------------------------
// Patterns: plain sentences, only once there's enough behind them
// ---------------------------------------------------------------------------

export interface Pattern {
  id: string;
  emoji: string;
  text: string;
  tone: 'good' | 'bad' | 'tip';
}

const share = (xs: DayEval[], test: (e: DayEval) => boolean) => pct(xs.filter(test).length, xs.length) ?? 0;
const moodOf = (xs: DayEval[]) => mean(xs.map((e) => e.log?.mood).filter((m): m is number => !!m));
const energyOf = (e: DayEval) => mean(Object.values(e.log?.checkins ?? {}).map((c) => c.energy));
const slipWord = (h: Habit) => h.label.replace(/^No /i, '').toLowerCase();

export function patterns(summary: Summary, habitId: string, from: DateKey): Pattern[] {
  const idx = indexOf(summary, habitId);
  if (idx < 0) return [];
  const h = summary.habits[idx];
  const has = (id: string) => summary.habits.some((x) => x.id === id);
  const evals = inRange(summary, from);
  const out: Pattern[] = [];

  if (h.kind === 'avoid') {
    const answered = evals.filter((e) => e.log?.avoid?.[habitId]);
    const slipped = (e: DayEval) => e.log?.avoid?.[habitId] === 'slip';

    // Late nights
    if (has('sleep')) {
      const late = answered.filter((e) => e.log?.done?.sleep === false);
      const early = answered.filter((e) => e.log?.done?.sleep === true);
      if (late.length >= 3 && early.length >= 3) {
        const [pl, pe] = [share(late, slipped), share(early, slipped)];
        if (pl - pe >= 10) out.push({ id: 'late', emoji: '🌙', tone: 'tip', text: `You slip on ${pl}% of days after a late night, vs ${pe}% after an early one. Protect your bedtime.` });
        else if (late.length >= 5 && early.length >= 5 && Math.abs(pl - pe) < 10) out.push({ id: 'late', emoji: '🌙', tone: 'good', text: `Late nights don't seem to make slips more likely (${pl}% vs ${pe}% after early ones).` });
      }
    }

    // Drinking days
    if (habitId !== 'alcohol' && has('alcohol')) {
      const drinking = answered.filter((e) => e.log?.avoid?.alcohol === 'slip');
      const dry = answered.filter((e) => e.log?.avoid?.alcohol === 'clean');
      if (drinking.length >= 2 && dry.length >= 3) {
        const [pd, pdry] = [share(drinking, slipped), share(dry, slipped)];
        if (pd - pdry >= 10) out.push({ id: 'drink', emoji: '🍺', tone: 'tip', text: `On drinking days you slip ${pd}% of the time, vs ${pdry}% on dry days. Go out with a plan.` });
      }
    }

    // Mood
    const moodSlip = moodOf(answered.filter(slipped));
    const moodClean = moodOf(answered.filter((e) => !slipped(e)));
    if (moodSlip != null && moodClean != null && answered.filter((e) => slipped(e) && e.log?.mood).length >= 2 && moodClean - moodSlip >= 0.3) {
      out.push({ id: 'mood', emoji: '🙂', tone: 'tip', text: `Your mood averages ${moodClean.toFixed(1)}/5 on clean days and ${moodSlip.toFixed(1)}/5 on days you slip.` });
    }

    // Which day of the week
    const slips = answered.filter(slipped);
    if (slips.length >= 3) {
      const counts = new Array(7).fill(0);
      slips.forEach((e) => counts[weekday(e.date)]++);
      const top = counts.indexOf(Math.max(...counts));
      if (counts[top] / slips.length >= 0.4) out.push({ id: 'weekday', emoji: '📆', tone: 'tip', text: `Most slips land on ${WEEKDAYS[top]}s (${counts[top]} of ${slips.length}). Plan that day in advance.` });
    }

    // When cravings hit
    const parts = cravingTimes(summary, habitId, from);
    const total = parts.reduce((n, p) => n + p.count, 0);
    const peak = [...parts].sort((a, b) => b.count - a.count)[0];
    if (total >= 5 && peak.count / total >= 0.4) {
      out.push({ id: 'cravings', emoji: '🆘', tone: 'tip', text: `Most cravings hit ${PARTS.find((p) => p.id === peak.id)!.label} (${peak.count} of ${total}). Have something ready for then.` });
    }

    // Time between slips
    const c = cleanStats(summary, habitId, from);
    if (c.gap != null) out.push({ id: 'gap', emoji: '⏳', tone: 'tip', text: `You go about ${c.gap} day${c.gap === 1 ? '' : 's'} between slips. Your best run is ${summary.habitStreaks[habitId]?.best ?? 0} — beat it.` });
    else if (c.slips === 0 && answered.length >= 7) out.push({ id: 'gap', emoji: '🏆', tone: 'good', text: `Not one ${slipWord(h)} slip in this stretch. That's who you are now.` });
    return out;
  }

  // Finished days only: the ones that can't change any more.
  const finished = evals.filter((e) => !e.dayOff && (e.closed || !isOpen(e.date, summary.today)));

  if (h.kind === 'time') {
    const what = habitId === 'sleep' ? 'a night asleep on time' : 'a morning up on time';
    const onTime = finished.filter((e) => e.log?.done?.[habitId] === true);
    const late = finished.filter((e) => e.log?.done?.[habitId] === false);
    const rest = new Set(['sleep', 'wake']);
    const score = (xs: DayEval[]) => mean(xs.map((e) => pctWithout(e, rest)).filter((x): x is number => x != null));
    const [a, b] = [score(onTime), score(late)];
    if (onTime.length >= 3 && late.length >= 3 && a != null && b != null && a - b >= 8) {
      out.push({ id: 'score', emoji: '📈', tone: 'tip', text: `After ${what} you get ${Math.round(a)}% of the rest of your list done, vs ${Math.round(b)}% when you're late.` });
    }
    const [ma, mb] = [moodOf(onTime), moodOf(late)];
    if (ma != null && mb != null && ma - mb >= 0.3) out.push({ id: 'mood', emoji: '🙂', tone: 'tip', text: `Your mood is ${ma.toFixed(1)}/5 after ${what}, ${mb.toFixed(1)} after a late one.` });
    const energy = (xs: DayEval[]) => mean(xs.map(energyOf).filter((x): x is number => x != null));
    const [ea, eb] = [energy(onTime), energy(late)];
    if (ea != null && eb != null && ea - eb >= 0.3) out.push({ id: 'energy', emoji: '🔋', tone: 'tip', text: `Your energy is ${ea.toFixed(1)}/5 after ${what}, vs ${eb.toFixed(1)} after a late one.` });
    if (habitId === 'sleep') {
      for (const x of summary.habits.filter((y) => y.kind === 'avoid')) {
        const lateAns = late.filter((e) => e.log?.avoid?.[x.id]);
        const onAns = onTime.filter((e) => e.log?.avoid?.[x.id]);
        if (lateAns.length < 3 || onAns.length < 3) continue;
        const [pl, po] = [share(lateAns, (e) => e.log?.avoid?.[x.id] === 'slip'), share(onAns, (e) => e.log?.avoid?.[x.id] === 'slip')];
        if (pl - po >= 10) out.push({ id: `slips-${x.id}`, emoji: x.emoji, tone: 'tip', text: `${slipWord(x).replace(/^\w/, (ch) => ch.toUpperCase())} slips: ${pl}% of days after a late night, ${po}% after an early one.` });
      }
    }
    const t = timeStats(summary, habitId, from);
    const noun = habitId === 'sleep' ? 'bedtime' : 'wake-up';
    if (t.usual && t.spread != null) {
      out.push({ id: 'spread', emoji: '🎯', tone: t.spread <= 30 ? 'good' : 'tip', text: `Your ${noun} usually lands within ${formatDuration(t.spread)} of ${clockLabel(t.usual)}${t.spread > 45 ? ' — a steadier time makes it easier' : ''}.` });
    }
    if (t.weekdayUsual && t.weekendUsual && t.weekdayUsual !== t.weekendUsual) {
      out.push({ id: 'weekend', emoji: '🛋️', tone: 'tip', text: `${habitId === 'sleep' ? 'Asleep' : 'Up'} around ${clockLabel(t.weekdayUsual)} on weekdays and ${clockLabel(t.weekendUsual)} at the weekend.` });
    }
    return out;
  }

  // Everything else: what doing it goes with
  const did = finished.filter((e) => e.items[idx]?.required && e.items[idx].done);
  const didnt = finished.filter((e) => e.items[idx]?.required && !e.items[idx].done);
  const self = new Set([habitId]);
  const score = (xs: DayEval[]) => mean(xs.map((e) => pctWithout(e, self)).filter((x): x is number => x != null));
  const [a, b] = [score(did), score(didnt)];
  if (did.length >= 3 && didnt.length >= 3 && a != null && b != null && a - b >= 8) {
    out.push({ id: 'score', emoji: '📈', tone: 'tip', text: `On days you do it you get ${Math.round(a)}% of the rest of your list done, vs ${Math.round(b)}% when you don't.` });
  }
  const [ma, mb] = [moodOf(did), moodOf(didnt)];
  if (ma != null && mb != null && did.filter((e) => e.log?.mood).length >= 3 && didnt.filter((e) => e.log?.mood).length >= 3 && ma - mb >= 0.3) {
    out.push({ id: 'mood', emoji: '🙂', tone: 'tip', text: `Your mood is ${ma.toFixed(1)}/5 on days you do it, ${mb.toFixed(1)} on days you don't.` });
  }
  if (has('sleep')) {
    const required = finished.filter((e) => e.items[idx]?.required);
    const afterEarly = required.filter((e) => e.log?.done?.sleep === true);
    const afterLate = required.filter((e) => e.log?.done?.sleep === false);
    if (afterEarly.length >= 3 && afterLate.length >= 3) {
      const [pe, pl] = [share(afterEarly, (e) => e.items[idx].done), share(afterLate, (e) => e.items[idx].done)];
      if (pe - pl >= 15) out.push({ id: 'sleep', emoji: '😴', tone: 'tip', text: `After an early night you do it ${pe}% of the time, vs ${pl}% after a late one.` });
    }
  }
  const week = byWeekday(summary, habitId, from).filter((w) => w.judged >= 2 && w.rate != null);
  if (week.length >= 5) {
    const best = week.reduce((x, y) => (y.rate! > x.rate! ? y : x));
    const worst = week.reduce((x, y) => (y.rate! < x.rate! ? y : x));
    if (best.rate! - worst.rate! >= 20) out.push({ id: 'weekday', emoji: '📅', tone: 'tip', text: `Best on ${WEEKDAYS[best.day]}s (${best.rate}%), weakest on ${WEEKDAYS[worst.day]}s (${worst.rate}%).` });
  }
  // Better than the fortnight before?
  const recent = rangeTally(summary, habitId, addDays(summary.today, -13));
  const before = tallyBetween(summary, habitId, addDays(summary.today, -27), addDays(summary.today, -14));
  if (recent.judged >= 5 && before.judged >= 5 && recent.rate != null && before.rate != null) {
    const d = recent.rate - before.rate;
    if (d >= 15) out.push({ id: 'trend', emoji: '🚀', tone: 'good', text: `Up ${d}% on the fortnight before (${recent.rate}% vs ${before.rate}%). Keep going.` });
    else if (d <= -15) out.push({ id: 'trend', emoji: '📉', tone: 'bad', text: `Down ${-d}% on the fortnight before (${recent.rate}% vs ${before.rate}%). Make it this week's focus?` });
  }
  return out;
}

function tallyBetween(summary: Summary, habitId: string, from: DateKey, to: DateKey): Tally {
  const idx = indexOf(summary, habitId);
  return tally(summary.evals.filter((e) => e.date >= from && e.date <= minKey(to, summary.today)).map((e) => dayState(summary, idx, e)));
}
