/**
 * Every change you can make from a tap: ticking habits off (one or many), answering the honest
 * questions, to-dos, and editing your habits. Today, Quick log, Wrap up and the habit sheet all
 * go through here so they behave the same.
 */
import { notifications } from '@mantine/notifications';
import { floatXp, notifyUndo } from './feedback';
import { burst, fireworks, pop } from './celebrate';
import { BONUS, CHECKINS, WATER_TARGET, WORKOUTS, allHabits, type CheckinId, type ChoreSchedule, type Habit, type HabitEdit } from './config';
import { sound } from './sound';
import type { DayLog, Settings, Todo, WorkoutType } from './types';
import type { DateKey } from './dates';
import { addDays, dateKey } from './dates';
import { everyOn } from './engine';
import { newId, removeItem, setDay, updateDay, updateSettings, upsert, useApp } from './store';

type At = { clientX: number; clientY: number } | undefined;

// ---------------------------------------------------------------------------
// One habit
// ---------------------------------------------------------------------------

/** How many make a water / count habit done. */
export const targetOf = (h: Habit) => Math.max(1, h.target ?? (h.kind === 'water' ? WATER_TARGET : 1));

/** Change a day's log so the habit is done (or not). Mutates `l`. */
export function applyDone(l: DayLog, h: Habit, done: boolean, settings: Settings) {
  const id = h.id;
  if (l.missed?.[id]) delete l.missed[id];
  switch (h.kind) {
    case 'avoid': {
      const avoid = { ...l.avoid };
      if (done) avoid[id] = 'clean';
      else delete avoid[id];
      l.avoid = avoid;
      return;
    }
    case 'dose':
      l.finMl = done ? (l.finMl || settings.finTargetMl) : null;
      return;
    case 'water':
      l.water = done ? Math.max(l.water ?? 0, targetOf(h)) : 0;
      return;
    case 'count':
      l.counts = { ...l.counts, [id]: done ? Math.max(l.counts?.[id] ?? 0, targetOf(h)) : 0 };
      return;
    case 'time':
      // Sleep / wake: "yes", or back to unanswered.
      l.done = { ...l.done, [id]: done ? true : undefined } as Record<string, boolean>;
      if (l.times) delete l.times[id];
      return;
    default:
      l.done = { ...l.done, [id]: done };
      if (l.skipped) delete l.skipped[id];
  }
}

/** Tick a habit off for a day (or untick it). */
export function setDone(date: DateKey, h: Habit, done: boolean, e?: At) {
  const { settings } = useApp.getState();
  updateDay(date, (l) => applyDone(l, h, done, settings));
  if (done) {
    pop(e);
    floatXp(e, `+${h.points}`);
  }
}

/** Water and count habits: one more (or one fewer). Returns the new amount. */
export function bump(date: DateKey, h: Habit, delta: number, e?: At): number {
  const log = useApp.getState().days[date];
  const before = h.kind === 'water' ? (log?.water ?? 0) : (log?.counts?.[h.id] ?? 0);
  const next = Math.max(0, before + delta);
  updateDay(date, (l) => {
    if (h.kind === 'water') l.water = next;
    else l.counts = { ...l.counts, [h.id]: next };
    if (l.missed) delete l.missed[h.id];
  });
  if (delta > 0) {
    pop(e);
    if (before < targetOf(h) && next >= targetOf(h)) floatXp(e, `+${h.points}`);
  }
  return next;
}

/** Stay-clean answer: clean, slipped, or back to unanswered. */
export function answerClean(date: DateKey, h: Habit, value: 'clean' | 'slip' | null, e?: At) {
  updateDay(date, (l) => {
    const avoid = { ...l.avoid };
    if (value) avoid[h.id] = value;
    else delete avoid[h.id];
    l.avoid = avoid;
  });
  if (value === 'clean') {
    pop(e);
    floatXp(e, `+${h.points}`);
  }
}

/** Sleep / wake: yes, an honest no (pre-filled with the Watch's time if there is one), or unanswered. */
export function answerTime(date: DateKey, h: Habit, value: boolean | null, e?: At) {
  updateDay(date, (l) => {
    l.done = { ...l.done, [h.id]: value ?? undefined } as Record<string, boolean>;
    if (value !== false) {
      if (l.times) delete l.times[h.id];
    } else if (l.sleepAuto && !l.times?.[h.id]) {
      l.times = { ...l.times, [h.id]: h.id === 'sleep' ? l.sleepAuto.asleep : l.sleepAuto.awake };
    }
  });
  if (value) {
    pop(e);
    floatXp(e, `+${h.points}`);
  }
}

/** Skip a skippable job today (its cycle restarts), or undo the skip. */
export function setSkipped(date: DateKey, h: Habit, skipped: boolean) {
  updateDay(date, (l) => {
    l.skipped = { ...l.skipped, [h.id]: skipped };
    if (!skipped) delete l.skipped[h.id];
    if (skipped && l.done?.[h.id]) l.done = { ...l.done, [h.id]: false };
  });
}

/** "Didn't do it" — an honest no, so its section can close (doing it later still counts). */
export function setMissed(date: DateKey, h: Habit, missed: boolean) {
  updateDay(date, (l) => {
    if (h.kind === 'time') {
      l.done = { ...l.done, [h.id]: missed ? false : undefined } as Record<string, boolean>;
      return;
    }
    if (h.kind === 'avoid') {
      const avoid = { ...l.avoid };
      if (missed) avoid[h.id] = 'slip';
      else delete avoid[h.id];
      l.avoid = avoid;
      return;
    }
    l.missed = { ...l.missed, [h.id]: missed };
    if (!missed) delete l.missed[h.id];
  });
}

// ---------------------------------------------------------------------------
// Many at once
// ---------------------------------------------------------------------------

export function tickAll(date: DateKey, habits: Habit[], e?: At) {
  if (!habits.length) return;
  const { days, settings } = useApp.getState();
  const before = structuredClone(days[date] ?? {});
  updateDay(date, (l) => {
    for (const h of habits) applyDone(l, h, true, settings);
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

export function addWater(date: DateKey) {
  updateDay(date, (l) => {
    l.water = (l.water ?? 0) + 1;
  });
  pop();
}

/** Log a session (e.g. Monday football) straight from "Up next". */
export function logWorkout(date: DateKey, id: WorkoutType, e?: At) {
  const w = WORKOUTS.find((x) => x.id === id);
  if (!w || useApp.getState().days[date]?.workouts?.includes(id)) return;
  updateDay(date, (l) => {
    l.workouts = [...(l.workouts ?? []), id];
  });
  pop(e);
  floatXp(e, `+${w.points}`);
}

/** Add or remove a session. */
export function toggleWorkout(date: DateKey, id: WorkoutType, e?: At) {
  const has = useApp.getState().days[date]?.workouts?.includes(id);
  if (!has) return logWorkout(date, id, e);
  updateDay(date, (l) => {
    l.workouts = (l.workouts ?? []).filter((w) => w !== id);
  });
}

// ---------------------------------------------------------------------------
// Check-ins and the bonus quest
// ---------------------------------------------------------------------------

/** Log a check-in for the window that's open right now, with how your energy is. */
export function checkIn(date: DateKey, id: CheckinId, energy: number, e?: At) {
  updateDay(date, (l) => {
    l.checkins = { ...l.checkins, [id]: { at: Date.now(), energy } };
  });
  pop(e);
  const all = Object.keys(useApp.getState().days[date]?.checkins ?? {}).length >= CHECKINS.length;
  floatXp(e, `+${BONUS.checkin + (all ? BONUS.allCheckins : 0)}`);
  if (all) {
    fireworks();
    notifications.show({ color: 'yellow', title: '🎯 Hat-trick!', message: `Checked in morning, afternoon and evening: +${BONUS.allCheckins} bonus XP.` });
  } else sound.chime();
}

/** Tick today's bonus quest off (or back on). */
export function toggleQuest(date: DateKey, done: boolean, e?: At) {
  if (!done) {
    burst();
    floatXp(e, `+${BONUS.quest}`);
  }
  updateDay(date, (l) => {
    l.quest = { ...l.quest, done: !done };
  });
}

// ---------------------------------------------------------------------------
// To-dos
// ---------------------------------------------------------------------------

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
    upsert('todos', {
      id: next,
      title: todo.title,
      notes: todo.notes,
      repeat: todo.repeat,
      list: todo.list ?? null,
      time: todo.time ?? null,
      important: todo.important,
      date: addDays(today, todo.repeat),
      doneOn: null,
      createdAt: Date.now(),
    });
  }
  upsert('todos', { ...todo, doneOn: today, next });
  return true;
}

/** Add a to-do (today unless you say otherwise). */
export function addTodo(t: Partial<Todo> & { title: string }, today: DateKey): Todo {
  const todo: Todo = {
    id: newId(),
    title: t.title.trim(),
    date: t.date === undefined ? today : t.date,
    time: t.time ?? null,
    list: t.list ?? null,
    important: t.important || undefined,
    repeat: t.date === null ? null : (t.repeat ?? null),
    notes: t.notes,
    doneOn: null,
    createdAt: Date.now(),
  };
  upsert('todos', todo);
  return todo;
}

/** Move a to-do to another day (or someday), with Undo. */
export function moveTodo(todo: Todo, date: DateKey | null, label?: string) {
  upsert('todos', { ...todo, date, repeat: date ? todo.repeat : null });
  notifyUndo(`Moved to ${label ?? (date ?? 'someday')}`, () => upsert('todos', todo));
}

export function deleteTodo(todo: Todo) {
  removeItem('todos', todo.id);
  notifyUndo('To-do deleted', () => upsert('todos', todo));
}

// ---------------------------------------------------------------------------
// Your habits
// ---------------------------------------------------------------------------

/** How often a habit is due from today on (earlier days keep the old rule). 1 = every day. */
export function setFrequency(habitId: string, every: number) {
  const { settings } = useApp.getState();
  const today = dateKey();
  if (every < 1 || everyOn(settings, habitId, today) === every) return;
  const periods = (settings.frequency?.[habitId] ?? []).filter((p) => p.from < today);
  updateSettings({ frequency: { ...settings.frequency, [habitId]: [...periods, { from: today, every }] } });
}

const isCustom = (settings: Settings, id: string) => (settings.customHabits ?? []).some((h) => h.id === id);

/** Change a habit's name, emoji, section, XP, targets… (built-in or your own). */
export function editHabit(id: string, patch: HabitEdit) {
  const { settings } = useApp.getState();
  if (isCustom(settings, id)) {
    updateSettings({ customHabits: (settings.customHabits ?? []).map((h) => (h.id === id ? { ...h, ...patch } : h)) });
    return;
  }
  const edits = { ...settings.habitEdits };
  const next: HabitEdit = { ...edits[id], ...patch };
  for (const k of Object.keys(next) as (keyof HabitEdit)[]) if (next[k] === undefined) delete next[k];
  if (Object.keys(next).length) edits[id] = next;
  else delete edits[id];
  updateSettings({ habitEdits: edits });
}

/** Put a built-in habit back how it came (name, emoji, section, XP, schedule, allowance). */
export function resetHabit(id: string) {
  const { settings } = useApp.getState();
  const strip = <T extends object | undefined>(o: T) => {
    if (!o) return o;
    const next = { ...o } as Record<string, unknown>;
    delete next[id];
    return next as T;
  };
  updateSettings({ habitEdits: strip(settings.habitEdits), scheduleOverrides: strip(settings.scheduleOverrides), weeklyLimits: strip(settings.weeklyLimits) });
}

export function setSchedule(id: string, schedule: ChoreSchedule) {
  const { settings } = useApp.getState();
  if (isCustom(settings, id)) updateSettings({ customHabits: (settings.customHabits ?? []).map((h) => (h.id === id ? { ...h, schedule } : h)) });
  else updateSettings({ scheduleOverrides: { ...settings.scheduleOverrides, [id]: schedule } });
}

/** Track it or switch it off (it keeps its history either way). */
export function setHabitOn(id: string, on: boolean) {
  const hidden = new Set(useApp.getState().settings.hiddenHabits ?? []);
  if (on) hidden.delete(id);
  else hidden.add(id);
  updateSettings({ hiddenHabits: [...hidden] });
}

/** Move a habit up or down inside its section. */
export function moveHabit(id: string, dir: -1 | 1) {
  const { settings } = useApp.getState();
  const all = allHabits(settings);
  const h = all.find((x) => x.id === id);
  if (!h) return;
  const section = all.filter((x) => x.section === h.section);
  const i = section.indexOf(h);
  const j = i + dir;
  if (j < 0 || j >= section.length) return;
  [section[i], section[j]] = [section[j], section[i]];
  // Store a full order so every habit keeps its place.
  const order = all.map((x) => x.id);
  const sectionIds = new Set(section.map((x) => x.id));
  const rest = order.filter((x) => !sectionIds.has(x));
  updateSettings({ habitOrder: [...rest, ...section.map((x) => x.id)] });
}

export function addHabit(habit: Omit<Habit, 'id' | 'since'>): Habit {
  const { settings } = useApp.getState();
  const h: Habit = { ...habit, id: `c_${newId()}`, since: dateKey() };
  delete h.custom;
  updateSettings({ customHabits: [...(settings.customHabits ?? []), h] });
  return h;
}

export function deleteHabit(id: string) {
  const { settings } = useApp.getState();
  updateSettings({ customHabits: (settings.customHabits ?? []).filter((c) => c.id !== id) });
}

// ---------------------------------------------------------------------------

export function scrollToAndFlash(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
