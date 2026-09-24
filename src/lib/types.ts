import type { ChoreSchedule, Habit } from './config.js';
import type { DateKey } from './dates.js';

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
  /** Older versions logged a number here; it still counts as "weighed in". */
  weight?: number | null;
  finMl?: number | null;
  workouts?: WorkoutType[];
  note?: string;
  /** 1 (awful) – 5 (great). Optional, used for insights. */
  mood?: number;
  /** Cravings you felt and beat, per stay-clean habit. */
  urges?: Record<string, number>;
  /** Sleep times sent from your Apple Watch via the iPhone Shortcut. */
  sleepAuto?: { asleep: string; awake: string; at: number };
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

/** A one-off job on the calendar. If it isn't done by its day it carries over to today until it is. */
export interface Todo {
  id: string;
  title: string;
  /** The day it's planned for. */
  date: DateKey;
  /** The day you ticked it off (missing = still to do). */
  doneOn?: DateKey | null;
  notes?: string;
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
  workoutTarget: number;
  finTargetMl: number;
  /** Finasteride strength in % w/v (0.025% = 0.25 mg per ml). */
  finConcentration: number;
  /** Anchor dates for every-N-weeks chores, keyed by chore id. */
  anchors?: Record<string, DateKey>;

  /** Habits you added in the app. */
  customHabits?: Habit[];
  /** Built-in or custom habits you switched off. */
  hiddenHabits?: string[];
  /** Changed schedules for built-in chores (e.g. hoover on Sundays instead). */
  scheduleOverrides?: Record<string, ChoreSchedule>;

  /** Link to your charity's donation page. */
  donateUrl?: string;
  /** This week's focus habit, picked in the weekly review. */
  focus?: { week: DateKey; habitId: string } | null;
  /** Monday of the last week you reviewed. */
  reviewedWeek?: DateKey;
  /** Rewards already celebrated (so each one pops once). */
  seenLevel?: number;
  seenAchievements?: string[];
  onboarded?: boolean;
  reminders?: ReminderSettings;

  /** IANA time zone of your phone, so the notification server knows your local time. */
  timeZone?: string;
  /** Web address the app was last opened on, for links in notifications. */
  appUrl?: string;
  /** Smart notifications you've switched off (missing = on). */
  notify?: Record<string, boolean>;
  /** What each stay-clean habit used to cost you per week, in £. */
  costPerWeek?: Record<string, number>;
  /** Weekly allowance for stay-clean habits (e.g. 1 drinking night a week). */
  weeklyLimits?: Record<string, number>;
}

export interface ReminderSettings {
  morning: string;
  caffeine: string;
  lockIn: string;
  bedtime: string;
  weeklyJobs: boolean;
  birthdays: boolean;
}

export interface AppData {
  days: Record<DateKey, DayLog>;
  events: Record<string, CalEvent>;
  birthdays: Record<string, Birthday>;
  payments: Record<string, Payment>;
  todos: Record<string, Todo>;
  settings: Settings;
}
