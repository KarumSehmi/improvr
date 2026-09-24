import { create } from 'zustand';
import { defaultSettings } from './config';
import { dateKey, type DateKey } from './dates';
import type { AppData, Birthday, CalEvent, DayLog, Payment, Settings } from './types';

export type Collection = 'days' | 'events' | 'birthdays' | 'payments';
export const COLLECTIONS: Collection[] = ['days', 'events', 'birthdays', 'payments'];

/** What the background server last reported (notifications, buddy email, Apple Watch sleep). */
export interface ServerStatus {
  lastRun?: number;
  emailReady?: boolean;
  lastEmail?: number;
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
  return { days: {}, events: {}, birthdays: {}, payments: {}, settings: defaultSettings(dateKey()) };
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
  const { days, events, birthdays, payments, settings } = useApp.getState();
  return { days, events, birthdays, payments, settings };
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

export function updateDay(date: DateKey, fn: (log: DayLog) => void) {
  const prev = useApp.getState().days[date];
  const next: DayLog = prev ? structuredClone(prev) : {};
  fn(next);
  next.updatedAt = Date.now();
  useApp.setState((s) => ({ days: { ...s.days, [date]: next } }));
  backend?.put('days', date, next);
}

/** Put a day back exactly as it was (used by Undo). */
export function setDay(date: DateKey, log: DayLog) {
  useApp.setState((s) => ({ days: { ...s.days, [date]: log } }));
  backend?.put('days', date, log);
}

type Items = { events: CalEvent; birthdays: Birthday; payments: Payment };

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
