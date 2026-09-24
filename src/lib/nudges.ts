/**
 * Smart notifications: the server checks every 15 minutes and asks this file what (if anything)
 * is worth a buzz right now. Each nudge only fires when there's actually something to do,
 * and at most once per day.
 */
import { DEFAULT_REMINDERS } from './config';
import { addDays, weekday, weekStart, type DateKey } from './dates';
import { weekStats, type Summary } from './engine';

export type NudgeId = 'morning' | 'caffeine' | 'deadline' | 'lockin' | 'lastcall' | 'bedtime' | 'fines' | 'review';

export const NUDGES: { id: NudgeId; label: string; when: string }[] = [
  { id: 'morning', label: 'Morning routine not done', when: 'morning' },
  { id: 'caffeine', label: 'Caffeine cutoff coming up', when: 'caffeine' },
  { id: 'deadline', label: "Yesterday isn't logged yet", when: '20:00' },
  { id: 'lockin', label: "Today isn't locked in (with streaks at risk)", when: 'lockIn' },
  { id: 'lastcall', label: 'Last call before a £ fine', when: '23:30' },
  { id: 'bedtime', label: 'Bed by 1am countdown', when: 'bedtime' },
  { id: 'fines', label: 'Fines you still owe', when: 'Sun 12:00' },
  { id: 'review', label: 'Weekly review is ready', when: 'Mon 09:00' },
];

export interface Nudge {
  id: NudgeId;
  title: string;
  body: string;
}

/** How long after its time a nudge can still go out (covers a late server run). */
const WINDOW_MIN = 90;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const names = (xs: string[], max = 3) => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} +${xs.length - max} more`);

export function dueNudges(args: {
  summary: Summary;
  /** Local date and minutes past midnight in your time zone. */
  date: DateKey;
  minutes: number;
  /** Nudge id → local date it last went out. */
  sent: Record<string, string>;
}): Nudge[] {
  const { summary, date, minutes, sent } = args;
  const s = summary.settings;
  const r = { ...DEFAULT_REMINDERS, ...s.reminders };
  const fine = `£${s.fineAmount}`;
  const today = summary.evalByDate[date];
  const yesterday = summary.evalByDate[addDays(date, -1)];
  const open = today ? today.items.filter((i) => i.required && !i.done && !i.missed && !i.skipped) : [];
  const out: Nudge[] = [];

  const due = (id: NudgeId, at: string, day?: number) =>
    s.notify?.[id] !== false &&
    sent[id] !== date &&
    (day == null || weekday(date) === day) &&
    minutes >= toMin(at) &&
    minutes < toMin(at) + WINDOW_MIN;

  if (today && !today.dayOff) {
    const morning = open.filter((i) => i.habit.section === 'morning');
    if (morning.length && due('morning', r.morning)) {
      out.push({ id: 'morning', title: '🌅 Morning routine', body: `Still to do: ${names(morning.map((i) => i.habit.label))}. One tap in Up next.` });
    }

    const caffeine = open.find((i) => i.habit.id === 'caffeine');
    if (caffeine && due('caffeine', r.caffeine)) {
      out.push({ id: 'caffeine', title: '☕ Caffeine cutoff at 2pm', body: 'Last coffee now if you want one — nothing after 2.' });
    }

    if (!today.closed && due('lockin', r.lockIn)) {
      const atRisk = open.filter((i) => (summary.habitStreaks[i.habit.id]?.current ?? 0) >= 3);
      const risk = atRisk.length ? ` 🔥 ${atRisk.length} streak${atRisk.length === 1 ? '' : 's'} at risk: ${names(atRisk.map((i) => `${i.habit.label} (${summary.habitStreaks[i.habit.id].current})`), 2)}.` : '';
      out.push({ id: 'lockin', title: '🔒 Lock in today', body: `${today.completed}/${today.required} done.${risk}` });
    }
  }

  if (yesterday && !yesterday.closed) {
    if (due('deadline', '20:00')) {
      out.push({ id: 'deadline', title: "⏳ Yesterday isn't logged", body: `You've got until midnight, then it's ${fine} to ${s.charity}.` });
    }
    if (due('lastcall', '23:30')) {
      out.push({ id: 'lastcall', title: '🚨 30 minutes left', body: `Log yesterday now or it's ${fine} to ${s.charity}.` });
    }
  }

  // Just after midnight counts as "tonight"
  if (due('bedtime', r.bedtime)) {
    out.push({ id: 'bedtime', title: '🌙 Bed by 1am', body: 'Phone down, face routine, lights off.' });
  }

  if (summary.owed > 0 && due('fines', '12:00', 0)) {
    out.push({ id: 'fines', title: `💷 You owe £${summary.owed}`, body: `Donate to ${s.charity}, then tap "I've paid" in the app.` });
  }

  const ws = weekStart(date);
  if (s.reviewedWeek !== ws && weekStats(summary, addDays(ws, -7)).days >= 3 && due('review', '09:00', 1)) {
    out.push({ id: 'review', title: '📊 Your week in review', body: 'See how last week went and pick one thing to focus on.' });
  }

  return out;
}
