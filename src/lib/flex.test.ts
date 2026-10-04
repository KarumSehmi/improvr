import { beforeEach, describe, expect, it } from 'vitest';
import { addTodo, applyDone, editHabit, moveHabit, resetHabit, setMissed, toggleTodo } from './actions';
import { BUILT_IN_BY_ID, allHabits, caffeineCutoff, defaultSettings, featureOn, habitLabel, habitsFor, reminderTimes, sleepTargets, type Habit } from './config';
import { startOfDay } from './dates';
import { summarize } from './engine';
import { badgeCount, dueNow, sectionLater } from './moments';
import { dueNudges } from './nudges';
import { suggestions } from './smart';
import { useApp } from './store';
import { carriedDays, groupTodos, openTodos, snoozeOptions, todosOn, upcomingTodos } from './todos';
import type { AppData, DayLog, Settings, Todo } from './types';

const START = '2026-09-21'; // Monday
const TUE = '2026-09-29';
function data(days: Record<string, DayLog> = {}, extra: Partial<Settings> = {}): AppData {
  return { days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: { ...defaultSettings(START), ...extra } };
}
const find = (s: Settings, id: string) => habitsFor(s).find((h) => h.id === id)!;

describe('edit any habit', () => {
  it('built-ins take your name, emoji, section, XP, bonus and rest days — never a new kind', () => {
    const s = { ...defaultSettings(START), habitEdits: { creatine: { label: 'Creatine 5g', emoji: '💪', section: 'morning' as const, points: 15, optional: true, restDays: [0] } } };
    const h = find(s, 'creatine');
    expect(h).toMatchObject({ id: 'creatine', kind: 'check', label: 'Creatine 5g', emoji: '💪', section: 'morning', points: 15, optional: true, restDays: [0] });
    // It now sits in Morning, after the morning built-ins
    const morning = habitsFor(s).filter((x) => x.section === 'morning').map((x) => x.id);
    expect(morning.at(-1)).toBe('creatine');
    // Rest days and bonus apply to the day
    const sum = summarize(data({}, s), '2026-09-27'); // a Sunday
    expect(sum.evalByDate['2026-09-27'].items.find((i) => i.habit.id === 'creatine')!.visible).toBe(false);
    expect(sum.evalByDate['2026-09-26'].items.find((i) => i.habit.id === 'creatine')!.visible).toBe(false); // before it was added
  });

  it('your order holds inside each section', () => {
    const s = { ...defaultSettings(START), habitOrder: ['protein', 'macro', 'water'] };
    expect(habitsFor(s).filter((h) => h.section === 'day').map((h) => h.id).slice(0, 3)).toEqual(['protein', 'macro', 'water']);
  });

  it('the water target moves the label and what counts as done', () => {
    const s = { ...defaultSettings(START), habitEdits: { water: { target: 3 } } };
    expect(find(s, 'water').label).toBe('3 bottles of water');
    const sum = summarize(data({ [START]: { water: 2 } }, s), START);
    expect(sum.evals[0].items.find((i) => i.habit.id === 'water')!.done).toBe(false);
    const sum3 = summarize(data({ [START]: { water: 3 } }, s), START);
    expect(sum3.evals[0].items.find((i) => i.habit.id === 'water')!.done).toBe(true);
  });

  it('count habits are done at their target', () => {
    const read: Habit = { id: 'c_read', label: 'Read', emoji: '📖', section: 'night', kind: 'count', points: 10, target: 10, unit: 'pages', since: START };
    const s = { ...defaultSettings(START), customHabits: [read] };
    const day = (n: number) => summarize(data({ [START]: { counts: { c_read: n } } }, s), START).evals[0].items.find((i) => i.habit.id === 'c_read')!;
    expect(day(6)).toMatchObject({ done: false, required: true });
    expect(day(10)).toMatchObject({ done: true });
    const l: DayLog = {};
    applyDone(l, find(s, 'c_read'), true, s);
    expect(l.counts).toEqual({ c_read: 10 });
  });
});

describe('targets and times', () => {
  it('weekday bed and wake times can move too', () => {
    const s = { ...defaultSettings(START), weekday: { sleep: '00:30', wake: '07:30' } };
    expect(sleepTargets(s, TUE)).toEqual({ sleep: '00:30', wake: '07:30', weekend: false });
    expect(habitLabel(BUILT_IN_BY_ID.sleep, s, TUE)).toBe('Asleep before 12:30am');
    expect(find(s, 'wake').label).toBe('Up before 7:30am');
    // Renamed habits keep your name, even at the weekend
    const named = { ...s, habitEdits: { sleep: { label: 'Bed on time' } } };
    expect(habitLabel(find(named, 'sleep'), named, '2026-09-26')).toBe('Bed on time');
  });

  it('the caffeine cutoff moves the label, Up next and the reminder', () => {
    const s = { ...defaultSettings(START), caffeineCutoff: '15:00' };
    expect(caffeineCutoff(s)).toBe('15:00');
    expect(find(s, 'caffeine').label).toBe('No caffeine after 3pm');
    expect(reminderTimes(s).caffeine).toBe('14:45');
    expect(reminderTimes({ ...s, reminders: { caffeine: '12:00' } }).caffeine).toBe('12:00');
    // Older versions saved the default 13:45 along with everything else — that still follows the cutoff.
    expect(reminderTimes({ ...s, reminders: { caffeine: '13:45', morning: '08:00' } })).toMatchObject({ caffeine: '14:45', morning: '08:00' });
    const d = data({}, s);
    const sum = summarize(d, TUE);
    const at = new Date(startOfDay(TUE) + (14 * 60 + 20) * 60_000);
    expect(suggestions(at, TUE, sum.evalByDate[TUE], sum, d).find((x) => x.id === 'caffeine')?.title).toBe('Caffeine cutoff in 40m');
    const nudges = dueNudges({ summary: sum, date: TUE, minutes: 14 * 60 + 50, sent: {} });
    expect(nudges.find((n) => n.id === 'caffeine')?.title).toBe('☕ Caffeine cutoff at 3pm');
  });

  it('sections come due at your hours', () => {
    const s = { ...defaultSettings(START), sectionHours: { night: 18 } };
    expect(sectionLater('night', 19)).toBe(true);
    expect(sectionLater('night', 19, s)).toBe(false);
    const sum = summarize(data({}, s), TUE);
    expect(dueNow(sum.evalByDate[TUE], 19, s).some((i) => i.habit.section === 'night')).toBe(true);
    expect(badgeCount(sum.evalByDate[TUE], 19, {}, TUE, s)).toBeGreaterThan(badgeCount(sum.evalByDate[TUE], 19, {}, TUE));
  });
});

describe('switching parts of the app off', () => {
  it('check-ins and card spending stop nudging when switched off', () => {
    const on = summarize(data(), '2026-09-27');
    const off = summarize(data({}, { features: { checkins: false, budget: false } }), '2026-09-27');
    const ids = (sum: typeof on, mins: number) => dueNudges({ summary: sum, date: '2026-09-27', minutes: mins, sent: {}, spending: {} }).map((n) => n.id);
    expect(ids(on, 15 * 60 + 5)).toContain('afternoon');
    expect(ids(off, 15 * 60 + 5)).not.toContain('afternoon');
    expect(ids(on, 18 * 60 + 5)).toContain('spending');
    expect(ids(off, 18 * 60 + 5)).not.toContain('spending');
    expect(featureOn(off.settings, 'quest')).toBe(true);
  });
});

describe('to-dos: someday, lists and grouping', () => {
  const today = '2026-10-04';
  const t = (id: string, date: string | null, extra: Partial<Todo> = {}): Todo => ({ id, title: id, date, doneOn: null, createdAt: id.charCodeAt(0), ...extra });
  const todos: Record<string, Todo> = {
    late: t('late', '2026-10-01'),
    now: t('now', today, { time: '15:00' }),
    star: t('star', today, { important: true }),
    tmrw: t('tmrw', '2026-10-05', { list: 'home' }),
    week: t('week', '2026-10-09'),
    later: t('later', '2026-11-20'),
    some: t('some', null, { list: 'home' }),
    done: t('done', '2026-10-03', { doneOn: '2026-10-03' }),
  };

  it("someday ones never carry over or nag", () => {
    expect(openTodos(todos, today).map((x) => x.id)).toEqual(['star', 'late', 'now']);
    expect(carriedDays(todos.some, today)).toBe(0);
    expect(todosOn(todos, today, today).map((x) => x.id)).toEqual(['star', 'late', 'now']);
    expect(upcomingTodos(todos, today).map((x) => x.id)).toEqual(['tmrw', 'week']);
  });

  it('groups by when, and filters by list', () => {
    const g = groupTodos(todos, today);
    expect(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((x: Todo) => x.id)]))).toEqual({
      overdue: ['late'],
      today: ['star', 'now'],
      tomorrow: ['tmrw'],
      week: ['week'],
      later: ['later'],
      someday: ['some'],
      done: ['done'],
    });
    expect(groupTodos(todos, today, 'home').someday.map((x) => x.id)).toEqual(['some']);
    expect(groupTodos(todos, today, 'home').today).toEqual([]);
  });

  it('quick reschedule choices', () => {
    expect(snoozeOptions(today).map((o) => o.label)).toEqual(['Tomorrow', 'This weekend', 'Someday']); // a Sunday: next week is tomorrow
    expect(snoozeOptions('2026-10-07')).toEqual([
      { label: 'Tomorrow', date: '2026-10-08' },
      { label: 'This weekend', date: '2026-10-10' },
      { label: 'Next week', date: '2026-10-12' },
      { label: 'Someday', date: null },
    ]);
  });
});

describe('editing from the app', () => {
  beforeEach(() => useApp.setState({ days: {}, todos: {}, settings: defaultSettings(START) }));

  it('edits built-ins as changes, and resets them', () => {
    editHabit('protein', { label: 'Hit 160g protein', points: 20 });
    expect(useApp.getState().settings.habitEdits).toEqual({ protein: { label: 'Hit 160g protein', points: 20 } });
    editHabit('protein', { points: undefined });
    expect(useApp.getState().settings.habitEdits).toEqual({ protein: { label: 'Hit 160g protein' } });
    resetHabit('protein');
    expect(find(useApp.getState().settings, 'protein').label).toBe('Hit protein');
  });

  it('edits your own habits in place', () => {
    useApp.setState({ settings: { ...defaultSettings(START), customHabits: [{ id: 'c_x', label: 'Stretch', emoji: '🧘', section: 'night', kind: 'check', points: 5 }] } });
    editHabit('c_x', { label: 'Stretch 10 min' });
    expect(useApp.getState().settings.customHabits?.[0].label).toBe('Stretch 10 min');
    expect(useApp.getState().settings.habitEdits).toBeUndefined();
  });

  it('moves habits up and down inside their section', () => {
    const before = allHabits(useApp.getState().settings).filter((h) => h.section === 'day').map((h) => h.id);
    moveHabit('macro', -1);
    const after = allHabits(useApp.getState().settings).filter((h) => h.section === 'day').map((h) => h.id);
    expect(after.slice(0, 2)).toEqual(['macro', 'water']);
    expect(after.slice(2)).toEqual(before.slice(2));
    moveHabit('macro', -1); // already first
    expect(allHabits(useApp.getState().settings).filter((h) => h.section === 'day')[0].id).toBe('macro');
  });

  it('"not done" is an honest no for every kind', () => {
    setMissed(TUE, BUILT_IN_BY_ID.vape, true);
    setMissed(TUE, BUILT_IN_BY_ID.wake, true);
    setMissed(TUE, BUILT_IN_BY_ID.pills, true);
    expect(useApp.getState().days[TUE]).toMatchObject({ avoid: { vape: 'slip' }, done: { wake: false }, missed: { pills: true } });
    setMissed(TUE, BUILT_IN_BY_ID.pills, false);
    expect(useApp.getState().days[TUE].missed).toEqual({});
  });

  it('a repeating to-do keeps its list, time and star', () => {
    const today = '2026-10-04';
    const todo = addTodo({ title: 'Haircut', repeat: 14, list: 'home', time: '10:00', important: true }, today);
    expect(todo.date).toBe(today);
    toggleTodo(todo, today);
    const next = Object.values(useApp.getState().todos).find((x) => !x.doneOn)!;
    expect(next).toMatchObject({ title: 'Haircut', date: '2026-10-18', list: 'home', time: '10:00', important: true, repeat: 14 });
    const someday = addTodo({ title: 'Headphones', date: null, repeat: 7 }, today);
    expect(someday).toMatchObject({ date: null, repeat: null });
  });
});
