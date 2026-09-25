/** One-off updates to your data when the app changes, each applied once (and safe on two devices). */
import { setFrequency } from './actions';
import { addDays, dateKey } from './dates';
import { updateSettings, upsert, useApp } from './store';

const STEPS: { id: string; run: () => void }[] = [
  {
    // The haircut moved from "Room & jobs" to a to-do that repeats every 2 weeks.
    id: 'haircut-todo',
    run: () => {
      const { days, todos } = useApp.getState();
      if (todos.haircut) return;
      const last = Object.keys(days)
        .filter((d) => days[d].done?.haircut)
        .sort()
        .at(-1);
      upsert('todos', { id: 'haircut', title: 'Haircut 💈', date: last ? addDays(last, 14) : dateKey(), repeat: 14, doneOn: null, createdAt: Date.now() });
    },
  },
  {
    // Finasteride every 3 days (change it in More → Settings).
    id: 'fin-every-3',
    run: () => setFrequency('fin', 3),
  },
];

export function runMigrations() {
  const done = new Set(useApp.getState().settings.migrations ?? []);
  const todo = STEPS.filter((s) => !done.has(s.id));
  if (!todo.length) return;
  for (const s of todo) s.run();
  updateSettings({ migrations: [...done, ...todo.map((s) => s.id)] });
}
