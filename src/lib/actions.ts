/** One-tap bulk actions shared by "Up next" and the section quick buttons. */
import { floatXp, notifyUndo } from './feedback';
import { pop } from './celebrate';
import type { Habit } from './config';
import type { Todo } from './types';
import type { DateKey } from './dates';
import { addDays, dateKey } from './dates';
import { everyOn } from './engine';
import { newId, removeItem, setDay, updateDay, updateSettings, upsert, useApp } from './store';

export function tickAll(date: DateKey, habits: Habit[], e?: { clientX: number; clientY: number }) {
  if (!habits.length) return;
  const { days, settings } = useApp.getState();
  const before = structuredClone(days[date] ?? {});
  updateDay(date, (l) => {
    for (const h of habits) {
      if (h.kind === 'avoid') l.avoid = { ...l.avoid, [h.id]: 'clean' };
      else if (h.kind === 'dose') l.finMl = settings.finTargetMl;
      else {
        l.done = { ...l.done, [h.id]: true };
        if (l.skipped) delete l.skipped[h.id];
      }
    }
  });
  pop(e);
  floatXp(e, `+${habits.reduce((s, h) => s + h.points, 0)}`);
  notifyUndo(`${habits.length} ticked off`, () => setDay(date, before));
}

/** "Didn't do the rest": mark what's left as not done, so its section closes. Ticking one later still counts. */
export function markNotDone(date: DateKey, habits: Habit[]) {
  if (!habits.length) return;
  const before = structuredClone(useApp.getState().days[date] ?? {});
  updateDay(date, (l) => {
    for (const h of habits) {
      // Sleep / wake already have their own "no".
      if (h.kind === 'time') l.done = { ...l.done, [h.id]: false };
      else l.missed = { ...l.missed, [h.id]: true };
    }
  });
  notifyUndo(`${habits.length} marked not done`, () => setDay(date, before));
}

/**
 * Tick a to-do off, or back on. A repeating one schedules its next one (N days after today),
 * and unticking takes that back. Returns true if it's now done.
 */
export function toggleTodo(todo: Todo, today: DateKey): boolean {
  if (todo.doneOn) {
    const next = todo.next ? useApp.getState().todos[todo.next] : undefined;
    if (next && !next.doneOn) removeItem('todos', next.id);
    upsert('todos', { ...todo, doneOn: null, next: null });
    return false;
  }
  let next: string | null = null;
  if (todo.repeat) {
    next = newId();
    upsert('todos', { id: next, title: todo.title, notes: todo.notes, repeat: todo.repeat, date: addDays(today, todo.repeat), doneOn: null, createdAt: Date.now() });
  }
  upsert('todos', { ...todo, doneOn: today, next });
  return true;
}

/** How often a habit is due from today on (earlier days keep the old rule). 1 = every day. */
export function setFrequency(habitId: string, every: number) {
  const { settings } = useApp.getState();
  const today = dateKey();
  if (every < 1 || everyOn(settings, habitId, today) === every) return;
  const periods = (settings.frequency?.[habitId] ?? []).filter((p) => p.from < today);
  updateSettings({ frequency: { ...settings.frequency, [habitId]: [...periods, { from: today, every }] } });
}

export function addWater(date: DateKey) {
  updateDay(date, (l) => {
    l.water = (l.water ?? 0) + 1;
  });
  pop();
}

export function scrollToAndFlash(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
