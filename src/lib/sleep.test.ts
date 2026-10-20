import { describe, expect, it } from 'vitest';
import { judgeSleep } from '../../api/health';
import { applyDone, applyTime } from './actions';
import { BUILT_IN_BY_ID, defaultSettings, timeOnTarget } from './config';
import { summarize } from './engine';
import { minutesToClock, nightOf, shortClock, timeChoices, typicalTime, usualTime } from './sleep';
import type { AppData, DayLog } from './types';

const START = '2026-09-21'; // Monday
const TUE = '2026-09-29';
const SAT = '2026-10-03';
const settings = defaultSettings(START);
const targets = { sleep: '01:00', wake: '09:00' };

describe('sleep and wake times', () => {
  it('judges a time against its target — strictly before, with the evening before midnight', () => {
    expect(timeOnTarget('sleep', '23:30', targets)).toBe(true);
    expect(timeOnTarget('sleep', '00:59', targets)).toBe(true);
    expect(timeOnTarget('sleep', '01:00', targets)).toBe(false);
    expect(timeOnTarget('sleep', '02:15', targets)).toBe(false);
    expect(timeOnTarget('wake', '08:59', targets)).toBe(true);
    expect(timeOnTarget('wake', '09:00', targets)).toBe(false);
    // The Apple Watch judges the same way
    expect(judgeSleep('00:59', '09:00', targets)).toEqual({ sleepOk: true, wakeOk: false });
  });

  it('offers half-hour chips around the target, stretched to take in your usual time', () => {
    expect(timeChoices('sleep', '01:00')).toEqual(['23:00', '23:30', '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00']);
    expect(timeChoices('wake', '09:00')).toEqual(['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(timeChoices('sleep', '01:00', '03:40').at(-1)).toBe('04:00');
    expect(timeChoices('wake', '09:00', '06:10')[0]).toBe('05:30');
    // Never silly hours: 8pm–8am to fall asleep, 4am–4pm to get up
    expect(timeChoices('wake', '15:00').at(-1)).toBe('16:00');
    expect(timeChoices('sleep', '21:00')[0]).toBe('20:00');
  });

  it('labels chips short and finds your usual time', () => {
    expect(['23:00', '23:30', '00:00', '00:30', '09:00', '10:30', '12:00'].map(shortClock)).toEqual(['11pm', '11:30', '12am', '12:30', '9am', '10:30', '12pm']);
    expect(minutesToClock(-30)).toBe('23:30');
    expect(typicalTime('sleep', ['23:30', '00:30', '01:00'])).toBe('00:30');
    expect(typicalTime('sleep', ['23:30', '00:30'])).toBe('00:00');
    expect(typicalTime('wake', ['08:00', '09:30', '08:20', '11:45'])).toBe('08:55');
    expect(typicalTime('wake', [])).toBeNull();
  });

  it('your usual time comes from the same kind of day once there are 3', () => {
    const days: Record<string, DayLog> = {
      '2026-09-21': { times: { sleep: '00:10' } },
      '2026-09-22': { times: { sleep: '00:20' } },
      '2026-09-23': { times: { sleep: '00:30' } },
      '2026-09-26': { times: { sleep: '02:00' } }, // Saturday
      '2026-09-27': { times: { sleep: '02:30' } }, // Sunday
    };
    expect(usualTime(days, 'sleep', TUE)).toBe('00:20');
    // Only 2 weekend nights so far: all of them count
    expect(usualTime(days, 'sleep', SAT)).toBe('00:30');
    expect(usualTime({ ...days, '2026-09-20': { times: { sleep: '01:50' } }, '2026-09-19': { times: { sleep: '02:00' } } }, 'sleep', SAT)).toBe('02:00');
    expect(usualTime({}, 'sleep', TUE)).toBeNull();
  });

  it('logging a time saves it and works out the target for that day (later at the weekend)', () => {
    const tue: DayLog = { missed: { sleep: true } };
    applyTime(tue, BUILT_IN_BY_ID.sleep, '01:30', settings, TUE);
    expect(tue).toMatchObject({ times: { sleep: '01:30' }, done: { sleep: false }, missed: {} });
    applyTime(tue, BUILT_IN_BY_ID.wake, '08:40', settings, TUE);
    expect(tue).toMatchObject({ times: { sleep: '01:30', wake: '08:40' }, done: { sleep: false, wake: true } });

    const sat: DayLog = {};
    applyTime(sat, BUILT_IN_BY_ID.sleep, '01:30', settings, SAT);
    expect(sat.done?.sleep).toBe(true);
    applyTime(sat, BUILT_IN_BY_ID.sleep, null, settings, SAT);
    expect(sat.times).toEqual({});
    expect(sat.done?.sleep).toBeUndefined();
  });

  it('the day counts it like before: on target is done, late is an honest miss', () => {
    const tue: DayLog = {};
    applyTime(tue, BUILT_IN_BY_ID.sleep, '00:40', settings, TUE);
    applyTime(tue, BUILT_IN_BY_ID.wake, '09:20', settings, TUE);
    const data: AppData = { days: { [TUE]: tue }, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings };
    const items = summarize(data, TUE).evalByDate[TUE].items;
    expect(items.find((i) => i.habit.id === 'sleep')).toMatchObject({ done: true, missed: false });
    expect(items.find((i) => i.habit.id === 'wake')).toMatchObject({ done: false, missed: true });
  });

  it('a plain "yes" keeps a time that was on target, and drops one that was late', () => {
    const l: DayLog = {};
    applyTime(l, BUILT_IN_BY_ID.sleep, '00:30', settings, TUE);
    applyTime(l, BUILT_IN_BY_ID.wake, '10:00', settings, TUE);
    applyDone(l, BUILT_IN_BY_ID.sleep, true, settings);
    applyDone(l, BUILT_IN_BY_ID.wake, true, settings);
    expect(l.times).toEqual({ sleep: '00:30' });
    expect(l.done).toMatchObject({ sleep: true, wake: true });
  });

  it('reads last night from what you logged, or the Watch', () => {
    expect(nightOf({ times: { sleep: '23:45', wake: '07:30' } })).toEqual({ asleep: '23:45', awake: '07:30', mins: 465 });
    expect(nightOf({ sleepAuto: { asleep: '00:30', awake: '08:00', at: 0 }, times: { wake: '08:15' } })).toEqual({ asleep: '00:30', awake: '08:15', mins: 465 });
    expect(nightOf({ times: { sleep: '01:00' } })).toEqual({ asleep: '01:00', awake: null, mins: null });
    // Typos that don't add up to a night don't count as one
    expect(nightOf({ times: { sleep: '01:00', wake: '00:30' } }).mins).toBeNull();
    expect(nightOf(undefined)).toEqual({ asleep: null, awake: null, mins: null });
  });
});
