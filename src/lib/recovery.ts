/**
 * What staying off nicotine is doing for you, day by day. These are the usual, general milestones
 * for quitting nicotine — everyone's different, so they're worded as "usually".
 */
export interface Milestone {
  days: number;
  emoji: string;
  title: string;
  /** For the timeline strip. */
  short: string;
  text: string;
}

export const NICOTINE_MILESTONES: Milestone[] = [
  { days: 1, emoji: '🌱', title: '1 day', short: '1d', text: 'Nicotine is clearing out of your system.' },
  { days: 3, emoji: '⛰️', title: '3 days', short: '3d', text: 'Withdrawal usually peaks around now — from here it gets easier.' },
  { days: 7, emoji: '📉', title: '1 week', short: '1w', text: 'Cravings usually start coming less often.' },
  { days: 14, emoji: '⚽', title: '2 weeks', short: '2w', text: "Breathing and circulation tend to improve — you'll feel it at football and the gym." },
  { days: 30, emoji: '😴', title: '1 month', short: '1m', text: 'Withdrawal is mostly behind you; sleep and mood are often better than while using.' },
  { days: 90, emoji: '🫁', title: '3 months', short: '3m', text: 'Cravings are usually rare now, and short when they come.' },
  { days: 180, emoji: '💪', title: '6 months', short: '6m', text: 'Half a year. Your lungs and your wallet both notice.' },
  { days: 365, emoji: '🏆', title: '1 year', short: '1y', text: 'A full year nicotine-free. That’s who you are now.' },
];

/** Where a streak of `days` clean days sits on the timeline. */
export function recovery(days: number) {
  const reached = NICOTINE_MILESTONES.filter((m) => days >= m.days);
  const next = NICOTINE_MILESTONES.find((m) => days < m.days) ?? null;
  return { reached, latest: reached.at(-1) ?? null, next, inDays: next ? next.days - days : 0 };
}
