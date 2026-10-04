import { describe, expect, it } from 'vitest';
import { defaultSettings } from './config';
import { summarize } from './engine';
import type { AppData, DayLog, Todo } from './types';
import { openNowAndLater, wrapQueue } from './wrap';

const START = '2026-09-21'; // Monday
const T = '2026-09-29';
function data(days: Record<string, DayLog> = {}): AppData {
  return { days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: defaultSettings(START) };
}

describe('wrap up', () => {
  it("goes through what's left in the order of the day, then to-dos, how it went and locking in", () => {
    const s = summarize(data({ [T]: { done: { weigh: true, pills: true }, missed: { protein: true }, avoid: { vape: 'clean' } } }), T);
    const todos: Record<string, Todo> = {
      a: { id: 'a', title: 'Dentist', date: '2026-09-27', doneOn: null, createdAt: 1 },
      b: { id: 'b', title: 'Someday', date: null, doneOn: null, createdAt: 2 },
    };
    const q = wrapQueue(s.evalByDate[T], todos, T);
    const ids = q.map((x) => ('id' in x ? x.id : x.kind));
    expect(ids[0]).toBe('sleep'); // morning first
    expect(ids).not.toContain('weigh'); // done
    expect(ids).not.toContain('protein'); // already answered "not done"
    expect(ids).not.toContain('vape'); // answered
    expect(ids).not.toContain('homeWorkout'); // a bonus, never required
    expect(ids.slice(-4)).toEqual(['caffeine', 'a', 'reflect', 'lock']);
    expect(ids).not.toContain('b'); // someday to-dos don't nag
  });

  it('skips locking in when the day is already locked, and to-dos on other days', () => {
    const s = summarize(data({ '2026-09-28': { closedAt: 1 } }), T);
    const q = wrapQueue(s.evalByDate['2026-09-28'], { a: { id: 'a', title: 'x', date: T, doneOn: null, createdAt: 1 } }, T);
    expect(q.at(-1)).toEqual({ kind: 'reflect' });
    expect(q.some((x) => x.kind === 'todo')).toBe(false);
  });

  it('quick log splits what is due now from later today', () => {
    const thu = '2026-10-01'; // the home workout (a bonus) exists from 30 Sep
    const s = summarize(data(), thu);
    const { now, later, bonus } = openNowAndLater(s.evalByDate[thu], 9, true, s.settings);
    expect(now.every((i) => i.habit.section === 'morning')).toBe(true);
    expect(later.some((i) => i.habit.section === 'night')).toBe(true);
    expect(bonus.map((i) => i.habit.id)).toEqual(['homeWorkout']);
  });
});
