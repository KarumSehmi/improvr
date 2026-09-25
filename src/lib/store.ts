import { create } from 'zustand';
import { defaultSettings, habitsFor } from './config';
import { dateKey, type DateKey } from './dates';
import { isDone } from './engine';
import type { AppData, Birthday, CalEvent, DayLog, Payment, Settings, SpendEntry, Todo } from './types';

export type Collection = 'days' | 'events' | 'birthdays' | 'payments' | 'todos' | 'spending';
export const COLLECTIONS: Collection[] = ['days', 'events', 'birthdays', 'payments', 'todos', 'spending'];

/** What the background server last reported (notifications, Apple Watch sleep). */
export interface ServerStatus {
  lastRun?: number;
  /** Last run from the cron-job.org timer (GitHub's backup timer only sets lastRun). */
  lastCron?: number;
  lastSleep?: { date: string; asleep: string; awake: string; at: number };
}

export interface AppState extends AppData {
  status: 'loading' | 'signedOut' | 'ready';
  mode: 'local' | 'cloud';
  email: string | null;
  uid: string | null;
  syncError: string | null;
  server: ServerStatus | null;
  /** Devices signed up for notifications. */
  pushDevices: number;
}

/** Where writes go. Local mode saves to localStorage, cloud mode to Firestore. */
export interface Backend {
  put(col: Collection, id: string, value: object): void;
  remove(col: Collection, id: string): void;
  putSettings(settings: Settings): void;
}

export function emptyData(): AppData {
  return { days: {}, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings: defaultSettings(dateKey()) };
}

export const useApp = create<AppState>()(() => ({
  ...emptyData(),
  status: 'loading',
  mode: 'local',
  email: null,
  uid: null,
  syncError: null,
  server: null,
  pushDevices: 0,
}));

let backend: Backend | null = null;
export function setBackend(b: Backend | null) {
  backend = b;
}

export function getData(): AppData {
  const { days, events, birthdays, payments, todos, spending, settings } = useApp.getState();
  return { days, events, birthdays, payments, todos, spending, settings };
}

// ---------------------------------------------------------------------------
// Local mode
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'improvr-data-v1';

export function startLocal() {
  let saved: Partial<AppData> | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  const base = emptyData();
  useApp.setState({
    ...base,
    ...saved,
    settings: { ...base.settings, ...saved?.settings },
    mode: 'local',
    status: 'ready',
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => localStorage.setItem(LOCAL_KEY, JSON.stringify(getData()));
  useApp.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(persist, 150);
  });
  window.addEventListener('pagehide', persist);
}

// ---------------------------------------------------------------------------
// Writes (optimistic: update the UI now, then save)
// ---------------------------------------------------------------------------

/** Remember when each habit got ticked (and forget it if it's unticked), so today can race yesterday. */
function stampTicks(prev: DayLog | undefined, next: DayLog, at: number) {
  const times = { ...next.doneAt };
  for (const h of habitsFor(useApp.getState().settings)) {
    const was = isDone(h, prev);
    const is = isDone(h, next);
    if (is && !was) times[h.id] = at;
    else if (!is && was) delete times[h.id];
  }
  next.doneAt = times;
}

export function updateDay(date: DateKey, fn: (log: DayLog) => void) {
  const prev = useApp.getState().days[date];
  const next: DayLog = prev ? structuredClone(prev) : {};
  fn(next);
  next.updatedAt = Date.now();
  stampTicks(prev, next, next.updatedAt);
  useApp.setState((s) => ({ days: { ...s.days, [date]: next } }));
  backend?.put('days', date, next);
}

/** Put a day back exactly as it was (used by Undo). */
export function setDay(date: DateKey, log: DayLog) {
  useApp.setState((s) => ({ days: { ...s.days, [date]: log } }));
  backend?.put('days', date, log);
}

type Items = { events: CalEvent; birthdays: Birthday; payments: Payment; todos: Todo; spending: SpendEntry };

export function upsert<C extends keyof Items>(col: C, item: Items[C]) {
  useApp.setState((s) => ({ [col]: { ...s[col], [item.id]: item } }) as Partial<AppState>);
  backend?.put(col, item.id, item);
}

export function removeItem(col: keyof Items, id: string) {
  useApp.setState((s) => {
    const next = { ...s[col] };
    delete next[id];
    return { [col]: next } as Partial<AppState>;
  });
  backend?.remove(col, id);
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...useApp.getState().settings, ...patch };
  useApp.setState({ settings });
  backend?.putSettings(settings);
}

/** Merge a backup into the current data (existing entries with the same id are replaced). */
export function importData(data: Partial<AppData>) {
  for (const col of COLLECTIONS) {
    const items = (data[col] ?? {}) as Record<string, object>;
    for (const [id, value] of Object.entries(items)) backend?.put(col, id, value);
    useApp.setState((s) => ({ [col]: { ...s[col], ...items } }) as Partial<AppState>);
  }
  if (data.settings) updateSettings(data.settings);
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
