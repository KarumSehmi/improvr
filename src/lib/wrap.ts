/**
 * Wrap up: go through what's left of a day one thing at a time — habits in the order of your day,
 * then today's to-dos, then how it went, then lock it in.
 */
import type { DateKey } from './dates';
import type { DayEval, ItemEval } from './engine';
import { sectionLater } from './moments';
import { openTodos } from './todos';
import type { Settings, Todo } from './types';

export type WrapStep = { kind: 'habit'; id: string } | { kind: 'todo'; id: string } | { kind: 'reflect' } | { kind: 'lock' };

/** Still waiting for an answer. */
export const unanswered = (i: ItemEval) => i.visible && i.required && !i.done && !i.missed && !i.skipped;

export function wrapQueue(e: DayEval, todos: Record<string, Todo>, today: DateKey, opts: { reflect?: boolean; lock?: boolean } = {}): WrapStep[] {
  const steps: WrapStep[] = e.dayOff ? [] : e.items.filter(unanswered).map((i) => ({ kind: 'habit', id: i.habit.id }));
  if (e.date === today) for (const t of openTodos(todos, today)) steps.push({ kind: 'todo', id: t.id });
  if (opts.reflect !== false) steps.push({ kind: 'reflect' });
  if (opts.lock !== false && !e.closed) steps.push({ kind: 'lock' });
  return steps;
}

/** For Quick log: what's left, split into what's due now and what's for later today. */
export function openNowAndLater(e: DayEval, hour: number, live: boolean, settings: Settings): { now: ItemEval[]; later: ItemEval[]; bonus: ItemEval[] } {
  const left = e.dayOff ? [] : e.items.filter(unanswered);
  const isLater = (i: ItemEval) => live && sectionLater(i.habit.section, hour, settings);
  return {
    now: left.filter((i) => !isLater(i)),
    later: left.filter(isLater),
    bonus: e.items.filter((i) => i.visible && i.habit.optional && !i.done),
  };
}
