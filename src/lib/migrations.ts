/** One-off updates to your data when the app changes, each applied once (and safe on two devices). */
import { setFrequency } from './actions';
import { addDays, dateKey } from './dates';
import { updateDay, updateSettings, upsert, useApp } from './store';

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
  {
    // A to-do for today: book the dentist.
    id: 'dentist-todo',
    run: () => {
      if (useApp.getState().todos.dentist) return;
      upsert('todos', { id: 'dentist', title: 'Book the dentist 🦷', date: dateKey(), doneOn: null, createdAt: Date.now() });
    },
  },
  {
    // The 15 min workout moved from "Through the day" into Training, next to gym and football. Days it was ticked keep their XP.
    id: 'home-workout-to-training',
    run: () => {
      const { days } = useApp.getState();
      for (const [date, log] of Object.entries(days)) {
        if (!(log.done && 'homeWorkout' in log.done) && !(log.missed && 'homeWorkout' in log.missed)) continue;
        updateDay(date, (l) => {
          if (l.done?.homeWorkout && !l.workouts?.includes('home')) l.workouts = [...(l.workouts ?? []), 'home'];
          delete l.done?.homeWorkout;
          delete l.doneAt?.homeWorkout;
          delete l.missed?.homeWorkout;
        });
      }
    },
  },
];

export function runMigrations() {
  const done = new Set(useApp.getState().settings.migrations ?? []);
  const todo = STEPS.filter((s) => !done.has(s.id));
  if (!todo.length) return;
  for (const s of todo) s.run();
  updateSettings({ migrations: [...done, ...todo.map((s) => s.id)] });
}
