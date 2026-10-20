import { describe, expect, it } from 'vitest';
import { applyTime } from './actions';
import { BUILT_IN_BY_ID, defaultSettings } from './config';
import { addDays, weekday } from './dates';
import { summarize } from './engine';
import { amounts, byWeekday, cleanStats, cravingTimes, dayState, lastDay, monthDays, patterns, periods, rangeStart, rangeTally, runs, slipLog, timeStats, usualTick } from './habitStats';
import type { AppData, DayLog, Settings } from './types';

const START = '2026-09-21'; // a Monday
const TODAY = '2026-10-20'; // a Tuesday, the 30th day

function data(days: Record<string, DayLog>, extra: Partial<Settings> = {}): AppData {
  return { days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: { ...defaultSettings(START), ...extra } };
}
const sum = (days: Record<string, DayLog>, extra: Partial<Settings> = {}, today = TODAY) => summarize(data(days, extra), today);
/** Each day from START, `n` of them. */
const each = (n: number, fn: (date: string, i: number) => DayLog) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(START, i), fn(addDays(START, i), i)]));
const at = (date: string, h: number, m = 0) => {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).getTime();
};

describe('a habit, day by day', () => {
  it('says how each day went: done, missed, allowed, blank, open, off or not due', () => {
    const s = sum({
      '2026-09-21': { done: { pills: true }, avoid: { vape: 'clean', alcohol: 'slip' } },
      '2026-09-22': { avoid: { vape: 'slip', alcohol: 'slip' }, missed: { pills: true } },
      '2026-09-23': { dayOff: true },
      [TODAY]: {},
    });
    const st = (id: string, d: string) => dayState(s, s.habits.findIndex((h) => h.id === id), s.evalByDate[d]);
    expect(st('pills', '2026-09-21')).toBe('done');
    expect(st('alcohol', '2026-09-21')).toBe('allowed'); // the one drinking night a week
    expect(st('alcohol', '2026-09-22')).toBe('missed'); // the second
    expect(st('vape', '2026-09-22')).toBe('missed');
    expect(st('pills', '2026-09-22')).toBe('missed');
    expect(st('pills', '2026-09-23')).toBe('off');
    expect(st('pills', '2026-09-24')).toBe('missed'); // never ticked, and the day's over
    expect(st('vape', '2026-09-24')).toBe('blank'); // never answered isn't a slip
    expect(st('vape', TODAY)).toBe('open');
    expect(st('surfaces', '2026-09-22')).toBe('none'); // a Wednesday job
  });

  it('lays a month out Monday first', () => {
    const s = sum({ '2026-10-01': { done: { pills: true } } });
    const grid = monthDays(s, 'pills', '2026-10-15');
    expect(grid.slice(0, 3)).toEqual([null, null, null]); // 1 Oct 2026 is a Thursday
    expect(grid[3]).toEqual({ date: '2026-10-01', state: 'done' });
    expect(grid.filter(Boolean)).toHaveLength(31);
    expect(grid.at(-1)?.state).toBe('none'); // the future
  });

  it('adds up a range, week by week (or month by month) and by day of the week', () => {
    const s = sum(each(29, (_, i) => ({ done: { weigh: i % 2 === 0 } })));
    expect(rangeStart(s, '30')).toBe(START);
    expect(rangeStart(s, 'all')).toBe(START);
    expect(rangeStart(sum({}, {}, '2026-12-31'), '30')).toBe('2026-12-02');
    const t = rangeTally(s, 'weigh', START);
    expect(t).toMatchObject({ days: 30, done: 15, missed: 14, open: 1, judged: 29, rate: 52 });
    expect(lastDay(s, 'weigh', START, 'missed')).toBe('2026-10-18');
    expect(lastDay(s, 'weigh', '2026-10-19', 'missed')).toBeNull();
    expect(periods(s, 'weigh', START).map((p) => p.label)).toEqual(['21 Sep', '28 Sep', '5 Oct', '12 Oct', '19 Oct']);
    expect(periods(s, 'weigh', START)[0]).toMatchObject({ done: 4, missed: 3, rate: 57 });
    const week = byWeekday(s, 'weigh', START);
    expect(week.map((w) => w.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week[0]).toMatchObject({ done: 3, missed: 2 }); // Mondays: 21 Sep, 5 & 19 Oct done
    // Past half a year it goes month by month.
    const long = summarize(data({}, { startDate: '2026-01-05' }), TODAY);
    expect(periods(long, 'weigh', '2026-01-05').map((p) => p.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  });

  it('lists runs longest first, counted like the streak on Today', () => {
    const s = sum(each(29, (d) => ({ avoid: { vape: d === '2026-10-01' ? 'slip' : 'clean' } })));
    const r = runs(s, 'vape');
    expect(r[0]).toEqual({ from: '2026-10-02', to: '2026-10-19', length: 18, current: true });
    expect(r[1]).toEqual({ from: '2026-09-21', to: '2026-09-30', length: 10, current: false });
    expect(r[0].length).toBe(s.habitStreaks.vape.current);
    expect(cleanStats(s, 'vape', START)).toMatchObject({ clean: 28, slips: 1, unanswered: 0, gap: null });
  });
});

describe('nicotine: slips, cravings and what goes with them', () => {
  // Late nights on even days; slips on days 0, 4, 8 and 12 (all after late nights); drinking on days 1, 4 and 8.
  const days = each(20, (d, i) => ({
    done: { sleep: i % 2 === 1 },
    avoid: { vape: i % 4 === 0 && i <= 12 ? 'slip' : 'clean', alcohol: [1, 4, 8].includes(i) ? 'slip' : 'clean' },
    urges: { vape: 1 },
    urgeAt: { vape: [at(d, i % 3 === 0 ? 9 : 22)] },
    note: i === 8 ? 'Pub with the lads' : undefined,
  }));
  const s = sum(days, { slipFines: { vape: { amount: 5, from: '2026-09-25' } } });

  it('logs each slip with what else was going on', () => {
    const log = slipLog(s, 'vape', START);
    expect(log.map((x) => x.date)).toEqual(['2026-10-03', '2026-09-29', '2026-09-25', '2026-09-21']);
    expect(log[1]).toMatchObject({ lateNight: true, drinking: true, urges: 1, fine: 5, note: 'Pub with the lads' });
    expect(log[3].fine).toBe(0); // before the fine started
    expect(cleanStats(s, 'vape', START)).toMatchObject({ slips: 4, clean: 16, urges: 20, gap: 4 });
  });

  it('counts when cravings hit', () => {
    const parts = cravingTimes(s, 'vape', START);
    expect(parts.map((p) => [p.id, p.count])).toEqual([
      ['morning', 7],
      ['afternoon', 0],
      ['evening', 0],
      ['night', 13],
    ]);
    // After midnight is still late at night.
    const late = sum({ '2026-09-21': { urgeAt: { vape: [at('2026-09-22', 1, 30)] } } });
    expect(cravingTimes(late, 'vape', START).find((p) => p.id === 'night')?.count).toBe(1);
  });

  it('spots the links: late nights, drinking, and the gap between slips', () => {
    const ids = patterns(s, 'vape', START).map((p) => p.id);
    expect(ids).toContain('late');
    expect(ids).toContain('drink');
    expect(ids).toContain('cravings');
    expect(ids).toContain('gap');
    expect(patterns(s, 'vape', START).find((p) => p.id === 'late')?.text).toBe('You slip on 40% of days after a late night, vs 0% after an early one. Protect your bedtime.');
  });

  it('says so when a stretch has no slips at all', () => {
    const clean = sum(each(10, () => ({ avoid: { vape: 'clean' } })));
    expect(patterns(clean, 'vape', START).map((p) => p.id)).toEqual(['gap']);
  });
});

describe('sleep and wake: the times', () => {
  const settings = defaultSettings(START);
  // Weeknights asleep 12:40am, up 8:20; weekends asleep 2:30am (late), up 10am.
  const days = each(14, (d) => {
    const weekend = [0, 6].includes(weekday(d));
    const l: DayLog = {};
    applyTime(l, BUILT_IN_BY_ID.sleep, weekend ? '02:30' : '00:40', settings, d);
    applyTime(l, BUILT_IN_BY_ID.wake, weekend ? '10:00' : '08:20', settings, d);
    return l;
  });
  const s = sum(days);

  it('finds your usual time, how steady it is, and how long you sleep', () => {
    const t = timeStats(s, 'sleep', START);
    expect(t).toMatchObject({ logged: 14, onTarget: 10, usual: '00:40', spread: 30, weekdayUsual: '00:40', weekendUsual: '02:30', avgSleep: 457, nights: 14 });
    expect(t.points[0]).toEqual({ date: START, time: '00:40', scale: 40, ok: true, mins: 460 });
    expect(t.points.at(-1)).toMatchObject({ date: TODAY, time: null, ok: null });
    expect(timeStats(s, 'wake', START)).toMatchObject({ logged: 14, onTarget: 14, usual: '08:20', weekendUsual: '10:00' });
  });

  it('says how steady and how different the weekend is', () => {
    const p = patterns(s, 'sleep', START);
    expect(p.find((x) => x.id === 'spread')?.text).toBe('Your bedtime usually lands within 30m of 12:40am.');
    expect(p.find((x) => x.id === 'weekend')?.text).toBe('Asleep around 12:40am on weekdays and 2:30am at the weekend.');
  });
});

describe('everyday habits', () => {
  it('links doing it with the rest of the day', () => {
    const s = sum(each(14, (_, i): DayLog => (i % 2 === 0 ? { done: { weigh: true, pills: true, faceAm: true, macro: true, protein: true, facePm: true } } : { done: { pills: true } })));
    expect(patterns(s, 'weigh', START).map((p) => p.id)).toContain('score');
  });

  it('knows when you usually tick it off (a tick after midnight is late, not early)', () => {
    const s = sum(each(5, (d, i) => ({ done: { pills: true }, doneAt: { pills: i < 4 ? at(d, 9, 30 + i * 10) : at(addDays(d, 1), 1) } })));
    expect(usualTick(s, 'pills', START)).toBe('09:50');
    expect(usualTick(sum({}), 'pills', START)).toBeNull();
  });

  it('averages water over the days it was due', () => {
    const s = sum(each(4, (_, i) => ({ water: i })));
    expect(amounts(s, BUILT_IN_BY_ID.water, START)).toEqual({ avg: 0.2, days: 28 });
    expect(amounts(s, BUILT_IN_BY_ID.water, '2026-10-17')).toEqual({ avg: 0, days: 2 });
  });
});
