import { describe, expect, it } from 'vitest';
import { judgeSleep } from '../../api/health';
import { BUILT_IN_BY_ID, defaultSettings, habitLabel, sleepTargets } from './config';
import { summarize } from './engine';
import { dueNudges } from './nudges';
import type { DayLog } from './types';

const settings = defaultSettings('2026-09-21');
const THU = '2026-09-24';
const FRI = '2026-09-25';
const SAT = '2026-09-26';
const SUN = '2026-09-27';
const MON = '2026-09-28';
const TUE = '2026-09-29';
const WED = '2026-09-30';

describe('weekends are more relaxed', () => {
  it('Friday & Saturday nights and Saturday & Sunday mornings get later targets', () => {
    expect(sleepTargets(settings, SAT)).toEqual({ sleep: '02:00', wake: '10:30', weekend: true });
    expect(sleepTargets(settings, SUN).weekend).toBe(true);
    expect(sleepTargets(settings, MON)).toEqual({ sleep: '01:00', wake: '09:00', weekend: false }); // Sunday night → uni on Monday
    expect(sleepTargets({ ...settings, weekend: { wake: '11:00' } }, SUN)).toMatchObject({ sleep: '02:00', wake: '11:00' });
  });

  it('the habits say what counts that day', () => {
    expect(habitLabel(BUILT_IN_BY_ID.sleep, settings, SAT)).toBe('Asleep before 2am');
    expect(habitLabel(BUILT_IN_BY_ID.wake, settings, SUN)).toBe('Up before 10:30am');
    expect(habitLabel(BUILT_IN_BY_ID.sleep, settings, MON)).toBe('Asleep before 1am');
    expect(habitLabel(BUILT_IN_BY_ID.pills, settings, SAT)).toBe('Took all my pills');
  });

  it('the Apple Watch judges against the day\'s targets', () => {
    expect(judgeSleep('01:30', '10:00', sleepTargets(settings, SAT))).toEqual({ sleepOk: true, wakeOk: true });
    expect(judgeSleep('01:30', '10:00', sleepTargets(settings, MON))).toEqual({ sleepOk: false, wakeOk: false });
    expect(judgeSleep('02:10', '10:45', sleepTargets(settings, SUN))).toEqual({ sleepOk: false, wakeOk: false });
  });

  it('the bedtime and morning reminders move later too', () => {
    const at = (date: string, hh: number, mm: number) =>
      dueNudges({ summary: summarize({ days: {}, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings }, date), date, minutes: hh * 60 + mm, sent: {} });
    expect(at(TUE, 0, 20).find((n) => n.id === 'bedtime')?.title).toBe('🌙 Bed by 1am');
    expect(at(SAT, 0, 20).some((n) => n.id === 'bedtime')).toBe(false);
    expect(at(SAT, 1, 20).find((n) => n.id === 'bedtime')?.title).toBe('🌙 Bed by 2am');
    expect(at(SAT, 8, 35).some((n) => n.id === 'morning')).toBe(false);
    expect(at(SAT, 10, 5).some((n) => n.id === 'morning')).toBe(true);
    expect(at(TUE, 8, 35).some((n) => n.id === 'morning')).toBe(true);
  });

  it('a bedtime before midnight works the same way', () => {
    const early = { ...settings, weekday: { sleep: '23:30', wake: '07:30' }, reminders: { bedtime: '23:00' } };
    const bed = (date: string, hh: number, mm: number, sent: Record<string, string> = {}) =>
      dueNudges({ summary: summarize({ days: {}, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: early }, date), date, minutes: hh * 60 + mm, sent }).find(
        (n) => n.id === 'bedtime',
      );
    expect(bed(TUE, 23, 5)).toMatchObject({ title: '🌙 Bed by 11:30pm', day: WED }); // marked sent against the night's own day
    expect(bed(FRI, 23, 5)).toBeUndefined(); // Friday night is a 2am night
    expect(bed(SAT, 1, 35)?.title).toBe('🌙 Bed by 2am');
    expect(bed(FRI, 1, 35)).toBeUndefined(); // that's still Thursday night, long past its 11pm reminder
    expect(bed(WED, 0, 10)?.title).toBe('🌙 Bed by 11:30pm'); // a late run still catches it…
    expect(bed(WED, 0, 10, { bedtime: WED })).toBeUndefined(); // …but never twice in one night
    expect(bed(THU, 23, 5, { bedtime: WED })).toBeDefined();
  });

  it('the Apple Watch handles a target before midnight', () => {
    const early = { ...settings, weekday: { sleep: '23:30', wake: '07:30' } };
    expect(judgeSleep('23:10', '07:00', sleepTargets(early, TUE)).sleepOk).toBe(true);
    expect(judgeSleep('23:40', '07:00', sleepTargets(early, TUE)).sleepOk).toBe(false);
    expect(judgeSleep('00:20', '07:00', sleepTargets(early, TUE)).sleepOk).toBe(false);
    expect(judgeSleep('21:50', '07:00', sleepTargets(early, TUE)).sleepOk).toBe(true);
  });
});

describe('not too many notifications', () => {
  const days: Record<string, DayLog> = { '2026-09-28': {} }; // yesterday not locked in
  const summary = summarize({ days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings }, TUE);
  const ids = (hh: number, mm: number, sent: Record<string, string>, max?: number) =>
    dueNudges({ summary: { ...summary, settings: { ...settings, notifyMax: max } }, date: TUE, minutes: hh * 60 + mm, sent }).map((n) => n.id);
  const four = { morning: TUE, caffeine: TUE, afternoon: TUE, todos: TUE };

  it('at most 4 reminders a day by default', () => {
    expect(ids(19, 5, {})).toContain('evening');
    expect(ids(19, 5, four)).not.toContain('evening');
    expect(ids(19, 5, four, 0)).toContain('evening'); // no limit
  });

  it('fine and lock-in warnings always come through', () => {
    expect(ids(20, 5, four)).toContain('deadline');
    expect(ids(22, 35, four)).toContain('lockin');
  });
});
