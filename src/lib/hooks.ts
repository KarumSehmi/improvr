import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { addDays, dateKey, type DateKey } from './dates';
import { summarize, type Summary } from './engine';
import { useApp } from './store';
import type { AppData, Todo } from './types';

// ---------------------------------------------------------------------------
// A clock that ticks every 30s (and when the app comes back to the foreground)
// ---------------------------------------------------------------------------

let now = Date.now();
const listeners = new Set<() => void>();
const tick = () => {
  now = Date.now();
  listeners.forEach((l) => l());
};
setInterval(tick, 30_000);
document.addEventListener('visibilitychange', tick);
window.addEventListener('focus', tick);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now);
}

export function useToday(): DateKey {
  return useSyncExternalStore(subscribe, () => dateKey(new Date(now)));
}

// ---------------------------------------------------------------------------
// Summary of everything, recomputed only when data or the date changes
// ---------------------------------------------------------------------------

let cache: { key: unknown[]; value: Summary } | null = null;

/** Shared memo so every component using the summary reuses one computation. */
function memoSummary(today: DateKey, days: AppData['days'], payments: AppData['payments'], spending: AppData['spending'], settings: AppData['settings']): Summary {
  const key = [today, days, payments, spending, settings];
  if (!cache || cache.key.some((k, i) => k !== key[i])) {
    cache = { key, value: summarize({ days, payments, spending, settings, events: {}, birthdays: {}, todos: {} }, today) };
  }
  return cache.value;
}

/** The day to log right now: today, or yesterday when it's past midnight and yesterday isn't locked in yet. */
export function logDate(now: number, summary: Summary): DateKey {
  const yesterday = addDays(summary.today, -1);
  return new Date(now).getHours() < 4 && summary.openUnlogged.includes(yesterday) ? yesterday : summary.today;
}

export function useSummary(): Summary {
  const today = useToday();
  const days = useApp((s) => s.days);
  const payments = useApp((s) => s.payments);
  const spending = useApp((s) => s.spending);
  const settings = useApp((s) => s.settings);
  return memoSummary(today, days, payments, spending, settings);
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export type Page = 'today' | 'plan' | 'progress' | 'settings';

/** Remember small per-device choices (e.g. "hide done"). Never anything that matters. */
function remembered<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`improvr-ui-${key}`);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function remember(key: string, value: unknown) {
  try {
    localStorage.setItem(`improvr-ui-${key}`, JSON.stringify(value));
  } catch {
    // private mode: fine, it just won't be remembered
  }
}

interface UiState {
  page: Page;
  /** Day shown on the Today page (null = today). */
  viewDate: DateKey | null;
  /** Weekly review opened by hand (it also opens itself once a week). */
  reviewOpen: boolean;
  /** Day whose reward chest is being opened. */
  chestDate: DateKey | null;
  /** Section to unfold (e.g. tapped in the hero while it's folded away as "later"). */
  openSection: string | null;
  /** Craving SOS: open since `start`, for this stay-clean habit (null = the first one). */
  sos: { habit: string | null; start: number } | null;
  /** Settings page: the section open in a sheet. */
  settingsSheet: string | null;
  /** The quick log sheet (the + button). */
  logOpen: boolean;
  /** The chat assistant. */
  chatOpen: boolean;
  /** Wrap up: going through what's left of this day, one at a time. */
  wrapDate: DateKey | null;
  /** A habit's sheet: details, today's options and editing. `date` = the day it was opened from. */
  habitSheet: { id: string; date: DateKey | null } | null;
  /** Adding a new habit (Settings → Habits → Add). */
  addHabit: boolean;
  /** The to-do editor: an existing one by id, or a new one starting from whatever was typed. */
  todoEdit: ({ id?: string } & Partial<Pick<Todo, 'title' | 'date' | 'time' | 'repeat' | 'important' | 'list'>>) | null;
  /** Update card spending. */
  cardOpen: boolean;
  /** Progress page tab. */
  progressTab: string;
  /** Plan page tab. */
  planTab: string;
  /** Hide ticked-off things on Today (this device only). */
  hideDone: boolean;
}

export const useUi = create<UiState>()(() => ({
  page: 'today',
  viewDate: null,
  reviewOpen: false,
  chestDate: null,
  openSection: null,
  sos: null,
  settingsSheet: null,
  logOpen: false,
  chatOpen: false,
  wrapDate: null,
  habitSheet: null,
  addHabit: false,
  todoEdit: null,
  cardOpen: false,
  progressTab: 'overview',
  planTab: 'tasks',
  hideDone: remembered('hideDone', false),
}));

export function openDay(date: DateKey | null) {
  useUi.setState({ page: 'today', viewDate: date });
  window.scrollTo({ top: 0 });
}

/** Open the craving SOS (10-minute timer). */
export function openSos(habit: string | null = null) {
  useUi.setState({ sos: { habit, start: Date.now() }, logOpen: false });
}

/** Open the chat assistant (from anywhere; the + sheet closes). */
export function openChat() {
  useUi.setState({ chatOpen: true, logOpen: false });
}

export function goTo(page: Page, extra: Partial<UiState> = {}) {
  useUi.setState({ page, settingsSheet: null, ...extra });
  window.scrollTo({ top: 0 });
}

export function openHabit(id: string, date: DateKey | null = null) {
  useUi.setState({ habitSheet: { id, date } });
}

export function editTodo(id: string) {
  useUi.setState({ todoEdit: { id } });
}

export function setHideDone(hideDone: boolean) {
  remember('hideDone', hideDone);
  useUi.setState({ hideDone });
}
