/**
 * The day in moments: which part of the day it is, the three check-ins, what's due right now
 * (the number on the app icon), racing yesterday's pace, the daily bonus quest and the reward chest.
 */
// .js endings because this file also runs on the server (server/notify.ts).
import { CHECKINS, QUESTS, SECTIONS, type CheckinId, type Quest, type SectionId } from './config.js';
import { addDays, dateKey, startOfDay, type DateKey } from './dates.js';
import { isOpen, type DayEval, type ItemEval } from './engine.js';
import { openTodos } from './todos.js';
import type { DayLog, Todo } from './types.js';

const HOUR = 3_600_000;

/** Up past midnight still counts as the night before (until 4am), so `hour` runs from 4 to 28. */
export function logicalNow(now: Date): { date: DateKey; hour: number } {
  const h = now.getHours() + now.getMinutes() / 60;
  return h < 4 ? { date: addDays(dateKey(now), -1), hour: h + 24 } : { date: dateKey(now), hour: h };
}

export type Daypart = 'dawn' | 'morning' | 'day' | 'evening' | 'night';

/** Sets the colours of the sky behind everything. */
export function daypart(now: Date): Daypart {
  const h = now.getHours();
  if (h >= 4 && h < 7) return 'dawn';
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** How far through the waking day it is: 0 at 6am, 1 at midnight (where the sun sits in the sky). */
export function dayProgress(now: Date): number {
  return Math.min(1, Math.max(0, (logicalNow(now).hour - 6) / 18));
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export type CheckinState = 'done' | 'open' | 'later' | 'missed';

/** The check-in you can do right now, and when it closes. */
export function currentCheckin(now: Date): { date: DateKey; id: CheckinId; endsAt: number } {
  const { date, hour } = logicalNow(now);
  const c = CHECKINS.find((x) => hour >= x.from && hour < x.to) ?? CHECKINS[0];
  return { date, id: c.id, endsAt: startOfDay(date) + c.to * HOUR };
}

/** Where each check-in stands for a day. Only the current one can be done — no backfilling. */
export function checkinStates(date: DateKey, log: DayLog | undefined, now: Date): Record<CheckinId, CheckinState> {
  const { date: live, hour } = logicalNow(now);
  const out = {} as Record<CheckinId, CheckinState>;
  for (const c of CHECKINS) {
    if (log?.checkins?.[c.id]) out[c.id] = 'done';
    else if (date !== live) out[c.id] = date > live ? 'later' : 'missed';
    else if (hour < c.from) out[c.id] = 'later';
    else out[c.id] = hour < c.to ? 'open' : 'missed';
  }
  return out;
}

// ---------------------------------------------------------------------------
// What's due right now
// ---------------------------------------------------------------------------

const SECTION_FROM = Object.fromEntries(SECTIONS.map((s) => [s.id, s.from])) as Record<SectionId, number>;

/** Before its hour a section is "later" and folded away on Today. */
export function sectionLater(id: SectionId, hour: number): boolean {
  return hour < (SECTION_FROM[id] ?? 0);
}

export interface SectionStatus {
  /** Items shown in the section today. */
  items: ItemEval[];
  total: number;
  done: number;
  /** Answered "no" (missed, slipped, didn't do it). */
  missed: number;
  /** Not answered yet. */
  open: ItemEval[];
  /** Everything done. */
  complete: boolean;
  /** Everything answered, done or not — nothing left to do here today. */
  closed: boolean;
}

export function sectionStatus(e: DayEval, id: SectionId): SectionStatus {
  const items = e.items.filter((i) => i.habit.section === id && i.visible);
  const req = items.filter((i) => i.required);
  const done = req.filter((i) => i.done).length;
  const open = req.filter((i) => !i.done && !i.missed);
  return { items, total: req.length, done, missed: req.length - done - open.length, open, complete: req.length > 0 && done === req.length, closed: req.length > 0 && !open.length };
}

/** Still-open items whose part of the day has started. */
export function dueNow(e: DayEval, hour: number): ItemEval[] {
  if (e.dayOff || e.closed) return [];
  return e.items.filter((i) => i.required && !i.done && !i.missed && !i.skipped && !sectionLater(i.habit.section, hour));
}

/** The number on the app icon: what could be done right now, plus open to-dos. */
export function badgeCount(e: DayEval | undefined, hour: number, todos: Record<string, Todo>, today: DateKey): number {
  return (e ? dueNow(e, hour).length : 0) + openTodos(todos, today).length;
}

/** Days in a row with all three check-ins (today only counts once it's done). */
export function hatTrickStreak(evals: DayEval[]): number {
  let n = 0;
  for (let i = evals.length - 1; i >= 0; i--) {
    if (evals[i].checkins >= CHECKINS.length) n++;
    else if (i < evals.length - 1) break;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Racing yesterday
// ---------------------------------------------------------------------------

/**
 * How many things you'd done by this time of day, today vs yesterday (`final` = yesterday's total).
 * Null until yesterday has tick times to race against (they're recorded from now on).
 */
export function pace(e: DayEval, prev: DayEval | undefined, now: number): { you: number; them: number; final: number } | null {
  if (!prev || prev.dayOff || e.dayOff) return null;
  const times = prev.log?.doneAt ?? {};
  if (Object.keys(times).length < 3) return null;
  const offset = now - startOfDay(e.date);
  const start = startOfDay(prev.date);
  const done = prev.items.filter((i) => i.required && i.done);
  const them = done.filter((i) => times[i.habit.id] != null && times[i.habit.id] - start <= offset).length;
  return { you: e.completed, them, final: done.length };
}

// ---------------------------------------------------------------------------
// Bonus quest
// ---------------------------------------------------------------------------

export const QUEST_SWAPS = 1;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Today's quest (the same all day, on every device). Swapping moves to a different one. */
export function questFor(date: DateKey, swap = 0): Quest {
  return QUESTS[(hash(date) + swap * 7) % QUESTS.length];
}

// ---------------------------------------------------------------------------
// Reward chest: lock the day in on time and it pays out a random amount of XP
// ---------------------------------------------------------------------------

export const CHEST_TIERS = [
  { tier: 'common', label: 'Common', xp: 10, color: 'gray', odds: 0.55, golden: 0.25 },
  { tier: 'rare', label: 'Rare', xp: 20, color: 'blue', odds: 0.28, golden: 0.4 },
  { tier: 'epic', label: 'Epic', xp: 40, color: 'grape', odds: 0.13, golden: 0.25 },
  { tier: 'legendary', label: 'Legendary', xp: 75, color: 'yellow', odds: 0.04, golden: 0.1 },
] as const;

export type ChestTier = (typeof CHEST_TIERS)[number];

/** A perfect day gets a golden chest with better odds. */
export function rollChest(golden: boolean, r = Math.random()): ChestTier {
  let acc = 0;
  for (const t of CHEST_TIERS) {
    acc += golden ? t.golden : t.odds;
    if (r < acc) return t;
  }
  return CHEST_TIERS[0];
}

export function chestTier(xp: number): ChestTier {
  return [...CHEST_TIERS].reverse().find((t) => xp >= t.xp) ?? CHEST_TIERS[0];
}

/** Locked in on time, not opened yet, and still inside the logging window. */
export function chestReady(e: DayEval | undefined, today: DateKey): boolean {
  return !!e && e.onTime && !e.dayOff && e.log?.chest == null && isOpen(e.date, today);
}
