import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { dateKey, type DateKey } from './dates';
import { summarize, type Summary } from './engine';
import { useApp } from './store';
import type { AppData } from './types';

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
function memoSummary(today: DateKey, days: AppData['days'], payments: AppData['payments'], settings: AppData['settings']): Summary {
  const key = [today, days, payments, settings];
  if (!cache || cache.key.some((k, i) => k !== key[i])) {
    cache = { key, value: summarize({ days, payments, settings, events: {}, birthdays: {}, todos: {} }, today) };
  }
  return cache.value;
}

export function useSummary(): Summary {
  const today = useToday();
  const days = useApp((s) => s.days);
  const payments = useApp((s) => s.payments);
  const settings = useApp((s) => s.settings);
  return memoSummary(today, days, payments, settings);
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export type Page = 'today' | 'calendar' | 'progress' | 'more';

interface UiState {
  page: Page;
  /** Day shown on the Today page (null = today). */
  viewDate: DateKey | null;
  /** Weekly review opened by hand (it also opens itself once a week). */
  reviewOpen: boolean;
}

export const useUi = create<UiState>()(() => ({ page: 'today', viewDate: null, reviewOpen: false }));

export function openDay(date: DateKey | null) {
  useUi.setState({ page: 'today', viewDate: date });
  window.scrollTo({ top: 0 });
}

export function goTo(page: Page) {
  useUi.setState({ page });
  window.scrollTo({ top: 0 });
}
