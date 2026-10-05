import { describe, expect, it } from 'vitest';
import { defaultSettings } from './config';
import { addDays, startOfDay } from './dates';
import { summarize } from './engine';
import { habitHistory, personalBests, scoreTrend } from './trend';
import type { AppData, DayLog } from './types';

const START = '2026-08-03'; // Monday

function data(days: Record<string, DayLog> = {}, extra: Partial<AppData['settings']> = {}): AppData {
  return { days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: { ...defaultSettings(START), ...extra } };
}

const locked = (date: string, log: DayLog = {}): DayLog => ({ ...log, closedAt: startOfDay(date) + 20 * 3600e3 });

describe('score trend', () => {
  it('only counts finished days, and smooths them with a 7-day average', () => {
    const days: Record<string, DayLog> = {};
    for (let i = 0; i < 10; i++) days[addDays(START, i)] = locked(addDays(START, i), { done: { pills: true, faceAm: true } });
    const yesterday = addDays(START, 10);
    const today = addDays(START, 11);
    days[yesterday] = { done: { pills: true } }; // not locked in, still inside its window
    days[today] = { done: { pills: true } };
    const s = summarize(data(days), today);
    const t = scoreTrend(s, 12);
    const p = Object.fromEntries(t.points.map((x) => [x.date, x]));

    expect(t.points).toHaveLength(12);
    expect(p[today].score).toBeNull();
    expect(p[yesterday].score).toBeNull();
    expect(p[START].score).toBe(s.evalByDate[START].pct);
    expect(p[START].avg).toBeNull(); // one day isn't a trend
    const first3 = [0, 1, 2].map((i) => p[addDays(START, i)].score as number);
    expect(p[addDays(START, 2)].avg).toBe(Math.round(first3.reduce((a, b) => a + b) / 3));
    expect(t.scored).toBe(10);
    expect(t.recent).not.toBeNull();
    expect(t.previous).toBeNull(); // nothing before these
  });

  it('skips days off, and a day you never logged still counts with whatever you ticked', () => {
    const days: Record<string, DayLog> = {
      [START]: locked(START, { done: { pills: true } }),
      [addDays(START, 1)]: locked(addDays(START, 1), { dayOff: true }),
      [addDays(START, 2)]: {}, // forgotten, and its window has long passed
    };
    const t = scoreTrend(summarize(data(days), addDays(START, 6)), 7);
    const p = Object.fromEntries(t.points.map((x) => [x.date, x]));
    expect(p[addDays(START, 1)].score).toBeNull();
    expect(p[addDays(START, 2)].score).toBe(0);
    expect(p[addDays(START, 3)].score).toBe(0); // no log at all, past its deadline
  });
});

describe('personal bests', () => {
  it('finds the best day (most recent on a tie), best full week and longest log streak', () => {
    const days: Record<string, DayLog> = {};
    const full = { done: { pills: true, faceAm: true, macro: true, protein: true, facePm: true, weigh: true, sleep: true, wake: true }, water: 3, finMl: 1, avoid: { vape: 'clean', porn: 'clean', alcohol: 'clean', caffeine: 'clean' } } as DayLog;
    for (let i = 0; i < 14; i++) days[addDays(START, i)] = locked(addDays(START, i), i % 7 === 3 ? { done: { pills: true } } : structuredClone(full));
    days[addDays(START, 14)] = structuredClone(full); // today: not locked in yet, so it doesn't count
    const s = summarize(data(days), addDays(START, 14));
    const b = personalBests(s);
    const bestPct = Math.max(...s.evals.slice(0, 14).map((e) => e.pct ?? 0));
    expect(b.bestDay?.pct).toBe(bestPct);
    // The last day with that score wins the tie.
    expect(b.bestDay?.date).toBe(s.evals.slice(0, 14).filter((e) => e.pct === bestPct).at(-1)?.date);
    expect(b.bestWeek?.start).toBeDefined();
    expect(b.bestWeek?.avg).toBeGreaterThan(50);
    expect(b.longestLog).toBe(14);
    expect(b.mostXp?.xp).toBe(Math.max(...s.evals.slice(0, 14).map((e) => e.points)));
  });

  it('has nothing to show before the first finished day', () => {
    expect(personalBests(summarize(data(), START))).toMatchObject({ bestDay: null, bestWeek: null, mostXp: null, longestLog: 0 });
  });
});

describe('habit history dots', () => {
  it('shows the last 7 days, today last', () => {
    const today = addDays(START, 8); // Tuesday
    const days: Record<string, DayLog> = {
      [addDays(START, 2)]: { done: { pills: true } },
      [addDays(START, 3)]: locked(addDays(START, 3), { dayOff: true }),
      [addDays(START, 4)]: locked(addDays(START, 4), { done: { pills: false } }),
      [addDays(START, 5)]: locked(addDays(START, 5), { done: { pills: true } }),
    };
    const s = summarize(data(days), today);
    const pills = habitHistory(s, 'pills');
    expect(pills.map((d) => d.date)).toEqual([2, 3, 4, 5, 6, 7, 8].map((i) => addDays(START, i)));
    expect(pills.map((d) => d.state)).toEqual(['done', 'off', 'missed', 'done', 'missed', 'open', 'open']);
    // A chore only counts from its day: hoover is a Saturday job, and it carries over until it's done.
    expect(habitHistory(s, 'hoover').map((d) => d.state)).toEqual(['none', 'none', 'none', 'missed', 'missed', 'open', 'open']);
    // Habits added later don't count before they existed.
    expect(habitHistory(s, 'teethAm').every((d) => d.state === 'none')).toBe(true);
  });
});
