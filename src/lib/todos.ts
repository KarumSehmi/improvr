/** One-off to-dos: planned for a day (or someday), and carried over to today until they're done. */
// .js endings because this file also runs on the server (server/notify.ts).
import { addDays, diffDays, weekday, type DateKey } from './dates.js';
import type { Settings, Todo, TodoList } from './types.js';

/** Where a to-do shows on the calendar: the day it was done, else its day, else today if it's overdue (null = someday). */
export function todoDay(t: Todo, today: DateKey): DateKey | null {
  if (t.doneOn) return t.doneOn;
  if (!t.date) return null;
  return t.date < today ? today : t.date;
}

/** How many days an open to-do has been carried over (0 = it's due today or later, or has no date). */
export function carriedDays(t: Todo, today: DateKey): number {
  return t.doneOn || !t.date ? 0 : Math.max(0, diffDays(today, t.date));
}

/** Still to do first; then starred; then by day, time and when it was added. */
const order = (a: Todo, b: Todo) =>
  Number(!!a.doneOn) - Number(!!b.doneOn) ||
  Number(!!b.important) - Number(!!a.important) ||
  (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
  (a.time ?? '99').localeCompare(b.time ?? '99') ||
  a.createdAt - b.createdAt;

export const sortTodos = (list: Todo[]) => [...list].sort(order);

/** To-dos showing on a day: still to do first (oldest first), then the ones done. */
export function todosOn(todos: Record<string, Todo>, date: DateKey, today: DateKey): Todo[] {
  return sortTodos(Object.values(todos).filter((t) => todoDay(t, today) === date));
}

/** Still to do, due today or carried over from earlier. */
export function openTodos(todos: Record<string, Todo>, today: DateKey): Todo[] {
  return sortTodos(Object.values(todos).filter((t) => !t.doneOn && !!t.date && t.date <= today));
}

/** Planned for the next few days (not today). */
export function upcomingTodos(todos: Record<string, Todo>, today: DateKey, withinDays = 7): Todo[] {
  return sortTodos(Object.values(todos).filter((t) => !t.doneOn && !!t.date && t.date > today && diffDays(t.date, today) <= withinDays));
}

/** No date yet: waiting for "someday". */
export function somedayTodos(todos: Record<string, Todo>): Todo[] {
  return sortTodos(Object.values(todos).filter((t) => !t.doneOn && !t.date));
}

export interface TodoGroups {
  overdue: Todo[];
  today: Todo[];
  tomorrow: Todo[];
  /** The rest of the next 7 days. */
  week: Todo[];
  later: Todo[];
  someday: Todo[];
  /** Ticked off in the last week, newest first. */
  done: Todo[];
}

/** Everything on your list, sorted into when it's for (optionally just one list). */
export function groupTodos(todos: Record<string, Todo>, today: DateKey, list?: string | null): TodoGroups {
  const all = Object.values(todos).filter((t) => list == null || (list === '' ? !t.list : t.list === list));
  const open = sortTodos(all.filter((t) => !t.doneOn));
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  return {
    overdue: open.filter((t) => t.date && t.date < today),
    today: open.filter((t) => t.date === today),
    tomorrow: open.filter((t) => t.date === tomorrow),
    week: open.filter((t) => t.date && t.date > tomorrow && t.date <= weekEnd),
    later: open.filter((t) => t.date && t.date > weekEnd),
    someday: open.filter((t) => !t.date),
    done: all
      .filter((t) => t.doneOn && diffDays(today, t.doneOn) < 7)
      .sort((a, b) => (b.doneOn ?? '').localeCompare(a.doneOn ?? '') || b.createdAt - a.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** The starter set. Rename, add or remove them in Plan → lists. */
export const DEFAULT_TODO_LISTS: TodoList[] = [
  { id: 'work', name: 'Work & uni', emoji: '💼' },
  { id: 'admin', name: 'Admin', emoji: '📬' },
  { id: 'home', name: 'Home', emoji: '🏠' },
  { id: 'health', name: 'Health', emoji: '💪' },
  { id: 'social', name: 'Social', emoji: '🥳' },
  { id: 'shop', name: 'Shopping', emoji: '🛒' },
];

export function todoListsFor(settings: Pick<Settings, 'todoLists'>): TodoList[] {
  return settings.todoLists ?? DEFAULT_TODO_LISTS;
}

// ---------------------------------------------------------------------------
// Moving things around
// ---------------------------------------------------------------------------

/** Quick reschedule choices: tomorrow, the weekend, next Monday, or someday. */
export function snoozeOptions(today: DateKey): { label: string; date: DateKey | null }[] {
  const wd = weekday(today);
  const toSat = 6 - wd;
  const toMon = (1 - wd + 7) % 7 || 7;
  const out: { label: string; date: DateKey | null }[] = [{ label: 'Tomorrow', date: addDays(today, 1) }];
  // Monday to Thursday only: on Friday it's tomorrow, and at the weekend "this weekend" is already here.
  if (wd >= 1 && wd <= 4) out.push({ label: 'This weekend', date: addDays(today, toSat) });
  if (toMon > 1) out.push({ label: 'Next week', date: addDays(today, toMon) });
  out.push({ label: 'Someday', date: null });
  return out;
}
