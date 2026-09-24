/** One-off to-dos: planned for a day, and carried over to today until they're done. */
// .js endings because this file also runs on the server (server/notify.ts).
import { diffDays, type DateKey } from './dates.js';
import type { Todo } from './types.js';

/** Where a to-do shows on the calendar: the day it was done, else its day, else today if it's overdue. */
export function todoDay(t: Todo, today: DateKey): DateKey {
  if (t.doneOn) return t.doneOn;
  return t.date < today ? today : t.date;
}

/** How many days an open to-do has been carried over (0 = it's due today or later). */
export function carriedDays(t: Todo, today: DateKey): number {
  return t.doneOn ? 0 : Math.max(0, diffDays(today, t.date));
}

const order = (a: Todo, b: Todo) => Number(!!a.doneOn) - Number(!!b.doneOn) || a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

/** To-dos showing on a day: still to do first (oldest first), then the ones done. */
export function todosOn(todos: Record<string, Todo>, date: DateKey, today: DateKey): Todo[] {
  return Object.values(todos)
    .filter((t) => todoDay(t, today) === date)
    .sort(order);
}

/** Still to do, due today or carried over from earlier. */
export function openTodos(todos: Record<string, Todo>, today: DateKey): Todo[] {
  return Object.values(todos)
    .filter((t) => !t.doneOn && t.date <= today)
    .sort(order);
}

/** Planned for the next few days (not today). */
export function upcomingTodos(todos: Record<string, Todo>, today: DateKey, withinDays = 7): Todo[] {
  return Object.values(todos)
    .filter((t) => !t.doneOn && t.date > today && diffDays(t.date, today) <= withinDays)
    .sort(order);
}
