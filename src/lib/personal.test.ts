import { describe, expect, it } from 'vitest';
import { defaultSettings } from './config';
import { summarize } from './engine';
import { drinkNights, savedBetween, weekExtras } from './personal';
import { recovery } from './recovery';
import { suggestions } from './smart';
import type { AppData, DayLog } from './types';

const settings = defaultSettings('2026-09-21'); // Monday
const data = (days: Record<string, DayLog>): AppData => ({ days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings });
const at = (date: string, h: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, h);
};
const ideas = (days: Record<string, DayLog>, date: string, h: number) => {
  const sum = summarize(data(days), date);
  return suggestions(at(date, h), date, sum.evalByDate[date], sum, data(days));
};

describe('nicotine recovery timeline', () => {
  it('says where you are and what comes next', () => {
    expect(recovery(0)).toMatchObject({ latest: null, next: { title: '1 day' }, inDays: 1 });
    expect(recovery(10)).toMatchObject({ latest: { title: '1 week' }, next: { title: '2 weeks' }, inDays: 4 });
    expect(recovery(400)).toMatchObject({ latest: { title: '1 year' }, next: null });
  });

  it('calls out a milestone on the day you reach it', () => {
    const clean: DayLog = { avoid: { vape: 'clean' } };
    const found = ideas({ '2026-09-24': clean, '2026-09-25': clean, '2026-09-26': clean }, '2026-09-27', 11).find((s) => s.id === 'milestone');
    expect(found?.title).toBe('3 days nicotine-free');
  });

  it('works out the money kept, only for clean days', () => {
    const days: Record<string, DayLog> = { '2026-09-01': { avoid: { vape: 'clean' } }, '2026-09-02': { avoid: { vape: 'slip' } }, '2026-09-03': { avoid: { vape: 'clean' } }, '2026-09-04': { avoid: { vape: 'clean' } } };
    expect(savedBetween(days, 'vape', '2026-09-01', '2026-09-30', 35)).toBe(15);
    expect(savedBetween(days, 'vape', '2026-09-01', '2026-09-30', 0)).toBe(0);
  });
});

describe('drinking nights', () => {
  const clean: DayLog = { avoid: { alcohol: 'clean' } };
  const week = { '2026-09-21': clean, '2026-09-22': clean, '2026-09-24': clean };

  it("on a Friday evening, says if tonight's allowed", () => {
    const left = ideas({ ...week, '2026-09-23': clean }, '2026-09-25', 19).find((s) => s.id === 'drinks');
    expect(left?.title).toBe('1 drinking night left this week');
    expect(left?.detail).toContain('bed by 2am');

    const used = ideas({ ...week, '2026-09-23': { avoid: { alcohol: 'slip' } } }, '2026-09-25', 19).find((s) => s.id === 'drinks');
    expect(used).toMatchObject({ title: 'Drinking night used (Wed)', tone: 'warn' });
  });

  it("stays quiet once tonight's answered, and on nights you don't go out", () => {
    expect(ideas({ ...week, '2026-09-25': clean }, '2026-09-25', 19).some((s) => s.id === 'drinks')).toBe(false);
    expect(ideas(week, '2026-09-22', 19).some((s) => s.id === 'drinks')).toBe(false);
  });

  it('learns the other nights you usually drink', () => {
    const days: Record<string, DayLog> = { '2026-09-22': { avoid: { alcohol: 'slip' } }, '2026-09-29': { avoid: { alcohol: 'slip' } } };
    expect([...drinkNights(summarize(data(days), '2026-10-04'))].sort()).toEqual([2, 5, 6]);
  });

  it('the morning after: water first', () => {
    const s = ideas({ '2026-09-25': { avoid: { alcohol: 'slip' } } }, '2026-09-26', 10).find((x) => x.id === 'after');
    expect(s?.action).toMatchObject({ kind: 'water' });
  });
});

describe('Monday football', () => {
  it('offers one tap to log it', () => {
    const s = ideas({}, '2026-09-28', 16).find((x) => x.id === 'train');
    expect(s).toMatchObject({ emoji: '⚽', action: { kind: 'workout', workout: 'football' } });
    expect(ideas({ '2026-09-28': { workouts: ['football'] } }, '2026-09-28', 16).some((x) => x.id === 'train')).toBe(false);
  });
});

describe('your week in review', () => {
  it('adds up nicotine, drinking nights and sleep', () => {
    const days: Record<string, DayLog> = {
      '2026-09-21': { avoid: { vape: 'clean', alcohol: 'clean' }, urges: { vape: 2 }, sleepAuto: { asleep: '00:30', awake: '08:30', at: 0 } },
      '2026-09-22': { avoid: { vape: 'clean' }, urges: { vape: 1 }, sleepAuto: { asleep: '23:30', awake: '08:00', at: 0 } },
      '2026-09-26': { avoid: { vape: 'slip', alcohol: 'slip' } },
    };
    const x = weekExtras(summarize(data(days), '2026-09-28'), '2026-09-21');
    expect(x.nicotine).toEqual({ clean: 2, slips: 1, urges: 3 });
    expect(x.drinks).toEqual({ nights: ['2026-09-26'], limit: 1 });
    expect(x.sleep).toEqual({ asleep: '00:00', awake: '08:15', mins: 495, nights: 2 });
  });
});
