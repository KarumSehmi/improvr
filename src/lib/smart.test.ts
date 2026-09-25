import { describe, expect, it } from 'vitest';
import { achievements } from './achievements';
import { defaultSettings, habitsFor } from './config';
import { addDays, startOfDay } from './dates';
import { summarize } from './engine';
import { insights } from './insights';
import { buildReminders } from './reminders';
import { suggestions } from './smart';
import type { AppData, DayLog } from './types';

const START = '2026-08-03'; // Monday

function data(days: Record<string, DayLog> = {}, extra: Partial<AppData['settings']> = {}): AppData {
  return { days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: { ...defaultSettings(START), ...extra } };
}

describe('your own habits', () => {
  it('hides, reschedules and adds habits', () => {
    const s = { ...defaultSettings(START), hiddenHabits: ['porn'], scheduleOverrides: { hoover: { weekday: 0 } }, customHabits: [
      { id: 'c_read', label: 'Read 10 pages', emoji: '📖', section: 'night' as const, kind: 'check' as const, points: 10, since: '2026-08-05' },
    ] };
    const habits = habitsFor(s);
    expect(habits.find((h) => h.id === 'porn')).toBeUndefined();
    expect(habits.find((h) => h.id === 'hoover')?.schedule).toEqual({ weekday: 0 });
    const idx = habits.findIndex((h) => h.id === 'c_read');
    expect(habits[idx - 1].section).toBe('night'); // sits with its section
    const sum = summarize({ ...data(), settings: s }, '2026-08-06');
    expect(sum.evalByDate['2026-08-04'].items[idx].visible).toBe(false); // before it existed
    expect(sum.evalByDate['2026-08-05'].items[idx].required).toBe(true);
  });
});

describe('insights', () => {
  it('spots that late nights wreck the next day', () => {
    const days: Record<string, DayLog> = {};
    for (let i = 0; i < 14; i++) {
      const early = i % 2 === 0;
      days[addDays(START, i)] = early
        ? { done: { sleep: true, pills: true, faceAm: true, macro: true, protein: true, facePm: true }, avoid: { vape: 'clean' } }
        : { done: { sleep: false }, avoid: { vape: 'slip' } };
    }
    const found = insights(summarize(data(days), addDays(START, 14)));
    expect(found.some((i) => i.id === 'sleep-effect')).toBe(true);
    expect(found.some((i) => i.id === 'late-vape')).toBe(true);
  });
});

describe('achievements', () => {
  it('unlocks with progress', () => {
    const days: Record<string, DayLog> = {};
    for (let i = 0; i < 8; i++) days[addDays(START, i)] = { avoid: { vape: 'clean' }, closedAt: startOfDay(addDays(START, i)) + 20 * 3600e3 };
    const list = achievements(summarize(data(days), addDays(START, 8)));
    expect(list.find((a) => a.id === 'vape-7')?.unlocked).toBe(true);
    expect(list.find((a) => a.id === 'vape-30')).toMatchObject({ unlocked: false, progress: 8 });
    expect(list.find((a) => a.id === 'log-7')?.unlocked).toBe(true);
  });

  it('skips badges for habits you switched off', () => {
    const list = achievements(summarize(data({}, { hiddenHabits: ['porn'] }), START));
    expect(list.find((a) => a.id === 'porn-7')).toBeUndefined();
  });
});

describe('up next', () => {
  const d = data();
  const today = START;
  const sum = summarize(d, today);
  const e = sum.evalByDate[today];
  const at = (h: number, m = 0) => new Date(2026, 7, 3, h, m);

  it('mornings offer one tap for the routine', () => {
    const s = suggestions(at(8), today, e, sum, d);
    const morning = s.find((x) => x.id === 'morning');
    expect(morning?.action).toMatchObject({ kind: 'tick', habitIds: ['weigh', 'pills', 'faceAm'] });
  });

  it('counts down to the caffeine cutoff', () => {
    expect(suggestions(at(13, 20), today, e, sum, d).find((x) => x.id === 'caffeine')?.title).toBe('Caffeine cutoff in 40m');
  });

  it('nags about bed and locking in late at night', () => {
    const ids = suggestions(at(23, 30), today, e, sum, d).map((x) => x.id);
    expect(ids).toContain('bed');
    expect(ids).toContain('lock');
  });
});

describe('reminders', () => {
  it('builds a calendar file with repeating alerts', () => {
    const d = data();
    const today = '2026-08-06'; // Thursday
    const ics = buildReminders(d.settings, summarize(d, today), { b: { id: 'b', name: 'Sam', month: 9, day: 27 } }, today);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU');
    expect(ics).toContain("Sam's birthday");
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).not.toMatch(/TRIGGER:-PT\r\n/);
    expect(ics).toContain('TRIGGER:-PT0M');
    // Weekly jobs start on their own weekday, never in the past — even when overdue
    const start = (title: string) => ics.split('BEGIN:VEVENT').find((b) => b.includes(title))?.match(/DTSTART:(\d{8})/)?.[1];
    expect(start('Hoover & mop floor')).toBe('20260808'); // Saturday
    expect(start('Fill out Bud + check Canvas')).toBe('20260811'); // overdue since Tue 4th → next Tuesday
    expect(start('Weekly review')).toBe('20260809'); // Sunday
  });
});
