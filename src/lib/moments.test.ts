import { beforeEach, describe, expect, it } from 'vitest';
import { BUILT_IN_BY_ID, CHECKINS, QUESTS, defaultSettings, scheduleLabel } from './config';
import { startOfDay } from './dates';
import { summarize } from './engine';
import { markNotDone } from './actions';
import { badgeCount, checkinStates, chestReady, chestTier, currentCheckin, dueNow, hatTrickStreak, logicalNow, pace, questFor, rollChest, sectionLater, sectionStatus } from './moments';
import { dueNudges } from './nudges';
import { updateDay, useApp } from './store';
import type { AppData, DayLog, Settings } from './types';

const START = '2026-09-21'; // Monday
const at = (date: string, hh: number, mm = 0) => new Date(startOfDay(date) + (hh * 60 + mm) * 60_000);
function data(days: Record<string, DayLog> = {}, extra: Partial<Settings> = {}): AppData {
  return { days, events: {}, birthdays: {}, payments: {}, todos: {}, settings: { ...defaultSettings(START), ...extra } };
}

describe('toothbrush and haircut', () => {
  it('brushing teeth is on the morning and night lists from the day it was added', () => {
    const s = summarize(data(), '2026-09-25');
    const items = (d: string) => s.evalByDate[d].items.filter((i) => i.visible).map((i) => i.habit.id);
    expect(items('2026-09-25')).toEqual(expect.arrayContaining(['teethAm', 'teethPm']));
    expect(items('2026-09-23')).not.toContain('teethAm'); // earlier days don't count it
    expect(BUILT_IN_BY_ID.teethAm.section).toBe('morning');
    expect(BUILT_IN_BY_ID.teethPm.section).toBe('night');
  });

  it('a haircut is due every 2 weeks and carries over until done', () => {
    expect(scheduleLabel(BUILT_IN_BY_ID.haircut.schedule)).toBe('every 2 weeks');
    const d = data({ '2026-09-26': { done: { haircut: true } } });
    const s = summarize(d, '2026-10-12');
    const hc = (date: string) => s.evalByDate[date].items.find((i) => i.habit.id === 'haircut')!;
    expect(hc('2026-09-24')).toMatchObject({ visible: true, overdueDays: 0 });
    expect(hc('2026-09-25')).toMatchObject({ visible: true, overdueDays: 1 });
    expect(hc('2026-10-05').visible).toBe(false); // done on the 26th → next one due 10 Oct
    expect(hc('2026-10-10')).toMatchObject({ visible: true, overdueDays: 0 });
    expect(hc('2026-10-12')).toMatchObject({ visible: true, overdueDays: 2 });
  });
});

describe('moments of the day', () => {
  it('after midnight still counts as the night before', () => {
    expect(logicalNow(at('2026-09-25', 0, 30))).toEqual({ date: '2026-09-24', hour: 24.5 });
    expect(logicalNow(at('2026-09-25', 9))).toEqual({ date: '2026-09-25', hour: 9 });
  });

  it('three check-ins a day, only the current one can be done', () => {
    expect(currentCheckin(at('2026-09-25', 9)).id).toBe('am');
    expect(currentCheckin(at('2026-09-25', 13)).id).toBe('pm');
    expect(currentCheckin(at('2026-09-26', 1))).toMatchObject({ id: 'eve', date: '2026-09-25' });
    expect(CHECKINS.map((c) => c.id)).toEqual(['am', 'pm', 'eve']);

    const log: DayLog = { checkins: { am: { at: 0, energy: 4 } } };
    expect(checkinStates('2026-09-25', log, at('2026-09-25', 13))).toEqual({ am: 'done', pm: 'open', eve: 'later' });
    expect(checkinStates('2026-09-25', {}, at('2026-09-25', 19))).toEqual({ am: 'missed', pm: 'missed', eve: 'open' });
    expect(checkinStates('2026-09-24', log, at('2026-09-25', 13))).toEqual({ am: 'done', pm: 'missed', eve: 'missed' });
  });

  it('check-ins, the quest and the chest all add XP', () => {
    const base = summarize(data(), '2026-09-25').evalByDate['2026-09-25'].points;
    const log: DayLog = {
      checkins: { am: { at: 1, energy: 3 }, pm: { at: 2, energy: 4 }, eve: { at: 3, energy: 5 } },
      quest: { done: true },
      chest: 40,
    };
    const e = summarize(data({ '2026-09-25': log }), '2026-09-25').evalByDate['2026-09-25'];
    expect(e.checkins).toBe(3);
    expect(e.points - base).toBe(3 * 5 + 15 + 15 + 40);
  });

  it('only sections whose time has come are "due now" (and on the app badge)', () => {
    expect(sectionLater('night', 9)).toBe(true);
    expect(sectionLater('night', 21)).toBe(false);
    const e = summarize(data(), '2026-09-25').evalByDate['2026-09-25'];
    const morning = dueNow(e, 9).map((i) => i.habit.section);
    expect(new Set(morning)).toEqual(new Set(['morning']));
    expect(dueNow(e, 21).some((i) => i.habit.section === 'night')).toBe(true);
    const todos = { a: { id: 'a', title: 'Call bank', date: '2026-09-24', createdAt: 0 } };
    expect(badgeCount(e, 9, todos, '2026-09-25')).toBe(dueNow(e, 9).length + 1);
    const locked = summarize(data({ '2026-09-25': { closedAt: 1 } }), '2026-09-25').evalByDate['2026-09-25'];
    expect(badgeCount(locked, 21, {}, '2026-09-25')).toBe(0);
  });

  it('races what you had done by this time yesterday', () => {
    const y = '2026-09-24';
    const t = '2026-09-25';
    const d = data({
      [y]: { done: { weigh: true, pills: true, faceAm: true, macro: true }, doneAt: { weigh: at(y, 8).getTime(), pills: at(y, 8, 5).getTime(), faceAm: at(y, 9).getTime(), macro: at(y, 20).getTime() } },
      [t]: { done: { weigh: true, pills: true } },
    });
    const s = summarize(d, t);
    expect(pace(s.evalByDate[t], s.evalByDate[y], at(t, 10).getTime())).toEqual({ you: 2, them: 3, final: 4 });
    expect(pace(s.evalByDate[t], s.evalByDate[y], at(t, 21).getTime())).toMatchObject({ them: 4 });
    // No tick times yesterday → nothing to race
    const s2 = summarize(data({ [y]: { done: { weigh: true } } }), t);
    expect(pace(s2.evalByDate[t], s2.evalByDate[y], at(t, 10).getTime())).toBeNull();
  });

  it('counts hat-trick days in a row (today once it is done)', () => {
    const three: DayLog = { checkins: { am: { at: 1, energy: 3 }, pm: { at: 2, energy: 3 }, eve: { at: 3, energy: 3 } } };
    const s = summarize(data({ '2026-09-22': three, '2026-09-23': three, '2026-09-24': three, '2026-09-25': { checkins: { am: { at: 1, energy: 3 } } } }), '2026-09-25');
    expect(hatTrickStreak(s.evals)).toBe(3);
    const s2 = summarize(data({ '2026-09-23': three, '2026-09-24': {}, '2026-09-25': three }), '2026-09-25');
    expect(hatTrickStreak(s2.evals)).toBe(1);
  });

  it('the quest is the same all day and swapping changes it', () => {
    expect(questFor('2026-09-25')).toBe(questFor('2026-09-25'));
    expect(questFor('2026-09-25', 1)).not.toBe(questFor('2026-09-25'));
    expect(QUESTS).toContain(questFor('2027-01-01'));
  });

  it('the chest pays out by the odds, and a perfect day gets better ones', () => {
    expect(rollChest(false, 0).tier).toBe('common');
    expect(rollChest(false, 0.6).tier).toBe('rare');
    expect(rollChest(false, 0.9).tier).toBe('epic');
    expect(rollChest(false, 0.99).tier).toBe('legendary');
    expect(rollChest(true, 0.3).tier).toBe('rare');
    expect(rollChest(true, 0.92).tier).toBe('legendary');
    expect(chestTier(40).label).toBe('Epic');

    const t = '2026-09-25';
    const ready = (log: DayLog, today = t) => chestReady(summarize(data({ [t]: log }), today).evalByDate[t], today);
    expect(ready({ closedAt: at(t, 22).getTime() })).toBe(true);
    expect(ready({ closedAt: at(t, 22).getTime(), chest: 20 })).toBe(false);
    expect(ready({})).toBe(false);
  });
});

describe('ticking remembers when', () => {
  beforeEach(() => useApp.setState({ days: {}, settings: defaultSettings(START) }));

  it('stamps new ticks and forgets unticked ones', () => {
    updateDay('2026-09-25', (l) => void (l.done = { pills: true }));
    const first = useApp.getState().days['2026-09-25'].doneAt!;
    expect(first.pills).toBeTypeOf('number');
    updateDay('2026-09-25', (l) => void (l.water = 2));
    expect(useApp.getState().days['2026-09-25'].doneAt).toMatchObject({ pills: first.pills, water: expect.any(Number) });
    updateDay('2026-09-25', (l) => void (l.done = { pills: false }));
    expect(useApp.getState().days['2026-09-25'].doneAt?.pills).toBeUndefined();
  });
});

describe('sections close once everything is answered, done or not', () => {
  const t = '2026-09-25';
  const morning = { done: { weigh: true, wake: true, pills: true, teethAm: true, faceAm: true } };

  it('a missed bedtime closes Morning instead of leaving it open all day', () => {
    const s = summarize(data({ [t]: { ...morning, done: { ...morning.done, sleep: false } } }), t);
    expect(sectionStatus(s.evalByDate[t], 'morning')).toMatchObject({ total: 6, done: 5, missed: 1, open: [], complete: false, closed: true });
    const s2 = summarize(data({ [t]: morning }), t);
    expect(sectionStatus(s2.evalByDate[t], 'morning')).toMatchObject({ missed: 0, closed: false });
    expect(sectionStatus(s2.evalByDate[t], 'morning').open.map((i) => i.habit.id)).toEqual(['sleep']);
  });

  it('"didn\'t do it" counts as a miss now (streak breaks, no XP), and doing it later still counts', () => {
    const missed = summarize(data({ [t]: { missed: { protein: true } } }), t);
    const item = missed.evalByDate[t].items.find((i) => i.habit.id === 'protein')!;
    expect(item).toMatchObject({ done: false, missed: true });
    expect(missed.habitStreaks.protein.current).toBe(0);
    const later = summarize(data({ [t]: { missed: { protein: true }, done: { protein: true } } }), t);
    expect(later.evalByDate[t].items.find((i) => i.habit.id === 'protein')).toMatchObject({ done: true, missed: false });
  });

  it('a chore marked not done carries over to tomorrow', () => {
    const s = summarize(data({ '2026-09-24': { missed: { haircut: true } } }), t);
    expect(s.evalByDate['2026-09-24'].items.find((i) => i.habit.id === 'haircut')).toMatchObject({ missed: true, done: false });
    expect(s.evalByDate[t].items.find((i) => i.habit.id === 'haircut')).toMatchObject({ visible: true, overdueDays: 1, missed: false });
  });

  it('"close it" marks the rest not done (sleep gets its own "no")', () => {
    useApp.setState({ days: {}, settings: defaultSettings(START) });
    markNotDone(t, [BUILT_IN_BY_ID.weigh, BUILT_IN_BY_ID.sleep, BUILT_IN_BY_ID.water]);
    const day = useApp.getState().days[t];
    expect(day.missed).toEqual({ weigh: true, water: true });
    expect(day.done?.sleep).toBe(false);
    const e = summarize(data(useApp.getState().days), t).evalByDate[t];
    expect(['weigh', 'sleep', 'water'].map((id) => e.items.find((i) => i.habit.id === id)!.missed)).toEqual([true, true, true]);
  });
});

describe('check-in notifications', () => {
  it('afternoon and evening check-ins nudge once if you have not checked in', () => {
    const s = summarize(data(), '2026-09-25');
    const ids = (hh: number, log: DayLog = {}, sent: Record<string, string> = {}) =>
      dueNudges({ summary: summarize(data({ '2026-09-25': log }), '2026-09-25'), date: '2026-09-25', minutes: hh * 60 + 5, sent }).map((n) => n.id);
    expect(s).toBeTruthy();
    expect(ids(15)).toContain('afternoon');
    expect(ids(15, { checkins: { pm: { at: 1, energy: 4 } } })).not.toContain('afternoon');
    expect(ids(15, {}, { afternoon: '2026-09-25' })).not.toContain('afternoon');
    expect(ids(19)).toContain('evening');
  });
});
