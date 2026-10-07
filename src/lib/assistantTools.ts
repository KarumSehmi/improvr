/**
 * The assistant's hands: what Claude sees of your data (the <app_context> on each message) and
 * the tools it calls, run here in the app so every change saves and syncs like a tap would,
 * and comes with an Undo.
 */
import dayjs from 'dayjs';
import { addTodo, applyDone, applyMissed, targetOf, toggleTodo } from './actions';
import { EVENT_COLORS, upcomingBirthdays } from './calendar';
import { WORKOUTS, habitsFor, type Habit } from './config';
import { addDays, dateKey, fmt, type DateKey } from './dates';
import { isDone } from './engine';
import { dayLabel, repeatLabel, timeLabel } from './quickadd';
import { getData, newId, removeItem, updateDay, upsert, useApp } from './store';
import { sortTodos, todoListsFor } from './todos';
import type { AppData, CalEvent, DayLog, Todo, WorkoutType } from './types';

// ---------------------------------------------------------------------------
// What Claude sees
// ---------------------------------------------------------------------------

const day = (d: DateKey) => `${d} (${fmt(d, 'ddd D MMM')})`;
const short = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);

function todoLine(t: Todo, today: DateKey): string {
  const bits = [t.date ? day(t.date) + (t.date < today ? ' — overdue, carried over to today' : '') : 'someday'];
  if (t.time) bits.push(t.time);
  if (t.list) bits.push(`list ${t.list}`);
  if (t.important) bits.push('★ starred');
  if (t.repeat) bits.push(`repeats ${repeatLabel(t.repeat)}`);
  if (t.notes) bits.push(`notes: ${short(t.notes)}`);
  return `- ${t.id}: "${t.title}" · ${bits.join(' · ')}`;
}

function habitState(h: Habit, log: DayLog | undefined): string {
  if (h.kind === 'water') return `${log?.water ?? 0}/${targetOf(h)} bottles`;
  if (h.kind === 'count') return `${log?.counts?.[h.id] ?? 0}/${targetOf(h)}${h.unit ? ` ${h.unit}` : ''}`;
  if (h.kind === 'avoid') return log?.avoid?.[h.id] === 'clean' ? 'stayed clean' : log?.avoid?.[h.id] === 'slip' ? 'slipped' : 'not answered';
  if (isDone(h, log)) return 'done';
  if (log?.missed?.[h.id] || (h.kind === 'time' && log?.done?.[h.id] === false)) return 'not done';
  return 'not yet';
}

/** Today, your lists, to-dos, calendar, birthdays and habits — everything Claude needs to act on a message. */
export function buildContext(data: AppData, now = new Date()): string {
  const today = dateKey(now);
  const { settings } = data;
  const log = data.days[today];
  const out: string[] = [`Now: ${dayjs(now).format('dddd D MMMM YYYY, HH:mm')}. Today is ${today}.`];
  if (settings.name) out.push(`Their name: ${settings.name}.`);

  out.push('', `To-do lists (id: name): ${todoListsFor(settings).map((l) => `${l.id}: ${l.emoji} ${l.name}`).join(' · ')}`);

  const todos = Object.values(data.todos);
  const open = sortTodos(todos.filter((t) => !t.doneOn)).slice(0, 150);
  const doneToday = todos.filter((t) => t.doneOn === today);
  out.push('', `Open to-dos (${open.length}):`, ...(open.length ? open.map((t) => todoLine(t, today)) : ['(none)']));
  if (doneToday.length) out.push('Ticked off today:', ...doneToday.map((t) => `- ${t.id}: "${t.title}"`));

  const from = addDays(today, -7);
  const to = addDays(today, 120);
  const events = Object.values(data.events)
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 100);
  out.push('', `Calendar events (last week to 4 months ahead):`);
  out.push(...(events.length ? events.map((e) => `- ${e.id}: "${e.title}" · ${day(e.date)}${e.time ? ` · ${e.time}` : ''}${e.notes ? ` · notes: ${short(e.notes)}` : ''}`) : ['(none)']));

  const birthdays = upcomingBirthdays(data.birthdays, today).slice(0, 100);
  out.push('', 'Birthdays (soonest first):');
  out.push(...(birthdays.length ? birthdays.map((u) => `- ${u.birthday.id}: ${u.birthday.name} · ${fmt(u.date, 'D MMMM')} (next ${day(u.date)}${u.turning ? `, turning ${u.turning}` : ''})`) : ['(none)']));

  out.push('', `Today's habits (id: name — kind — status):`);
  for (const h of habitsFor(settings)) out.push(`- ${h.id}: ${h.emoji} ${h.label}${h.hint ? ` (${h.hint})` : ''} — ${h.kind} — ${habitState(h, log)}`);
  out.push(`Workouts today: ${log?.workouts?.length ? log.workouts.join(', ') : 'none'} (types: ${WORKOUTS.map((w) => `${w.id} = ${w.label}`).join(', ')})`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Running Claude's tool calls
// ---------------------------------------------------------------------------

/** One change Claude made, shown in the chat with an Undo button. */
export interface Change {
  label: string;
  undo: () => void;
}

export interface ToolOutcome {
  /** What Claude is told happened. */
  result: string;
  isError?: boolean;
  change?: Change;
}

/** A bad argument: Claude is told what was wrong so it can fix it and try again. */
class ToolError extends Error {}
const fail = (message: string): never => {
  throw new ToolError(message);
};

type Input = Record<string, unknown>;

function text(input: Input, key: string, required: true): string;
function text(input: Input, key: string, required?: false): string | undefined;
function text(input: Input, key: string, required = false): string | undefined {
  const v = input[key];
  if (v == null) return required ? fail(`"${key}" is required.`) : undefined;
  if (typeof v !== 'string') return fail(`"${key}" must be text.`);
  const s = v.trim();
  return required && !s ? fail(`"${key}" can't be empty.`) : s;
}

function int(input: Input, key: string, min: number, max: number): number | undefined {
  const v = input[key];
  if (v == null) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return fail(`"${key}" must be a whole number from ${min} to ${max}.`);
  return v;
}

function flag(input: Input, key: string): boolean | undefined {
  const v = input[key];
  if (v == null) return undefined;
  return typeof v === 'boolean' ? v : fail(`"${key}" must be true or false.`);
}

function date(input: Input, key = 'date'): DateKey | undefined {
  const v = text(input, key);
  if (!v) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || dayjs(v).format('YYYY-MM-DD') !== v) return fail(`"${key}" must be a real date as YYYY-MM-DD.`);
  return v;
}

/** "15:00" (or "9:30"); "" means "no time". */
function time(input: Input): string | null | undefined {
  const v = text(input, 'time');
  if (v === undefined) return undefined;
  if (v === '') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return fail('"time" must be 24-hour HH:mm, like "15:00".');
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** A list id ("" = no list). Names work too, in case Claude uses one. */
function list(input: Input): string | null | undefined {
  const v = text(input, 'list');
  if (v === undefined) return undefined;
  if (v === '') return null;
  const lists = todoListsFor(useApp.getState().settings);
  const found = lists.find((l) => l.id === v) ?? lists.find((l) => l.name.toLowerCase() === v.toLowerCase());
  return found?.id ?? fail(`No list "${v}". Use one of: ${lists.map((l) => l.id).join(', ')}.`);
}

const when = (d: DateKey | null, t: string | null | undefined, today: DateKey) => `${d ? dayLabel(d, today) : 'Someday'}${t ? ` ${timeLabel(t)}` : ''}`;

function getItem<C extends 'todos' | 'events' | 'birthdays'>(col: C, input: Input): AppData[C][string] {
  const id = text(input, 'id', true);
  const what = { todos: 'to-do', events: 'event', birthdays: 'birthday' }[col];
  return (useApp.getState()[col][id] as AppData[C][string] | undefined) ?? fail(`No ${what} with id "${id}". Use an id from the context.`);
}

function addTodoTool(input: Input, today: DateKey): ToolOutcome {
  const someday = flag(input, 'someday');
  const t = addTodo(
    {
      title: text(input, 'title', true),
      date: someday ? null : (date(input) ?? today),
      time: time(input) ?? null,
      list: list(input) ?? null,
      important: flag(input, 'important'),
      repeat: int(input, 'repeat_days', 1, 365) ?? null,
      notes: text(input, 'notes') || undefined,
    },
    today,
  );
  const label = when(t.date, t.time, today);
  return {
    result: `Added to-do ${t.id}: "${t.title}" for ${t.date ?? 'someday'}${t.time ? ` at ${t.time}` : ''}.`,
    change: { label: `📝 ${t.title} · ${label}`, undo: () => removeItem('todos', t.id) },
  };
}

function updateTodoTool(input: Input, today: DateKey): ToolOutcome {
  const before = getItem('todos', input);
  const nextBefore = before.next ? useApp.getState().todos[before.next] : undefined;
  const next: Todo = { ...before };
  const title = text(input, 'title');
  if (title) next.title = title;
  const d = date(input);
  if (flag(input, 'someday')) {
    next.date = null;
    next.repeat = null;
  } else if (d) next.date = d;
  const t = time(input);
  if (t !== undefined) next.time = t;
  const l = list(input);
  if (l !== undefined) next.list = l;
  const important = flag(input, 'important');
  if (important !== undefined) next.important = important || undefined;
  const notes = text(input, 'notes');
  if (notes !== undefined) next.notes = notes || undefined;
  upsert('todos', next);

  const done = flag(input, 'done');
  let what = 'Updated';
  if (done !== undefined && done !== !!next.doneOn) {
    toggleTodo(next, today);
    what = done ? 'Ticked off' : 'Unticked';
  }
  const after = useApp.getState().todos[before.id];
  return {
    result: `${what} to-do ${before.id}: "${after.title}" · ${after.doneOn ? `done ${after.doneOn}` : `${after.date ?? 'someday'}${after.time ? ` at ${after.time}` : ''}`}.${after.next && after.next !== before.next ? ` Next one: ${after.next}.` : ''}`,
    change: {
      label: `${what === 'Ticked off' ? '✅' : '📝'} ${what}: ${after.title}${after.doneOn ? '' : ` · ${when(after.date, after.time, today)}`}`,
      undo: () => {
        // Ticking off a repeating one added the next one; unticking took it away.
        const cur = useApp.getState().todos[before.id];
        if (cur?.next && cur.next !== before.next) removeItem('todos', cur.next);
        if (nextBefore && !useApp.getState().todos[nextBefore.id]) upsert('todos', nextBefore);
        upsert('todos', before);
      },
    },
  };
}

function eventFields(input: Input, base: CalEvent): CalEvent {
  const e = { ...base };
  const title = text(input, 'title');
  if (title) e.title = title;
  const d = date(input);
  if (d) e.date = d;
  const t = time(input);
  if (t !== undefined) e.time = t ?? undefined;
  const notes = text(input, 'notes');
  if (notes !== undefined) e.notes = notes || undefined;
  const color = text(input, 'color');
  if (color) e.color = EVENT_COLORS.includes(color) ? color : fail(`"color" must be one of: ${EVENT_COLORS.join(', ')}.`);
  return e;
}

function habitFor(id: string): Habit {
  const h = habitsFor(useApp.getState().settings).find((x) => x.id === id);
  return h ?? fail(`No habit "${id}". Use a habit id from the context.`);
}

/** The parts of a day's log one habit lives in, so Undo puts back just that habit. */
function habitFields(l: DayLog | undefined, h: Habit) {
  return {
    done: l?.done?.[h.id],
    missed: l?.missed?.[h.id],
    skipped: l?.skipped?.[h.id],
    avoid: l?.avoid?.[h.id],
    time: l?.times?.[h.id],
    count: l?.counts?.[h.id],
    water: l?.water,
    finMl: l?.finMl,
  };
}

function restoreHabit(l: DayLog, h: Habit, f: ReturnType<typeof habitFields>) {
  const put = <T,>(rec: Record<string, T> | undefined, v: T | undefined): Record<string, T> => {
    const next = { ...rec };
    if (v === undefined) delete next[h.id];
    else next[h.id] = v;
    return next;
  };
  l.done = put(l.done, f.done);
  l.missed = put(l.missed, f.missed);
  l.skipped = put(l.skipped, f.skipped);
  l.avoid = put(l.avoid, f.avoid);
  l.times = put(l.times, f.time);
  l.counts = put(l.counts, f.count);
  if (h.kind === 'water') l.water = f.water;
  if (h.kind === 'dose') l.finMl = f.finMl;
}

function logHabitTool(input: Input, today: DateKey): ToolOutcome {
  const h = habitFor(text(input, 'habit_id', true));
  const status = text(input, 'status', true);
  if (!['done', 'not_done', 'clear'].includes(status)) fail('"status" must be done, not_done or clear.');
  const amount = int(input, 'amount', 0, 1000);
  const d = date(input) ?? today;
  if (d > today) fail("Habits can't be logged for a future day.");
  const { settings } = useApp.getState();
  const before = habitFields(useApp.getState().days[d], h);

  updateDay(d, (l) => {
    if (status === 'clear') {
      applyDone(l, h, false, settings);
      applyMissed(l, h, false);
    } else if (status === 'not_done') applyMissed(l, h, true);
    else if (amount != null && (h.kind === 'water' || h.kind === 'count')) {
      if (h.kind === 'water') l.water = amount;
      else l.counts = { ...l.counts, [h.id]: amount };
      if (l.missed) delete l.missed[h.id];
    } else applyDone(l, h, true, settings);
  });

  const state = habitState(h, useApp.getState().days[d]);
  const on = d === today ? '' : ` · ${dayLabel(d, today)}`;
  const icon = state === 'done' || state === 'stayed clean' ? '✅' : state === 'not done' || state === 'slipped' ? '✖️' : h.emoji;
  return {
    result: `${h.label} on ${d}: ${state}.`,
    change: { label: `${icon} ${h.kind === 'water' ? 'Water' : h.label}: ${state}${on}`, undo: () => updateDay(d, (l) => restoreHabit(l, h, before)) },
  };
}

function logWorkoutTool(input: Input, today: DateKey): ToolOutcome {
  const type = text(input, 'type', true) as WorkoutType;
  const w = WORKOUTS.find((x) => x.id === type) ?? fail(`"type" must be one of: ${WORKOUTS.map((x) => x.id).join(', ')}.`);
  const remove = !!flag(input, 'remove');
  const d = date(input) ?? today;
  if (d > today) fail("Workouts can't be logged for a future day.");
  const had = !!useApp.getState().days[d]?.workouts?.includes(type);
  const set = (on: boolean) =>
    updateDay(d, (l) => {
      const rest = (l.workouts ?? []).filter((x) => x !== type);
      l.workouts = on ? [...rest, type] : rest;
    });
  if (had !== !remove) set(!remove);
  const on = d === today ? '' : ` · ${dayLabel(d, today)}`;
  return {
    result: `${w.label} ${remove ? 'removed from' : 'logged for'} ${d}.`,
    change: { label: `${w.emoji} ${w.label} ${remove ? 'removed' : 'logged'}${on}`, undo: () => set(had) },
  };
}

/** Do what Claude asked (or say why not). Never throws. */
export function runTool(name: string, rawInput: unknown, now = new Date()): ToolOutcome {
  const input = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Input;
  const today = dateKey(now);
  try {
    switch (name) {
      case 'add_todo':
        return addTodoTool(input, today);
      case 'update_todo':
        return updateTodoTool(input, today);
      case 'delete_todo': {
        const t = getItem('todos', input);
        removeItem('todos', t.id);
        return { result: `Deleted to-do "${t.title}".`, change: { label: `🗑️ Deleted: ${t.title}`, undo: () => upsert('todos', t) } };
      }
      case 'add_event': {
        const e = eventFields(input, { id: newId(), title: '', date: date(input) ?? fail('"date" is required.'), color: 'violet', createdAt: Date.now() });
        if (!e.title) fail('"title" is required.');
        upsert('events', e);
        return { result: `Added event ${e.id}: "${e.title}" on ${e.date}${e.time ? ` at ${e.time}` : ''}.`, change: { label: `📅 ${e.title} · ${when(e.date, e.time, today)}`, undo: () => removeItem('events', e.id) } };
      }
      case 'update_event': {
        const before = getItem('events', input);
        const e = eventFields(input, before);
        upsert('events', e);
        return { result: `Updated event ${e.id}: "${e.title}" on ${e.date}${e.time ? ` at ${e.time}` : ''}.`, change: { label: `📅 Updated: ${e.title} · ${when(e.date, e.time, today)}`, undo: () => upsert('events', before) } };
      }
      case 'delete_event': {
        const e = getItem('events', input);
        removeItem('events', e.id);
        return { result: `Deleted event "${e.title}".`, change: { label: `🗑️ Deleted: ${e.title}`, undo: () => upsert('events', e) } };
      }
      case 'add_birthday': {
        const name = text(input, 'name', true);
        const month = int(input, 'month', 1, 12) ?? fail('"month" is required.');
        const dayOfMonth = int(input, 'day', 1, 31) ?? fail('"day" is required.');
        const year = int(input, 'year', 1900, Number(today.slice(0, 4)));
        // 2000 was a leap year, so 29 February is allowed.
        if (dayjs(new Date(2000, month - 1, dayOfMonth)).month() !== month - 1) fail(`There's no ${dayOfMonth}/${month}.`);
        const b = { id: newId(), name, month, day: dayOfMonth, year: year ?? null };
        upsert('birthdays', b);
        const label = dayjs(new Date(2000, month - 1, dayOfMonth)).format('D MMMM');
        return { result: `Saved ${name}'s birthday (${b.id}): ${label}${year ? ` ${year}` : ''}.`, change: { label: `🎂 ${name} · ${label}`, undo: () => removeItem('birthdays', b.id) } };
      }
      case 'delete_birthday': {
        const b = getItem('birthdays', input);
        removeItem('birthdays', b.id);
        return { result: `Deleted ${b.name}'s birthday.`, change: { label: `🗑️ Deleted: ${b.name}'s birthday`, undo: () => upsert('birthdays', b) } };
      }
      case 'log_habit':
        return logHabitTool(input, today);
      case 'log_workout':
        return logWorkoutTool(input, today);
      default:
        return { result: `Unknown tool "${name}".`, isError: true };
    }
  } catch (err) {
    if (err instanceof ToolError) return { result: err.message, isError: true };
    console.error(`assistant tool ${name} failed`, err);
    return { result: `That didn't work: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}

/** The context for the next message, from what's in the app right now. */
export const currentContext = () => buildContext(getData());
