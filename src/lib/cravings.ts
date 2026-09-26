/** Craving SOS: ride out an urge for 10 minutes, and learn when cravings tend to hit. */
import { addDays, type DateKey } from './dates';
import type { Summary } from './engine';
import type { DayLog } from './types';

/** Cravings peak and pass in about this long. */
export const SOS_MINUTES = 10;

/** Things to do instead, one at a time. */
export const IDEAS = [
  { emoji: '🚰', text: 'Drink a big glass of cold water, slowly.' },
  { emoji: '🚶', text: 'Get up and walk — round the block, or just to another room.' },
  { emoji: '🍬', text: 'Chew gum or have a mint.' },
  { emoji: '💪', text: 'Do 20 push-ups or squats. Right now.' },
  { emoji: '🪥', text: 'Brush your teeth.' },
  { emoji: '🧊', text: 'Splash cold water on your face.' },
  { emoji: '💬', text: 'Text someone. Anyone. Talk about anything else.' },
  { emoji: '🥕', text: 'Eat something crunchy.' },
  { emoji: '🎧', text: 'Put on one song and do nothing else until it ends.' },
  { emoji: '🧹', text: 'Do a 2-minute tidy — keep your hands busy.' },
  { emoji: '🚿', text: 'Have a quick shower.' },
  { emoji: '📵', text: 'Put your phone in another room for 10 minutes.' },
];

/** Box breathing that slows the exhale: in 4, hold 4, out 6. */
export const BREATH = [
  { phase: 'Breathe in', secs: 4, scale: 1 },
  { phase: 'Hold', secs: 4, scale: 1 },
  { phase: 'Breathe out', secs: 6, scale: 0.6 },
] as const;
const CYCLE = BREATH.reduce((s, b) => s + b.secs, 0);

export function breathAt(elapsedSecs: number): { phase: string; left: number; scale: number } {
  let t = elapsedSecs % CYCLE;
  for (const b of BREATH) {
    if (t < b.secs) return { phase: b.phase, left: Math.ceil(b.secs - t), scale: b.scale };
    t -= b.secs;
  }
  return { phase: BREATH[0].phase, left: BREATH[0].secs, scale: BREATH[0].scale };
}

/** Log a craving you beat: counts towards XP (up to a cap) and remembers the time. */
export function logUrge(l: DayLog, habitId: string, at: number) {
  l.urges = { ...l.urges, [habitId]: (l.urges?.[habitId] ?? 0) + 1 };
  l.urgeAt = { ...l.urgeAt, [habitId]: [...(l.urgeAt?.[habitId] ?? []), at] };
}

const PARTS = [
  { id: 'morning', label: 'the morning', from: 5, to: 12 },
  { id: 'afternoon', label: 'the afternoon', from: 12, to: 17 },
  { id: 'evening', label: 'the evening', from: 17, to: 21 },
  { id: 'night', label: 'late at night', from: 21, to: 29 },
];

/** When cravings for a habit usually hit (needs a few logged first). */
export function cravingPeak(summary: Summary, habitId: string, days = 60): { label: string; count: number; total: number } | null {
  const since: DateKey = addDays(summary.today, -days);
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of summary.evals) {
    if (e.date < since) continue;
    for (const at of e.log?.urgeAt?.[habitId] ?? []) {
      const h = new Date(at).getHours();
      const hour = h < 5 ? h + 24 : h;
      const part = PARTS.find((p) => hour >= p.from && hour < p.to)!;
      counts.set(part.id, (counts.get(part.id) ?? 0) + 1);
      total++;
    }
  }
  if (total < 5) return null;
  const [id, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (count / total < 0.4) return null;
  return { label: PARTS.find((p) => p.id === id)!.label, count, total };
}
