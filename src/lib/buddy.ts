/**
 * Accountability buddy: a small read-only summary a friend can open from a secret link,
 * plus the same thing as a short message for the weekly email / share sheet.
 */
import { addDays, fmt, weekStart, type DateKey } from './dates';
import { grade, slipStats, totalSaved, weekStats, type Summary } from './engine';

export interface BuddySnapshot {
  uid: string;
  name: string;
  updatedAt: number;
  today: DateKey;
  week: { start: DateKey; avgPct: number | null; grade: string; logged: number; days: number; sessions: number; target: number };
  lastWeeks: { start: DateKey; avgPct: number | null; grade: string }[];
  logStreak: number;
  unloggedYesterday: boolean;
  fines: { owed: number; total: number; paid: number; missedDays: number; charity: string };
  clean: { label: string; emoji: string; streak: number; slipsThisWeek: number | null; urgesThisWeek: number }[];
  saved: number | null;
}

export function buddySnapshot(summary: Summary, uid: string): BuddySnapshot {
  const { settings, today } = summary;
  const ws = weekStart(today);
  // Score from finished days only, so a half-done today doesn't drag the grade down.
  const scored = weekStats(summary, ws, addDays(today, -1));
  const now = weekStats(summary, ws, today);
  const showSlips = settings.buddy?.showSlips ?? true;
  const yesterday = summary.evalByDate[addDays(today, -1)];
  return {
    uid,
    name: settings.name || 'Your mate',
    updatedAt: Date.now(),
    today,
    week: {
      start: ws,
      avgPct: scored.avgPct,
      grade: grade(scored.avgPct).letter,
      logged: now.logged,
      days: now.days,
      sessions: now.sessions,
      target: settings.workoutTarget,
    },
    lastWeeks: [1, 2, 3, 4].map((n) => {
      const w = weekStats(summary, addDays(ws, -7 * n));
      return { start: w.start, avgPct: w.avgPct, grade: grade(w.avgPct).letter };
    }),
    logStreak: summary.logStreak.current,
    unloggedYesterday: !!yesterday && !yesterday.closed,
    fines: { owed: summary.owed, total: summary.fineTotal, paid: summary.paid, missedDays: summary.fineDays.length, charity: settings.charity },
    clean: slipStats(summary).map((s) => ({
      label: s.habit.label,
      emoji: s.habit.emoji,
      streak: summary.habitStreaks[s.habit.id]?.current ?? 0,
      slipsThisWeek: showSlips ? (now.slips[s.habit.id] ?? 0) : null,
      urgesThisWeek: s.urges7,
    })),
    saved: totalSaved(summary),
  };
}

/** Plain-text weekly report, for WhatsApp/iMessage or the weekly email. */
export function buddyReport(b: BuddySnapshot, link: string): string {
  const lines = [
    `📊 ${b.name}'s week (from ${fmt(b.week.start, 'D MMM')})`,
    `Grade ${b.week.grade}${b.week.avgPct != null ? ` · ${b.week.avgPct}% average` : ''}`,
    `Logged ${b.week.logged}/${b.week.days} days · ${b.logStreak}-day logging streak`,
    `Gym ${b.week.sessions}/${b.week.target} sessions`,
    ...b.clean.map((c) => `${c.emoji} ${c.label}: ${c.streak}-day streak${c.slipsThisWeek != null ? `, ${c.slipsThisWeek} slip${c.slipsThisWeek === 1 ? '' : 's'} this week` : ''}`),
    b.fines.owed > 0 ? `💷 Owes £${b.fines.owed} to ${b.fines.charity} — chase them for it.` : `💷 No fines owed.`,
    b.saved != null ? `💰 £${b.saved} saved by staying clean` : '',
    '',
    `Live page: ${link}`,
  ];
  return lines.filter((l, i) => l !== '' || i === lines.length - 2).join('\n');
}

export function buddyLink(origin: string, token: string): string {
  return `${origin}/?buddy=${encodeURIComponent(token)}`;
}
