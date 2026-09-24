/** Badges you unlock along the way. Each has a progress value so locked ones show how close you are. */
import { weekStart } from './dates';
import { cleanBest, slipStats, totalSaved, weekStats, type Summary } from './engine';

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  progress: number;
  target: number;
  unlocked: boolean;
}

type Def = { id: string; emoji: string; title: string; detail: string; target: number; value: (s: Summary) => number | null };

const best = (id: string) => (s: Summary) => s.habitStreaks[id]?.best ?? null;
const doneDays = (id: string) => (s: Summary) => {
  const idx = s.habits.findIndex((h) => h.id === id);
  return idx < 0 ? null : s.evals.filter((e) => e.items[idx]?.done).length;
};

const DEFS: Def[] = [
  { id: 'first-day', emoji: '🌱', title: 'Day One', detail: 'Lock in your first day', target: 1, value: (s) => s.evals.filter((e) => e.onTime).length },
  { id: 'log-7', emoji: '📅', title: 'One Week In', detail: 'Log 7 days in a row', target: 7, value: (s) => s.logStreak.best },
  { id: 'log-30', emoji: '🗓️', title: 'Month Strong', detail: 'Log 30 days in a row', target: 30, value: (s) => s.logStreak.best },
  { id: 'log-100', emoji: '💯', title: 'Centurion', detail: 'Log 100 days in a row', target: 100, value: (s) => s.logStreak.best },
  { id: 'perfect-1', emoji: '⭐', title: 'Perfect Day', detail: 'Tick off everything in a day', target: 1, value: (s) => s.evals.filter((e) => e.perfect).length },
  { id: 'perfect-10', emoji: '🌟', title: 'Perfectionist', detail: '10 perfect days', target: 10, value: (s) => s.evals.filter((e) => e.perfect).length },
  { id: 'perfect-50', emoji: '👑', title: 'Flawless', detail: '50 perfect days', target: 50, value: (s) => s.evals.filter((e) => e.perfect).length },
  { id: 'a-week', emoji: '🅰️', title: 'A-Grade Week', detail: 'Average 85%+ across a full week', target: 1, value: (s) => {
    const weeks = new Set(s.evals.map((e) => weekStart(e.date)));
    return [...weeks].filter((w) => { const st = weekStats(s, w); return st.days === 7 && (st.avgPct ?? 0) >= 85; }).length;
  } },
  { id: 'vape-7', emoji: '🚭', title: 'Vape-Free Week', detail: '7 days without vaping', target: 7, value: best('vape') },
  { id: 'vape-30', emoji: '🫁', title: 'Lungs Say Thanks', detail: '30 days without vaping', target: 30, value: best('vape') },
  { id: 'vape-100', emoji: '🏔️', title: 'Vape-Free 100', detail: '100 days without vaping', target: 100, value: best('vape') },
  { id: 'porn-7', emoji: '🧠', title: 'Clear Head', detail: '7 days porn-free', target: 7, value: best('porn') },
  { id: 'porn-30', emoji: '🔋', title: 'Rewired', detail: '30 days porn-free', target: 30, value: best('porn') },
  { id: 'porn-90', emoji: '🧘', title: 'Reboot Complete', detail: '90 days porn-free', target: 90, value: best('porn') },
  { id: 'dry-14', emoji: '🥤', title: 'Dry Fortnight', detail: '14 days without a drink', target: 14, value: (s) => cleanBest(s, 'alcohol') },
  { id: 'urge-10', emoji: '🌊', title: 'Urge Surfer', detail: 'Beat 10 cravings', target: 10, value: (s) => slipStats(s).reduce((n, x) => n + x.urgesAll, 0) },
  { id: 'urge-50', emoji: '🗿', title: 'Iron Will', detail: 'Beat 50 cravings', target: 50, value: (s) => slipStats(s).reduce((n, x) => n + x.urgesAll, 0) },
  { id: 'saved-100', emoji: '💷', title: 'Ton Saved', detail: 'Save £100 by staying clean', target: 100, value: (s) => totalSaved(s) },
  { id: 'gym-1', emoji: '💪', title: 'Target Hit', detail: 'Hit your weekly training target', target: 1, value: (s) => s.weeks.filter((w) => w.outcome === 'success').length },
  { id: 'gym-4', emoji: '🏋️', title: 'Month of Gains', detail: '4 weeks in a row hitting your target', target: 4, value: (s) => s.trainingStreak.best },
  { id: 'gym-12', emoji: '🦍', title: 'Beast Mode', detail: '12 weeks in a row hitting your target', target: 12, value: (s) => s.trainingStreak.best },
  { id: 'sessions-50', emoji: '🏟️', title: 'Fifty Sessions', detail: 'Train 50 times', target: 50, value: (s) => s.evals.filter((e) => e.workoutCount > 0).length },
  { id: 'wake-7', emoji: '🌅', title: 'Early Riser', detail: 'Up before 9am 7 days running', target: 7, value: best('wake') },
  { id: 'sleep-14', emoji: '🌙', title: 'Night Owl Tamed', detail: 'Asleep before 1am 14 nights running', target: 14, value: best('sleep') },
  { id: 'water-30', emoji: '💧', title: 'Hydrated', detail: 'Hit your water 30 times', target: 30, value: doneDays('water') },
  { id: 'room-14', emoji: '🧺', title: 'Tidy Room', detail: 'No clothes on the floor for 14 days', target: 14, value: best('clothes') },
  { id: 'protein-30', emoji: '🍗', title: 'Protein Pro', detail: 'Hit protein 30 times', target: 30, value: doneDays('protein') },
  { id: 'level-5', emoji: '⚡', title: 'Level 5', detail: 'Reach level 5', target: 5, value: (s) => s.level.level },
  { id: 'level-10', emoji: '🔱', title: 'Level 10', detail: 'Reach level 10', target: 10, value: (s) => s.level.level },
  { id: 'xp-10k', emoji: '💰', title: '10k Club', detail: 'Earn 10,000 XP', target: 10_000, value: (s) => s.totalXp },
  { id: 'dues', emoji: '🤝', title: 'Paid Your Dues', detail: 'Clear a charity fine', target: 1, value: (s) => (s.paid > 0 && s.owed === 0 ? 1 : 0) },
];

export function achievements(summary: Summary): Achievement[] {
  const out: Achievement[] = [];
  for (const d of DEFS) {
    const v = d.value(summary);
    if (v == null) continue; // habit switched off
    out.push({ id: d.id, emoji: d.emoji, title: d.title, detail: d.detail, target: d.target, progress: Math.min(v, d.target), unlocked: v >= d.target });
  }
  return out;
}
