/**
 * The built-in habits. You can also hide these, change chore days and add your own
 * from the app (More → Your habits). Points are what make the XP bar move — bigger = more important.
 */
import type { DateKey } from './dates.js';
import type { ReminderSettings, Settings, WorkoutType } from './types.js';

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

/** `from` = the hour a section becomes relevant (before that it's folded away as "later" on Today). */
export const SECTIONS: { id: SectionId; title: string; emoji: string; subtitle: string; color: string; from: number }[] = [
  { id: 'morning', title: 'Morning', emoji: '🌅', subtitle: 'Weigh in, meds, teeth, face', color: 'orange', from: 4 },
  { id: 'day', title: 'Through the day', emoji: '⚡', subtitle: 'Water & food', color: 'cyan', from: 10 },
  { id: 'room', title: 'Room', emoji: '🧹', subtitle: 'Carries over until done', color: 'grape', from: 12 },
  { id: 'night', title: 'Night', emoji: '🌙', subtitle: 'Teeth, skin & finasteride', color: 'indigo', from: 20 },
  { id: 'clean', title: 'Stayed clean', emoji: '🛡️', subtitle: 'Be honest', color: 'teal', from: 20 },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<SectionId, (typeof SECTIONS)[number]>;

/** Teeth were added part-way through, so earlier days don't count them. */
const ADDED_TEETH = '2026-09-24';

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
  { id: 'teethAm', label: 'Brushed teeth', emoji: '🪥', section: 'morning', kind: 'check', points: 5, hint: 'AM', since: ADDED_TEETH },
  { id: 'faceAm', label: 'Face wash + moisturiser', emoji: '🧴', section: 'morning', kind: 'check', points: 5, hint: 'AM' },
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
  { id: 'teethPm', label: 'Brushed teeth', emoji: '🪥', section: 'night', kind: 'check', points: 5, hint: 'PM', since: ADDED_TEETH },
  { id: 'facePm', label: 'Face wash + moisturiser', emoji: '🫧', section: 'night', kind: 'check', points: 5, hint: 'PM' },
  { id: 'fin', label: 'Topical finasteride', emoji: '💧', section: 'night', kind: 'dose', points: 10 },
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
  { id: 'vape', label: 'No nicotine', emoji: '🚭', section: 'clean', kind: 'avoid', points: 25, important: true },
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
  if ('every' in s) {
    if (s.every === 1) return 'daily';
    if (s.every === 7) return 'weekly';
    return s.every % 7 === 0 ? `every ${s.every / 7} weeks` : `every ${s.every} days`;
  }
  const day = WEEKDAYS[s.weekday];
  return (s.everyWeeks ?? 1) > 1 ? `every other ${day}` : `${day}s`;
}

/** Choices for "how often" on daily habits. */
export const FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 7].map((n) => ({ value: String(n), label: n === 1 ? 'Every day' : n === 7 ? 'Weekly' : `Every ${n} days` }));

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
  /** Each check-in (morning, afternoon, evening), plus a bonus for all three. */
  checkin: 5,
  allCheckins: 15,
  quest: 15,
};

// ---------------------------------------------------------------------------
// Check-ins: three quick taps a day. `to` can pass 24 (evening runs until 4am).
// ---------------------------------------------------------------------------

export type CheckinId = 'am' | 'pm' | 'eve';

export const CHECKINS: { id: CheckinId; label: string; emoji: string; from: number; to: number }[] = [
  { id: 'am', label: 'Morning', emoji: '🌅', from: 4, to: 12 },
  { id: 'pm', label: 'Afternoon', emoji: '☀️', from: 12, to: 18 },
  { id: 'eve', label: 'Evening', emoji: '🌙', from: 18, to: 28 },
];

export const ENERGY = [
  { value: 1, emoji: '🪫', label: 'Drained' },
  { value: 2, emoji: '😴', label: 'Tired' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '⚡', label: 'Buzzing' },
];

// ---------------------------------------------------------------------------
// Bonus quests: one small optional challenge a day, for extra XP.
// ---------------------------------------------------------------------------

export interface Quest {
  id: string;
  emoji: string;
  title: string;
  detail: string;
}

export const QUESTS: Quest[] = [
  { id: 'walk', emoji: '🚶', title: 'Go for a 20-minute walk', detail: 'Music or a podcast is fine — no scrolling.' },
  { id: 'read', emoji: '📖', title: 'Read 10 pages', detail: 'Any book. Paper beats a screen.' },
  { id: 'stretch', emoji: '🧘', title: '5 minutes of stretching', detail: 'Hips, hamstrings, shoulders.' },
  { id: 'friend', emoji: '💬', title: "Message a friend you haven't spoken to in a while", detail: 'Just a "how are you".' },
  { id: 'veg', emoji: '🥦', title: 'Eat veg with two meals', detail: 'Frozen counts.' },
  { id: 'cold', emoji: '🧊', title: 'Finish your shower cold', detail: '30 seconds. You can do anything for 30 seconds.' },
  { id: 'focus', emoji: '🎧', title: 'One 45-minute focus block', detail: 'Phone in another room.' },
  { id: 'sun', emoji: '🌞', title: 'Get 15 minutes of daylight', detail: 'Outside, not through a window.' },
  { id: 'tidy', emoji: '🧺', title: '10-minute speed tidy', detail: 'Set a timer and go.' },
  { id: 'grateful', emoji: '🙏', title: "Write 3 things you're grateful for", detail: "Put them in tonight's note." },
  { id: 'family', emoji: '📞', title: 'Call your family', detail: 'Five minutes is enough.' },
  { id: 'nofizzy', emoji: '🥤', title: 'No fizzy drinks today', detail: 'Water or tea instead.' },
  { id: 'cook', emoji: '🍳', title: 'Cook a meal instead of ordering', detail: 'Something simple counts.' },
  { id: 'learn', emoji: '🧠', title: 'Learn something for 15 minutes', detail: 'A video, an article, a skill.' },
  { id: 'pushups', emoji: '💪', title: '50 push-ups through the day', detail: 'Split them up however you like.' },
  { id: 'plan', emoji: '🗒️', title: "Plan tomorrow's top 3 tonight", detail: 'Write them in your note.' },
  { id: 'screens', emoji: '📵', title: 'No phone for the last 30 minutes before bed', detail: 'Charge it across the room.' },
  { id: 'steps', emoji: '👟', title: 'Hit 10,000 steps', detail: 'Check your Apple Watch.' },
  { id: 'kind', emoji: '🤝', title: 'Do something kind for someone', detail: 'Small counts.' },
  { id: 'desk', emoji: '🗂️', title: 'Clear your desk', detail: 'Everything off, only what you need back on.' },
  { id: 'putoff', emoji: '📬', title: "Do one thing you've been putting off", detail: 'An email, a form, a booking.' },
  { id: 'journal', emoji: '✍️', title: 'Write a proper reflection tonight', detail: 'At least three sentences.' },
  { id: 'water3', emoji: '🚰', title: 'Drink a third bottle of water', detail: 'Bonus hydration.' },
  { id: 'breathe', emoji: '🫁', title: '5 minutes of slow breathing', detail: 'In for 4, hold for 4, out for 6.' },
];

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
