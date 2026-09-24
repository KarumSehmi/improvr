/**
 * The built-in habits. You can also hide these, change chore days and add your own
 * from the app (More → Your habits). Points are what make the XP bar move — bigger = more important.
 */
import type { DateKey } from './dates';
import type { ReminderSettings, Settings, WorkoutType } from './types';

export type SectionId = 'morning' | 'day' | 'room' | 'night' | 'clean';

export type HabitKind =
  | 'check' // simple tick
  | 'time' // yes/no with a rough time if you missed it (sleep / wake)
  | 'water' // tap bottles
  | 'dose' // finasteride ml
  | 'avoid' // stayed clean / slipped
  | 'chore'; // recurring, carries over every day until done

/** `every` = rolling every N days after you last did it. `weekday` = fixed day (0 Sun … 6 Sat). */
export type ChoreSchedule = { every: number; offset?: number } | { weekday: number; everyWeeks?: number };

export interface Habit {
  id: string;
  label: string;
  emoji: string;
  section: SectionId;
  kind: HabitKind;
  points: number;
  important?: boolean;
  hint?: string;
  schedule?: ChoreSchedule;
  skippable?: boolean;
  /** For `time` habits: what the "no" prompt asks for. */
  missPrompt?: string;
  /** Added part-way through — days before this don't count. */
  since?: DateKey;
  /** Stay-clean habits only: slips allowed per Mon–Sun week before it counts as a miss. */
  weeklyLimit?: number;
  custom?: boolean;
}

export const SECTIONS: { id: SectionId; title: string; emoji: string; subtitle: string; color: string }[] = [
  { id: 'morning', title: 'Morning', emoji: '🌅', subtitle: 'Weigh in, meds, face', color: 'orange' },
  { id: 'day', title: 'Through the day', emoji: '⚡', subtitle: 'Water & food', color: 'cyan' },
  { id: 'room', title: 'Room & jobs', emoji: '🧹', subtitle: 'Carries over until done', color: 'grape' },
  { id: 'night', title: 'Night', emoji: '🌙', subtitle: 'Skin routine', color: 'indigo' },
  { id: 'clean', title: 'Stayed clean', emoji: '🛡️', subtitle: 'Be honest', color: 'teal' },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<SectionId, (typeof SECTIONS)[number]>;

export const BUILT_IN_HABITS: Habit[] = [
  // Morning
  { id: 'weigh', label: 'Weighed in', emoji: '⚖️', section: 'morning', kind: 'check', points: 10 },
  {
    id: 'sleep',
    label: 'Asleep before 1am',
    emoji: '😴',
    section: 'morning',
    kind: 'time',
    points: 15,
    hint: 'last night',
    missPrompt: 'Roughly when did you fall asleep? (check Apple Watch)',
  },
  {
    id: 'wake',
    label: 'Up before 9am',
    emoji: '☀️',
    section: 'morning',
    kind: 'time',
    points: 20,
    important: true,
    missPrompt: 'Roughly when did you get up?',
  },
  { id: 'pills', label: 'Took all my pills', emoji: '💊', section: 'morning', kind: 'check', points: 10 },
  { id: 'faceAm', label: 'Face wash + moisturiser', emoji: '🧴', section: 'morning', kind: 'check', points: 5, hint: 'AM' },
  { id: 'fin', label: 'Topical finasteride', emoji: '💧', section: 'morning', kind: 'dose', points: 10 },
  { id: 'pillRefill', label: 'Refill pill organiser', emoji: '🗓️', section: 'morning', kind: 'chore', points: 15, schedule: { weekday: 0, everyWeeks: 2 } },

  // Through the day
  { id: 'water', label: '2 bottles of water', emoji: '🚰', section: 'day', kind: 'water', points: 10 },
  { id: 'macro', label: 'Logged on MacroFactor', emoji: '📱', section: 'day', kind: 'check', points: 10 },
  { id: 'protein', label: 'Hit protein', emoji: '🍗', section: 'day', kind: 'check', points: 15 },
  { id: 'budCanvas', label: 'Fill out Bud + check Canvas', emoji: '📚', section: 'day', kind: 'chore', points: 20, schedule: { weekday: 2 } },

  // Room — daily ones carry over, weekly ones are spread across the week
  { id: 'clothes', label: 'Clothes in wardrobe, none on floor', emoji: '👕', section: 'room', kind: 'chore', points: 5, schedule: { every: 1 } },
  { id: 'glasses', label: 'No glasses in room', emoji: '🥛', section: 'room', kind: 'chore', points: 5, schedule: { every: 1 } },
  { id: 'rubbish', label: 'No rubbish lying around', emoji: '🧻', section: 'room', kind: 'chore', points: 5, schedule: { every: 1 } },
  { id: 'bin', label: 'Take out room bin', emoji: '🗑️', section: 'room', kind: 'chore', points: 10, schedule: { every: 3 } },
  { id: 'surfaces', label: 'Wipe surfaces', emoji: '🧽', section: 'room', kind: 'chore', points: 15, schedule: { weekday: 3 } },
  { id: 'bathroom', label: 'Deep clean bathroom', emoji: '🛁', section: 'room', kind: 'chore', points: 25, schedule: { weekday: 4 } },
  { id: 'hoover', label: 'Hoover & mop floor', emoji: '🧹', section: 'room', kind: 'chore', points: 20, schedule: { weekday: 6 } },

  // Night
  { id: 'facePm', label: 'Face wash + moisturiser', emoji: '🫧', section: 'night', kind: 'check', points: 5, hint: 'PM' },
  {
    id: 'paulas',
    label: "Paula's Choice",
    emoji: '🧪',
    section: 'night',
    kind: 'chore',
    points: 10,
    schedule: { every: 3, offset: 1 },
    skippable: true,
    hint: 'skip any time',
  },

  // Stayed clean
  { id: 'vape', label: 'No vaping', emoji: '🚭', section: 'clean', kind: 'avoid', points: 25, important: true },
  { id: 'porn', label: 'No porn', emoji: '🔞', section: 'clean', kind: 'avoid', points: 20 },
  { id: 'alcohol', label: 'No alcohol', emoji: '🍺', section: 'clean', kind: 'avoid', points: 10, weeklyLimit: 1 },
  { id: 'caffeine', label: 'No caffeine after 2pm', emoji: '☕', section: 'clean', kind: 'avoid', points: 10 },
];

export const BUILT_IN_BY_ID = Object.fromEntries(BUILT_IN_HABITS.map((h) => [h.id, h])) as Record<string, Habit>;

const cache = new WeakMap<Settings, Habit[]>();

/** The habits you're actually tracking: built-ins (minus hidden, with your schedule changes) plus your own. */
export function habitsFor(settings: Settings): Habit[] {
  const hit = cache.get(settings);
  if (hit) return hit;
  const hidden = new Set(settings.hiddenHabits ?? []);
  const overrides = settings.scheduleOverrides ?? {};
  const limits = settings.weeklyLimits ?? {};
  const withLimit = (h: Habit) => (h.kind === 'avoid' && limits[h.id] != null ? { ...h, weeklyLimit: limits[h.id] } : h);
  const builtIn = BUILT_IN_HABITS.filter((h) => !hidden.has(h.id)).map((h) => withLimit(overrides[h.id] ? { ...h, schedule: overrides[h.id] } : h));
  const custom = (settings.customHabits ?? []).filter((h) => !hidden.has(h.id)).map((h) => withLimit({ ...h, custom: true }));
  // Keep section order stable: each custom habit goes after the built-ins of its section.
  const order = SECTIONS.map((s) => s.id);
  const all = [...builtIn, ...custom].sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
  cache.set(settings, all);
  return all;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function scheduleLabel(s: ChoreSchedule | undefined): string {
  if (!s) return '';
  if ('every' in s) return s.every === 1 ? 'daily' : `every ${s.every} days`;
  const day = WEEKDAYS[s.weekday];
  return (s.everyWeeks ?? 1) > 1 ? `every other ${day}` : `${day}s`;
}

export const WATER_TARGET = 2;

export const WORKOUTS: { id: WorkoutType; label: string; emoji: string; points: number }[] = [
  { id: 'gym', label: 'Gym', emoji: '🏋️', points: 40 },
  { id: 'home', label: 'Home workout', emoji: '🏠', points: 20 },
  { id: 'football', label: 'Football', emoji: '⚽', points: 30 },
];

export const BONUS = {
  loggedOnTime: 10,
  perfectDay: 25,
  /** Per craving beaten, up to `urgeCap` a day per habit. */
  urge: 5,
  urgeCap: 3,
};

export const MOODS = [
  { value: 1, emoji: '😫', label: 'Awful' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Great' },
];

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000];

export const QUOTE = 'Just try to be better than you were yesterday.';

export const LEVEL_TITLES = [
  'Rookie',
  'Showing Up',
  'Getting There',
  'Consistent',
  'Disciplined',
  'Locked In',
  'On a Mission',
  'Machine',
  'Unstoppable',
  'Built Different',
  'Legend',
  'Mythic',
  'GOAT',
];

export const DEFAULT_REMINDERS: ReminderSettings = {
  morning: '08:30',
  caffeine: '13:45',
  lockIn: '22:30',
  bedtime: '00:15',
  weeklyJobs: true,
  birthdays: true,
};

export function defaultSettings(today: string): Settings {
  return {
    name: '',
    startDate: today,
    fineAmount: 5,
    charity: 'a charity of your choice',
    workoutTarget: 3,
    finTargetMl: 1,
    finConcentration: 0.025,
    anchors: {},
  };
}
