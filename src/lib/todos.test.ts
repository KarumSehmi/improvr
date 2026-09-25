import { describe, expect, it } from 'vitest';
import { defaultSettings } from './config';
import { summarize } from './engine';
import { dueNudges } from './nudges';
import { carriedDays, openTodos, todoDay, todosOn, upcomingTodos } from './todos';
import type { Todo } from './types';

const TODAY = '2026-09-24';
const todo = (id: string, date: string, extra: Partial<Todo> = {}): Todo => ({ id, title: id, date, createdAt: 0, ...extra });
const list = (...ts: Todo[]) => Object.fromEntries(ts.map((t) => [t.id, t]));

describe('to-dos', () => {
  it('an unfinished to-do carries over to today until it is done', () => {
    const late = todo('late', '2026-09-21');
    expect(todoDay(late, TODAY)).toBe(TODAY);
    expect(carriedDays(late, TODAY)).toBe(3);
    expect(todosOn(list(late), '2026-09-21', TODAY)).toEqual([]);
    expect(todosOn(list(late), TODAY, TODAY).map((t) => t.id)).toEqual(['late']);

    const done = { ...late, doneOn: '2026-09-23' };
    expect(todoDay(done, TODAY)).toBe('2026-09-23'); // shows on the day you did it
    expect(carriedDays(done, TODAY)).toBe(0);
    expect(openTodos(list(done), TODAY)).toEqual([]);
  });

  it('lists what is due now (oldest first, done last) and what is planned', () => {
    const todos = list(
      todo('today', TODAY, { createdAt: 2 }),
      todo('old', '2026-09-20'),
      todo('ticked', TODAY, { doneOn: TODAY }),
      todo('fri', '2026-09-25'),
      todo('far', '2026-12-01'),
    );
    expect(todosOn(todos, TODAY, TODAY).map((t) => t.id)).toEqual(['old', 'today', 'ticked']);
    expect(openTodos(todos, TODAY).map((t) => t.id)).toEqual(['old', 'today']);
    expect(upcomingTodos(todos, TODAY).map((t) => t.id)).toEqual(['fri']);
  });

  it('sends one midday reminder when to-dos are still open', () => {
    const summary = summarize({ days: {}, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: defaultSettings('2026-09-21') }, TODAY);
    const todos = list(todo('Book dentist', '2026-09-22'), todo('Send form', TODAY), todo('Later', '2026-09-30'));
    const at = (minutes: number, sent: Record<string, string> = {}) => dueNudges({ summary, date: TODAY, minutes, sent, todos }).find((n) => n.id === 'todos');

    expect(at(11 * 60)).toBeUndefined();
    expect(at(12 * 60 + 5)).toMatchObject({ title: '📝 2 to-dos still open', body: 'Book dentist, Send form (1 carried over).' });
    expect(at(12 * 60 + 5, { todos: TODAY })).toBeUndefined();
    expect(dueNudges({ summary, date: TODAY, minutes: 12 * 60 + 5, sent: {}, todos: {} }).some((n) => n.id === 'todos')).toBe(false);
  });
});
