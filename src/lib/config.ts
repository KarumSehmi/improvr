/**
 * The built-in habits. You can also hide these, change chore days and add your own
 * from the app (More → Your habits). Points are what make the XP bar move — bigger = more important.
 */
import { weekday, type DateKey } from './dates.js';
import type { ReminderSettings, Settings, WorkoutType } from './types.js';

export type SectionId = 'morning' | 'day' | 'room' | 'night' | 'clean';

export type HabitKind =
  | 'check' // simple tick
  | 'time' // yes/no with a rough time if you missed it (sleep / wake)
  | 'water' // tap bottles
  | 'count' // count up to a target (10 pages, 20 mins…)
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
  /** Weekdays it doesn't apply (0 Sun … 6 Sat) — hidden and not counted those days. */
  restDays?: number[];
  /** A bonus: shows up and earns XP when done, but skipping it never hurts the score. */
  optional?: boolean;
  /** Stay-clean habits only: slips allowed per Mon–Sun week before it counts as a miss. */
  weeklyLimit?: number;
  /** Water and count habits: how many make it done (2 bottles, 10 pages…). */
  target?: number;
  /** Count habits: what you're counting ("pages", "mins"). */
  unit?: string;
  custom?: boolean;
}

/** What each kind of habit is, in a few words. */
export const KIND_LABEL: Record<HabitKind, string> = {
  check: 'Daily tick',
  chore: 'Repeating job · carries over until done',
  time: 'Yes / no, with a rough time',
  water: 'Bottles of water',
  count: 'Count up to a target',
  dose: 'Measured dose',
  avoid: 'Stay clean · answered honestly',
};

/** What you can change about any habit, built-in or your own (Settings → Habits). The kind never changes. */
export type HabitEdit = Partial<Pick<Habit, 'label' | 'emoji' | 'section' | 'points' | 'hint' | 'important' | 'optional' | 'restDays' | 'target' | 'unit'>>;

/** `from` = the hour a section becomes relevant (before that it's folded away as "later" on Today). */
export const SECTIONS: { id: SectionId; title: string; short: string; emoji: string; subtitle: string; color: string; from: number }[] = [
  { id: 'morning', title: 'Morning', short: 'Morning', emoji: '🌅', subtitle: 'Weigh in, meds, teeth, face', color: 'orange', from: 4 },
  { id: 'day', title: 'Through the day', short: 'Day', emoji: '⚡', subtitle: 'Water, food & creatine', color: 'cyan', from: 10 },
  { id: 'room', title: 'Room', short: 'Room', emoji: '🧹', subtitle: 'Carries over until done', color: 'grape', from: 12 },
  { id: 'night', title: 'Night', short: 'Night', emoji: '🌙', subtitle: 'Teeth, skin, finasteride & minoxidil', color: 'indigo', from: 20 },
  { id: 'clean', title: 'Stayed clean', short: 'Clean', emoji: '🛡️', subtitle: 'Be honest', color: 'teal', from: 20 },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<SectionId, (typeof SECTIONS)[number]>;

/** The hour a section comes due on Today (you can move these in Settings → Targets & times). */
export function sectionHour(settings: Pick<Settings, 'sectionHours'> | undefined, id: SectionId): number {
  return settings?.sectionHours?.[id] ?? SECTION_BY_ID[id].from;
}

/** Teeth, creatine, minoxidil and the home workout were added part-way through, so earlier days don't count them. */
const ADDED_TEETH = '2026-09-24';
const ADDED_CREATINE = '2026-09-27';
const ADDED_MINOXIDIL = '2026-09-30';
const ADDED_HOME_WORKOUT = '2026-09-30';

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
  { id: 'water', label: '2 bottles of water', emoji: '🚰', section: 'day', kind: 'water', points: 10, target: 2 },
  { id: 'macro', label: 'Logged on MacroFactor', emoji: '📱', section: 'day', kind: 'check', points: 10 },
  { id: 'protein', label: 'Hit protein', emoji: '🍗', section: 'day', kind: 'check', points: 15 },
  { id: 'creatine', label: 'Took creatine', emoji: '🥄', section: 'day', kind: 'check', points: 10, since: ADDED_CREATINE },
  {
    id: 'homeWorkout',
    label: '15 min home workout',
    emoji: '🚴',
    section: 'day',
    kind: 'check',
    points: 20,
    hint: 'Peloton',
    optional: true, // not every day — a bonus when you do it
    restDays: [1], // Monday is football
    since: ADDED_HOME_WORKOUT,
  },
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
  { id: 'minoxidil', label: 'Took minoxidil', emoji: '💆', section: 'night', kind: 'check', points: 10, since: ADDED_MINOXIDIL },
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

/** A built-in habit with your changes (name, emoji, section, XP, schedule, targets…), before hiding. */
export function editedHabit(h: Habit, settings: Settings): Habit {
  const edit = h.custom ? {} : (settings.habitEdits?.[h.id] ?? {});
  const schedule = settings.scheduleOverrides?.[h.id];
  const limit = settings.weeklyLimits?.[h.id];
  const out: Habit = { ...h, ...edit, id: h.id, kind: h.kind };
  if (schedule && !h.custom) out.schedule = schedule;
  if (h.kind === 'avoid' && limit != null) out.weeklyLimit = limit;
  // Names that mention a target follow it, unless you've renamed them.
  if (!edit.label && !h.custom) {
    if (h.id === 'water' && out.target != null && out.target !== h.target) out.label = `${out.target} bottle${out.target === 1 ? '' : 's'} of water`;
    if (h.id === 'caffeine') out.label = `No caffeine after ${clockLabel(caffeineCutoff(settings))}`;
    if (h.id === 'sleep') out.label = `Asleep before ${clockLabel(weekdayTargets(settings).sleep)}`;
    if (h.id === 'wake') out.label = `Up before ${clockLabel(weekdayTargets(settings).wake)}`;
  }
  return out;
}

/** Every habit there is, switched on or not: built-ins (with your changes) plus your own, in your order. */
export function allHabits(settings: Settings): Habit[] {
  const builtIn = BUILT_IN_HABITS.map((h) => editedHabit(h, settings));
  const custom = (settings.customHabits ?? []).map((h) => editedHabit({ ...h, custom: true }, settings));
  // Sections in their usual order; inside a section, your order first, then the rest as they were added.
  const sectionIdx = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i])) as Record<SectionId, number>;
  const order = new Map((settings.habitOrder ?? []).map((id, i) => [id, i]));
  const all = [...builtIn, ...custom];
  const rank = new Map(all.map((h, i) => [h.id, order.get(h.id) ?? 10_000 + i]));
  return all.sort((a, b) => sectionIdx[a.section] - sectionIdx[b.section] || rank.get(a.id)! - rank.get(b.id)!);
}

/** The habits you're actually tracking: built-ins (minus hidden, with your changes) plus your own. */
export function habitsFor(settings: Settings): Habit[] {
  const hit = cache.get(settings);
  if (hit) return hit;
  const hidden = new Set(settings.hiddenHabits ?? []);
  const all = allHabits(settings).filter((h) => !hidden.has(h.id));
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

/** Default bottles of water a day (change it on the habit). */
export const WATER_TARGET = 2;

/** Only gym counts towards the weekly target — football is extra. */
export const WORKOUTS: { id: WorkoutType; label: string; emoji: string; points: number; legacy?: boolean }[] = [
  { id: 'gym', label: 'Gym', emoji: '🏋️', points: 40 },
  // Now a daily habit; kept so days that logged it here still score.
  { id: 'home', label: 'Home workout', emoji: '🏠', points: 20, legacy: true },
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
  /** Updating your card spending (once a week is the idea). */
  budget: 10,
};

/** Credit card: the monthly limit to stay under, and the hard ceiling it keeps you well clear of. */
export const DEFAULT_BUDGET = { limit: 800, ceiling: 1000, startDay: 1 };

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

/** A different nudge for the evening note each day. The question stays the same: how can I be better tomorrow? */
export const REFLECTION_PROMPTS = [
  'One thing to do differently tomorrow…',
  'What got in the way today?',
  'What went well — and how do you repeat it?',
  'What would tomorrow-you thank you for?',
  'Which habit felt hardest today, and why?',
  'One small win from today…',
  "What's the first thing you'll do tomorrow morning?",
  'If today was a 6/10, what would have made it a 7?',
  'What have you been putting off?',
  'What drained you today? What gave you energy?',
  'Who could you check in on tomorrow?',
  'What would make tomorrow 1% better?',
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

// ---------------------------------------------------------------------------
// Sleep & wake targets: a bit more lenient at the weekend
// ---------------------------------------------------------------------------

export const SLEEP_TARGETS = {
  weekday: { sleep: '01:00', wake: '09:00' },
  weekend: { sleep: '02:00', wake: '10:30' },
};

/** Weekday targets (Sunday–Thursday nights, Monday–Friday mornings), with your changes. */
export function weekdayTargets(settings: Pick<Settings, 'weekday'>): { sleep: string; wake: string } {
  return { ...SLEEP_TARGETS.weekday, ...stripEmpty(settings.weekday) };
}

/** Weekend targets (Friday & Saturday nights, Saturday & Sunday mornings), with your changes. */
export function weekendTargets(settings: Pick<Settings, 'weekend'>): { sleep: string; wake: string } {
  return { ...SLEEP_TARGETS.weekend, ...stripEmpty(settings.weekend) };
}

function stripEmpty<T extends object>(o: T | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v)) as Partial<T>;
}

/**
 * The targets that apply to a day's "asleep" and "up" answers. Saturday and Sunday are the weekend:
 * that covers Friday and Saturday nights (sleep is about the night before) and both lie-ins.
 */
export function sleepTargets(settings: Settings, date: DateKey): { sleep: string; wake: string; weekend: boolean } {
  const wd = weekday(date);
  const weekend = wd === 6 || wd === 0;
  return weekend ? { ...weekendTargets(settings), weekend } : { ...weekdayTargets(settings), weekend };
}

/** No caffeine after this time (2pm unless you change it). */
export const DEFAULT_CAFFEINE_CUTOFF = '14:00';

export function caffeineCutoff(settings: Pick<Settings, 'caffeineCutoff'>): string {
  return settings.caffeineCutoff || DEFAULT_CAFFEINE_CUTOFF;
}

const shiftClock = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Reminder times with your changes. The caffeine warning follows your cutoff (15 minutes before) unless you've set it. */
export function reminderTimes(settings: Pick<Settings, 'reminders' | 'caffeineCutoff'>): ReminderSettings {
  const r = { ...DEFAULT_REMINDERS, ...settings.reminders };
  // Older versions saved every time, so the default 13:45 there still means "not changed".
  const own = settings.reminders?.caffeine;
  if (!own || own === DEFAULT_REMINDERS.caffeine) r.caffeine = shiftClock(caffeineCutoff(settings), -15);
  return r;
}

/** '01:00' → '1am', '10:30' → '10:30am'. */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** Habit name for a day ("Asleep before 2am" on a Saturday). */
export function habitLabel(h: Habit, settings: Settings, date: DateKey): string {
  if ((h.id !== 'sleep' && h.id !== 'wake') || h.custom || settings.habitEdits?.[h.id]?.label) return h.label;
  const t = sleepTargets(settings, date);
  return h.id === 'sleep' ? `Asleep before ${clockLabel(t.sleep)}` : `Up before ${clockLabel(t.wake)}`;
}

// ---------------------------------------------------------------------------
// Parts of the app you can switch off (Settings → Today page)
// ---------------------------------------------------------------------------

export const FEATURES = [
  { id: 'checkins', emoji: '⚡', label: 'Check-ins', detail: 'Morning, afternoon and evening energy taps, +5 XP each' },
  { id: 'quest', emoji: '🎲', label: 'Bonus quest', detail: 'One small optional challenge a day, +15 XP' },
  { id: 'chest', emoji: '🎁', label: 'Reward chest', detail: 'Lock in on time to open a chest of bonus XP' },
  { id: 'race', emoji: '🏁', label: 'Race yesterday-you', detail: 'How far ahead or behind yesterday you are by now' },
  { id: 'sos', emoji: '🆘', label: 'Craving SOS', detail: 'The 10-minute craving timer button' },
  { id: 'budget', emoji: '💳', label: 'Card spending', detail: 'Weekly card update and pace against your limit' },
] as const;

export type FeatureId = (typeof FEATURES)[number]['id'];

/** Everything's on unless you switch it off. */
export function featureOn(settings: Pick<Settings, 'features'>, id: FeatureId): boolean {
  return settings.features?.[id] !== false;
}

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
