import type { DateKey } from './dates';

export type AvoidAnswer = 'clean' | 'slip';
export type WorkoutType = 'gym' | 'home' | 'football';

/** Everything logged for one day. Every field is optional so partial days are valid. */
export interface DayLog {
  /** Ticks for check habits and chores. `false` = explicitly "no" (used by sleep/wake). */
  done?: Record<string, boolean>;
  /** Skippable chores skipped on this day (e.g. Paula's Choice). */
  skipped?: Record<string, boolean>;
  avoid?: Record<string, AvoidAnswer>;
  /** Rough time (HH:mm) for sleep / wake when the target was missed. */
  times?: Record<string, string>;
  water?: number;
  weight?: number | null;
  finMl?: number | null;
  workouts?: WorkoutType[];
  note?: string;
  /** When the day was locked in. Must be before the deadline to avoid a fine. */
  closedAt?: number | null;
  dayOff?: boolean;
  updatedAt?: number;
}

export interface CalEvent {
  id: string;
  title: string;
  date: DateKey;
  time?: string;
  notes?: string;
  color?: string;
  createdAt: number;
}

export interface Birthday {
  id: string;
  name: string;
  month: number; // 1-12
  day: number;
  year?: number | null;
}

export interface Payment {
  id: string;
  amount: number;
  paidAt: number;
  note?: string;
}

export interface Settings {
  name: string;
  startDate: DateKey;
  fineAmount: number;
  charity: string;
  weightUnit: 'kg' | 'lb';
  workoutTarget: number;
  finTargetMl: number;
  /** Finasteride strength in % w/v (0.025% = 0.25 mg per ml). */
  finConcentration: number;
  /** Anchor dates for every-N-weeks chores, keyed by chore id. */
  anchors?: Record<string, DateKey>;
}

export interface AppData {
  days: Record<DateKey, DayLog>;
  events: Record<string, CalEvent>;
  birthdays: Record<string, Birthday>;
  payments: Record<string, Payment>;
  settings: Settings;
}
