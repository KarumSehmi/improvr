/**
 * Credit card spending: you enter what you've spent so far this month (about once a week) and this
 * works out whether you're on pace for your limit, and what you can spend per day / week to finish under it.
 */
// .js endings because this file also runs on the server (server/notify.ts).
import { DEFAULT_BUDGET } from './config.js';
import { addDays, diffDays, type DateKey } from './dates.js';
import type { Settings, SpendEntry } from './types.js';

const pad = (n: number) => String(n).padStart(2, '0');

/** How often you're meant to update it. */
export const UPDATE_EVERY_DAYS = 7;

export function budgetSettings(settings: Settings) {
  const b = { ...DEFAULT_BUDGET, ...settings.budget };
  return { limit: b.limit, ceiling: b.ceiling, startDay: Math.min(28, Math.max(1, Math.round(b.startDay))) };
}

/** The card's month containing `date`: [start, next start). Months can start on any day 1–28. */
export function cardMonth(date: DateKey, startDay = 1): { start: DateKey; next: DateKey } {
  const [y, m, d] = date.split('-').map(Number);
  let [sy, sm] = [y, m];
  if (d < startDay) [sy, sm] = sm === 1 ? [sy - 1, 12] : [sy, sm - 1];
  const [ny, nm] = sm === 12 ? [sy + 1, 1] : [sy, sm + 1];
  return { start: `${sy}-${pad(sm)}-${pad(startDay)}`, next: `${ny}-${pad(nm)}-${pad(startDay)}` };
}

export type BudgetState = 'no-data' | 'on-track' | 'over-pace' | 'over-limit';

export interface BudgetStatus {
  state: BudgetState;
  limit: number;
  ceiling: number;
  start: DateKey;
  /** Last day of the card's month. */
  end: DateKey;
  totalDays: number;
  /** The latest update this month. */
  spent: number;
  asOf: DateKey | null;
  /** Where you'd be if you spent the limit evenly: limit × share of the month gone by `asOf`. */
  pace: number;
  /** Spent minus pace: above 0 means you're spending faster than the limit allows. */
  vsPace: number;
  /** Days of the month after `asOf`. */
  daysLeft: number;
  /** What's left of the limit, and how to spread it over the rest of the month. */
  left: number;
  perDay: number;
  perWeek: number;
  /** Your weekly spend so far, and how much to cut it by to finish under the limit. */
  runPerWeek: number;
  cutPerWeek: number;
  /** Where you'll end up at this rate. */
  projected: number;
  /** No update in the last week (or none this month yet). */
  needsUpdate: boolean;
  /** Updates this month, oldest first. */
  entries: SpendEntry[];
}

export function budgetStatus(spending: Record<string, SpendEntry>, settings: Settings, today: DateKey): BudgetStatus {
  const { limit, ceiling, startDay } = budgetSettings(settings);
  const { start, next } = cardMonth(today, startDay);
  const totalDays = diffDays(next, start);
  const entries = Object.values(spending)
    .filter((e) => e.date >= start && e.date < next && e.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const base = { limit, ceiling, start, end: addDays(next, -1), totalDays, entries };

  if (!latest) {
    const daysLeft = diffDays(next, today);
    return {
      ...base,
      state: 'no-data',
      spent: 0,
      asOf: null,
      pace: 0,
      vsPace: 0,
      daysLeft,
      left: limit,
      perDay: limit / totalDays,
      perWeek: (limit / totalDays) * 7,
      runPerWeek: 0,
      cutPerWeek: 0,
      projected: 0,
      needsUpdate: true,
    };
  }

  const spent = latest.spent;
  const elapsed = diffDays(latest.date, start) + 1; // counting the day of the update
  const daysLeft = Math.max(0, totalDays - elapsed);
  const pace = (limit * elapsed) / totalDays;
  const left = limit - spent;
  const perDay = daysLeft ? Math.max(0, left) / daysLeft : 0;
  const runPerWeek = (spent / elapsed) * 7;
  const state: BudgetState = spent > limit ? 'over-limit' : spent > pace ? 'over-pace' : 'on-track';
  return {
    ...base,
    state,
    spent,
    asOf: latest.date,
    pace,
    vsPace: spent - pace,
    daysLeft,
    left,
    perDay,
    perWeek: perDay * 7,
    runPerWeek,
    cutPerWeek: state === 'over-pace' ? Math.max(0, runPerWeek - perDay * 7) : 0,
    projected: (spent / elapsed) * totalDays,
    needsUpdate: diffDays(today, latest.date) >= UPDATE_EVERY_DAYS,
  };
}

/** Each earlier month's last update (roughly what the month came to), newest first. */
export function pastMonths(spending: Record<string, SpendEntry>, settings: Settings, today: DateKey, count = 3): { start: DateKey; spent: number }[] {
  const { startDay } = budgetSettings(settings);
  const out: { start: DateKey; spent: number }[] = [];
  let { start } = cardMonth(today, startDay);
  for (let i = 0; i < count; i++) {
    const prev = cardMonth(addDays(start, -1), startDay);
    const inMonth = Object.values(spending)
      .filter((e) => e.date >= prev.start && e.date < prev.next)
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = inMonth[inMonth.length - 1];
    if (last) out.push({ start: prev.start, spent: last.spent });
    start = prev.start;
  }
  return out;
}

/** "£1,234" (whole pounds). */
export const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

/** What it all means, in one or two sentences. */
export function budgetMessage(b: BudgetStatus): string {
  const lim = money(b.limit);
  if (b.state === 'no-data') {
    return `Add what you've spent on the card so far this month. Spread evenly, ${lim} is about ${money(b.perDay)} a day (${money(b.perWeek)} a week).`;
  }
  if (b.state === 'over-limit') {
    const over = money(b.spent - b.limit);
    return b.spent >= b.ceiling
      ? `🚨 ${money(b.spent - b.ceiling)} over ${money(b.ceiling)}. Stop using the card for the rest of the month.`
      : `🚨 ${over} over your ${lim} limit. Try not to use the card again this month — you're ${money(b.ceiling - b.spent)} from ${money(b.ceiling)}.`;
  }
  if (!b.daysLeft) return b.state === 'on-track' ? `✅ Month done: ${money(b.left)} under ${lim}.` : `Month done at ${money(b.spent)}.`;
  const spread = `${money(b.perDay)} a day (${money(b.perWeek)} a week)`;
  if (b.state === 'on-track') return `✅ On track, ${money(-b.vsPace)} under pace. You can spend ${spread} for the rest of the month.`;
  return `⚠️ ${money(b.vsPace)} ahead of pace. To finish under ${lim}, keep it to ${spread} — about ${money(b.cutPerWeek)} a week less than you've been spending.`;
}
