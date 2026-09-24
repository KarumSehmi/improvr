import { describe, expect, it } from 'vitest';
import { BUILT_IN_BY_ID as HABIT_BY_ID, defaultSettings } from './config';
import { addDays, logDeadline, startOfDay } from './dates';
import { dayOffUsedInWeek, levelFor, runStreak, summarize, trackChore } from './engine';
import type { AppData, DayLog } from './types';

const START = '2026-09-21'; // a Monday

function data(days: Record<string, DayLog> = {}, extra: Partial<AppData['settings']> = {}): AppData {
  return {
    days,
    events: {},
    birthdays: {},
    payments: {},
    settings: { ...defaultSettings(START), ...extra },
  };
}

const at = (date: string, hour = 12) => startOfDay(date) + hour * 3_600_000;

describe('chores carry over', () => {
  it('rolling chores are due every N days after they were last done', () => {
    const bin = HABIT_BY_ID.bin;
    const t = trackChore(bin, data({ '2026-09-21': { done: { bin: true } }, '2026-09-26': { done: { bin: true } } }), '2026-09-30');
    expect(t.byDate['2026-09-21']).toMatchObject({ due: true, done: true });
    expect(t.byDate['2026-09-23'].due).toBe(false);
    expect(t.byDate['2026-09-24']).toMatchObject({ due: true, overdueDays: 0 });
    expect(t.byDate['2026-09-25']).toMatchObject({ due: true, overdueDays: 1 });
    expect(t.byDate['2026-09-26']).toMatchObject({ due: true, overdueDays: 2, done: true });
    expect(t.nextDue).toBe('2026-09-29');
  });

  it('staggers rolling chores with an offset', () => {
    const t = trackChore(HABIT_BY_ID.paulas, data(), '2026-09-23');
    expect(t.byDate['2026-09-21'].due).toBe(false);
    expect(t.byDate['2026-09-22'].due).toBe(true);
  });

  it('skipping a skippable chore restarts its cycle', () => {
    const t = trackChore(HABIT_BY_ID.paulas, data({ '2026-09-22': { skipped: { paulas: true } } }), '2026-09-26');
    expect(t.byDate['2026-09-22']).toMatchObject({ skipped: true });
    expect(t.byDate['2026-09-24'].due).toBe(false);
    expect(t.byDate['2026-09-25'].due).toBe(true);
  });

  it('weekly chores land on their weekday and carry over until done', () => {
    const hoover = HABIT_BY_ID.hoover; // Saturday
    const t = trackChore(hoover, data({ '2026-09-28': { done: { hoover: true } } }), '2026-10-04');
    expect(t.byDate['2026-09-25'].due).toBe(false);
    expect(t.byDate['2026-09-26']).toMatchObject({ due: true, overdueDays: 0 });
    expect(t.byDate['2026-09-27']).toMatchObject({ due: true, overdueDays: 1 });
    expect(t.byDate['2026-09-28']).toMatchObject({ due: true, done: true, overdueDays: 2 });
    expect(t.byDate['2026-09-29'].due).toBe(false);
    expect(t.byDate['2026-10-03'].due).toBe(true);
  });

  it('doing a weekly chore early covers the upcoming one', () => {
    const t = trackChore(HABIT_BY_ID.hoover, data({ '2026-09-25': { done: { hoover: true } } }), '2026-10-04');
    expect(t.byDate['2026-09-26'].due).toBe(false);
    expect(t.byDate['2026-10-03'].due).toBe(true);
  });

  it('every-other-Sunday chores respect the anchor', () => {
    const refill = HABIT_BY_ID.pillRefill;
    const t1 = trackChore(refill, data(), '2026-10-11');
    expect(t1.byDate['2026-09-27'].due).toBe(true);
    const t2 = trackChore(refill, data({}, { anchors: { pillRefill: '2026-10-04' } }), '2026-10-11');
    expect(t2.byDate['2026-09-27'].due).toBe(false);
    expect(t2.byDate['2026-10-04'].due).toBe(true);
    const t3 = trackChore(refill, data({ '2026-09-27': { done: { pillRefill: true } } }), '2026-10-11');
    expect(t3.byDate['2026-10-04'].due).toBe(false);
    expect(t3.nextDue).toBe('2026-10-11');
  });
});

describe('fines', () => {
  it('fines a day only once its 24h grace period has passed', () => {
    const d = data({});
    expect(summarize(d, '2026-09-22').fineDays).toEqual([]);
    expect(summarize(d, '2026-09-23').fineDays).toEqual(['2026-09-21']);
  });

  it('logging late still costs the fine; logging on time does not', () => {
    const d = data({
      '2026-09-21': { closedAt: logDeadline('2026-09-21') - 1 },
      '2026-09-22': { closedAt: logDeadline('2026-09-22') + 1 },
    });
    const s = summarize(d, '2026-09-26');
    expect(s.fineDays).toEqual(['2026-09-22', '2026-09-23', '2026-09-24']);
    expect(s.fineTotal).toBe(15);
  });

  it('payments reduce what is owed', () => {
    const d = data({});
    d.payments = { a: { id: 'a', amount: 5, paidAt: 0 } };
    const s = summarize(d, '2026-09-24');
    expect(s.fineTotal).toBe(10);
    expect(s.owed).toBe(5);
    expect(s.openUnlogged).toEqual(['2026-09-23', '2026-09-24']);
  });
});

describe('streaks', () => {
  it('counts current and best runs, skipping neutral days', () => {
    expect(runStreak(['success', 'success', 'success', 'fail', 'success', 'neutral', 'success'])).toEqual({ current: 2, best: 3 });
    expect(runStreak(['success', 'fail'])).toEqual({ current: 0, best: 1 });
  });

  it('a day off freezes streaks and today never breaks one', () => {
    const clean = { avoid: { vape: 'clean' as const } };
    const d = data({
      '2026-09-21': { ...clean, done: { pills: true }, closedAt: at('2026-09-21', 22) },
      '2026-09-22': { dayOff: true, closedAt: at('2026-09-22', 22) },
      '2026-09-23': { ...clean, done: { pills: true }, closedAt: at('2026-09-23', 22) },
    });
    const s = summarize(d, '2026-09-24');
    expect(s.habitStreaks.pills.current).toBe(2);
    expect(s.habitStreaks.vape.current).toBe(2);
    expect(s.logStreak.current).toBe(3);
  });

  it('a slip breaks the streak even on a day off', () => {
    const d = data({
      '2026-09-21': { avoid: { vape: 'clean' } },
      '2026-09-22': { avoid: { vape: 'slip' }, dayOff: true },
      '2026-09-23': { avoid: { vape: 'clean' } },
    });
    const s = summarize(d, '2026-09-23');
    expect(s.habitStreaks.vape).toEqual({ current: 1, best: 1 });
  });

  it('unticking something today does not break its streak', () => {
    const d = data({
      '2026-09-21': { done: { pills: true } },
      '2026-09-22': { done: { pills: true } },
      '2026-09-23': { done: { pills: false } }, // ticked then unticked
    });
    const s = summarize(d, '2026-09-23');
    expect(s.evalByDate['2026-09-23'].items.find((i) => i.habit.id === 'pills')?.missed).toBe(false);
    expect(s.habitStreaks.pills.current).toBe(2);
  });

  it('weigh-in is a tick, and days logged with an old weight number still count', () => {
    const d = data({
      '2026-09-21': { weight: 80.2 },
      '2026-09-22': { done: { weigh: true } },
      '2026-09-23': { weight: 80.1, done: { weigh: false } }, // unticked on purpose
    });
    const s = summarize(d, '2026-09-24');
    const weighed = (date: string) => s.evalByDate[date].items.find((i) => i.habit.id === 'weigh')?.done;
    expect(HABIT_BY_ID.weigh.kind).toBe('check');
    expect([weighed('2026-09-21'), weighed('2026-09-22'), weighed('2026-09-23')]).toEqual([true, true, false]);
  });

  it('only one day off per week', () => {
    const d = data({ '2026-09-22': { dayOff: true } });
    expect(dayOffUsedInWeek(d.days, '2026-09-24')).toBe('2026-09-22');
    expect(dayOffUsedInWeek(d.days, '2026-09-22')).toBeNull();
    expect(dayOffUsedInWeek(d.days, '2026-09-28')).toBeNull();
  });
});

describe('training weeks', () => {
  it('needs the weekly target, counts football, and never judges the current week early', () => {
    const days: Record<string, DayLog> = {
      '2026-09-21': { workouts: ['football'] },
      '2026-09-23': { workouts: ['gym'] },
      '2026-09-25': { workouts: ['home'] },
      '2026-09-29': { workouts: ['gym'] },
    };
    const s = summarize(data(days), '2026-09-30');
    expect(s.weeks.map((w) => [w.start, w.sessions, w.outcome])).toEqual([
      ['2026-09-21', 3, 'success'],
      ['2026-09-28', 1, 'neutral'],
    ]);
    expect(s.trainingStreak.current).toBe(1);
  });
});

describe('scoring', () => {
  it('day off has no score but still counts as logged', () => {
    const s = summarize(data({ '2026-09-21': { dayOff: true, closedAt: at('2026-09-21') } }), '2026-09-21');
    expect(s.evals[0].pct).toBeNull();
    expect(s.evals[0].onTime).toBe(true);
  });

  it('gym is worth more than a home workout', () => {
    const s = summarize(data({ [START]: { workouts: ['gym'] }, [addDays(START, 1)]: { workouts: ['home'] } }), addDays(START, 1));
    expect(s.evals[0].points).toBeGreaterThan(s.evals[1].points);
  });

  it('levels up as XP grows', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(300).level).toBe(2);
    expect(levelFor(999).level).toBe(2);
    expect(levelFor(1000).level).toBe(3);
  });
});
