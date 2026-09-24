import { describe, expect, it } from 'vitest';
import { achievements } from './achievements';
import { defaultSettings } from './config';
import { addDays, startOfDay } from './dates';
import { slipStats, summarize, totalSaved } from './engine';
import { dueNudges } from './nudges';
import type { AppData, DayLog, Settings } from './types';

const START = '2026-09-21'; // Monday

function data(days: Record<string, DayLog> = {}, extra: Partial<Settings> = {}): AppData {
  return { days, events: {}, birthdays: {}, payments: {}, todos: {}, settings: { ...defaultSettings(START), ...extra } };
}
const item = (d: AppData, date: string, id: string, today = date) => summarize(d, today).evalByDate[date].items.find((i) => i.habit.id === id)!;

describe('weekly allowance (alcohol)', () => {
  it('the first drinking night of the week is fine, the second is a slip', () => {
    const d = data({
      '2026-09-21': { avoid: { alcohol: 'clean' } },
      '2026-09-22': { avoid: { alcohol: 'slip' } },
      '2026-09-24': { avoid: { alcohol: 'slip' } },
      '2026-09-28': { avoid: { alcohol: 'slip' } }, // new week, allowance resets
    });
    expect(item(d, '2026-09-22', 'alcohol', '2026-09-28')).toMatchObject({ done: true, missed: false, allowance: { used: 1, limit: 1, allowed: true } });
    expect(item(d, '2026-09-24', 'alcohol', '2026-09-28')).toMatchObject({ done: false, missed: true, allowance: { used: 2, allowed: false } });
    expect(item(d, '2026-09-28', 'alcohol')).toMatchObject({ done: true, missed: false });
  });

  it('an allowed night keeps the streak but earns no XP, and you can set your own limit', () => {
    const d = data({ '2026-09-21': { avoid: { alcohol: 'clean' } }, '2026-09-22': { avoid: { alcohol: 'slip' } } });
    const s = summarize(d, '2026-09-22');
    expect(s.habitStreaks.alcohol.current).toBe(2);
    expect(s.evalByDate['2026-09-22'].points).toBe(0);
    const strict = data(d.days, { weeklyLimits: { alcohol: 0 } });
    expect(item(strict, '2026-09-22', 'alcohol')).toMatchObject({ missed: true });
  });
});

describe('urges and money saved', () => {
  it('each urge beaten is worth XP, capped per day', () => {
    const a = summarize(data({ [START]: { urges: { vape: 2 } } }), START).evals[0].points;
    const b = summarize(data({ [START]: { urges: { vape: 9 } } }), START).evals[0].points;
    expect(a).toBe(10);
    expect(b).toBe(15);
  });

  it('works out money saved from clean days', () => {
    const days: Record<string, DayLog> = {};
    for (let i = 0; i < 14; i++) days[addDays(START, i)] = { avoid: { vape: i === 9 ? 'slip' : 'clean' }, urges: { vape: i < 7 ? 2 : 1 } };
    const s = summarize(data(days, { costPerWeek: { vape: 21 } }), addDays(START, 13));
    const vape = slipStats(s).find((x) => x.habit.id === 'vape')!;
    expect(vape.saved).toBe(39); // 13 clean days × £3
    expect(vape.savedSinceSlip).toBe(12);
    expect(vape.urges7).toBe(7);
    expect(vape.urgesPrev7).toBe(14);
    expect(totalSaved(s)).toBe(39);
    expect(achievements(s).find((x) => x.id === 'urge-10')?.unlocked).toBe(true);
  });
});

describe('smart notifications', () => {
  const d = data();
  const s = summarize(d, '2026-09-22');
  const at = (hh: number, mm = 0, sent: Record<string, string> = {}, sum = s, date = '2026-09-22') =>
    dueNudges({ summary: sum, date, minutes: hh * 60 + mm, sent }).map((n) => n.id);

  it('only fires when something is actually left to do, and only once', () => {
    expect(at(8, 20)).not.toContain('morning');
    expect(at(8, 45)).toContain('morning');
    expect(at(8, 45, { morning: '2026-09-22' })).not.toContain('morning');
    expect(at(13, 50)).toContain('caffeine');
    expect(at(22, 40)).toContain('lockin');
    expect(at(20, 5)).toContain('deadline'); // yesterday (the 21st) isn't locked in
    expect(at(23, 35)).toContain('lastcall');
  });

  it('stays quiet when you are on top of it, or have switched it off', () => {
    const done = data({
      '2026-09-21': { closedAt: startOfDay('2026-09-21') + 20 * 3600e3 },
      '2026-09-22': { closedAt: startOfDay('2026-09-22') + 20 * 3600e3, avoid: { caffeine: 'clean' } },
    });
    const sum = summarize(done, '2026-09-22');
    expect(at(13, 50, {}, sum)).not.toContain('caffeine');
    expect(at(22, 40, {}, sum)).not.toContain('lockin');
    expect(at(20, 5, {}, sum)).not.toContain('deadline');
    const off = summarize(data({}, { notify: { lockin: false } }), '2026-09-22');
    expect(at(22, 40, {}, off)).not.toContain('lockin');
  });
});
