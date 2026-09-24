/**
 * Patterns in your own data, written as plain sentences. Each insight only appears once there's
 * enough data behind it to mean something.
 */
import { WEEKDAYS } from './config';
import { addDays, diffDays, weekday, weekStart } from './dates';
import { habitRates, slipStats, weekStats, type DayEval, type Summary } from './engine';

export interface Insight {
  id: string;
  emoji: string;
  text: string;
  tone: 'good' | 'bad' | 'tip';
  weight: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Day score leaving some items out (so "sleep → score" isn't just counting the sleep tick itself). */
function pctWithout(e: DayEval, exclude: Set<string>): number | null {
  const req = e.items.filter((i) => i.required && !exclude.has(i.habit.id));
  if (!req.length) return null;
  return (req.filter((i) => i.done).length / req.length) * 100;
}

function compare(groupA: number[], groupB: number[], min = 3) {
  if (groupA.length < min || groupB.length < min) return null;
  return { a: avg(groupA)!, b: avg(groupB)! };
}

export function insights(summary: Summary): Insight[] {
  const { today, habits } = summary;
  const has = (id: string) => habits.some((h) => h.id === id);
  const past = summary.evals.filter((e) => e.date < today && !e.dayOff);
  const out: Insight[] = [];

  // Better than last week? (the whole point) — finished days only, against the same days last week
  const ws = weekStart(today);
  const yesterday = addDays(today, -1);
  const thisWeek = weekStats(summary, ws, yesterday);
  const lastWeek = weekStats(summary, addDays(ws, -7), addDays(yesterday, -7));
  if (thisWeek.avgPct != null && lastWeek.avgPct != null && thisWeek.days >= 1 && lastWeek.days >= 1) {
    const diff = thisWeek.avgPct - lastWeek.avgPct;
    if (diff >= 1) out.push({ id: 'week-up', emoji: '📈', tone: 'good', weight: 95, text: `${diff}% better than this point last week. That's the whole game.` });
    else if (diff <= -1) out.push({ id: 'week-down', emoji: '📉', tone: 'bad', weight: 90, text: `${-diff}% behind this point last week. Still time to turn it round.` });
  }

  // The streak closest to a personal best (just one — it's a nudge, not a list)
  const chase = habits
    .map((h) => ({ h, s: summary.habitStreaks[h.id] }))
    .filter(({ s }) => s && s.best >= 7 && s.current > 0 && s.best - s.current >= 1 && s.best - s.current <= 3)
    .sort((a, b) => a.s.best - a.s.current - (b.s.best - b.s.current) || Number(!!b.h.important) - Number(!!a.h.important))[0];
  if (chase) {
    const gap = chase.s.best - chase.s.current;
    out.push({ id: `pb-${chase.h.id}`, emoji: '🏁', tone: 'good', weight: 88, text: `${gap + 1} more days and "${chase.h.label.toLowerCase()}" beats your record (${chase.s.best}).` });
  }
  const record = habits
    .map((h) => ({ h, s: summary.habitStreaks[h.id] }))
    .filter(({ s }) => s && s.current >= 7 && s.current === s.best)
    .sort((a, b) => Number(!!b.h.important) - Number(!!a.h.important) || b.s.current - a.s.current)[0];
  if (record) {
    out.push({ id: `record-${record.h.id}`, emoji: '🏆', tone: 'good', weight: 92, text: `You're on your best-ever "${record.h.label.toLowerCase()}" run: ${record.s.current} days. Don't break it.` });
  }

  // Cravings fading, and money kept in your pocket
  for (const s of slipStats(summary)) {
    const label = s.habit.label.replace(/^No /, '').toLowerCase();
    if (s.urgesPrev7 >= 3 && s.urges7 < s.urgesPrev7) {
      out.push({ id: `urges-${s.habit.id}`, emoji: '🌊', tone: 'good', weight: 84, text: `Cravings for ${label} are fading: ${s.urges7} this week vs ${s.urgesPrev7} the week before.` });
    }
    if (s.saved != null && s.saved >= 5) {
      out.push({ id: `saved-${s.habit.id}`, emoji: '💷', tone: 'good', weight: 76, text: `Staying off ${label} has saved you £${s.saved}${s.savedSinceSlip != null && s.savedSinceSlip !== s.saved ? ` (£${s.savedSinceSlip} since your last slip)` : ''}.` });
    }
  }

  // Sleep & wake → how the rest of the day goes
  const sleepSet = new Set(['sleep', 'wake']);
  for (const [id, good, bad] of [
    ['sleep', 'After nights asleep before 1am', 'after late nights'],
    ['wake', 'On days you’re up before 9am', 'when you sleep in'],
  ] as const) {
    if (!has(id)) continue;
    const r = compare(
      past.filter((e) => e.log?.done?.[id] === true).map((e) => pctWithout(e, sleepSet) ?? 0),
      past.filter((e) => e.log?.done?.[id] === false).map((e) => pctWithout(e, sleepSet) ?? 0),
    );
    if (r && r.a - r.b >= 8) {
      out.push({ id: `${id}-effect`, emoji: id === 'sleep' ? '😴' : '☀️', tone: 'tip', weight: 80, text: `${good} you get ${Math.round(r.a)}% of your list done, vs ${Math.round(r.b)}% ${bad}.` });
    }
  }

  // Late nights → slips
  if (has('sleep')) {
    for (const h of habits.filter((x) => x.kind === 'avoid')) {
      const late = past.filter((e) => e.log?.done?.sleep === false && e.log?.avoid?.[h.id]);
      const early = past.filter((e) => e.log?.done?.sleep === true && e.log?.avoid?.[h.id]);
      if (late.length < 4 || early.length < 4) continue;
      const pLate = late.filter((e) => e.log?.avoid?.[h.id] === 'slip').length / late.length;
      const pEarly = early.filter((e) => e.log?.avoid?.[h.id] === 'slip').length / early.length;
      const slipsLate = late.filter((e) => e.log?.avoid?.[h.id] === 'slip').length;
      if (slipsLate >= 2 && pLate >= Math.max(0.2, pEarly * 1.5)) {
        const times = pEarly > 0 ? `${(pLate / pEarly).toFixed(1)}x more likely` : 'far more likely';
        out.push({ id: `late-${h.id}`, emoji: '🌙', tone: 'tip', weight: 85, text: `Slips on "${h.label.toLowerCase()}" are ${times} after a late night. Protect your bedtime.` });
      }
    }
  }

  // Which day of the week slips happen on
  for (const h of habits.filter((x) => x.kind === 'avoid')) {
    const slips = summary.evals.filter((e) => e.log?.avoid?.[h.id] === 'slip' && diffDays(today, e.date) < 90);
    if (slips.length < 3) continue;
    const counts = new Array(7).fill(0);
    slips.forEach((e) => counts[weekday(e.date)]++);
    const top = counts.indexOf(Math.max(...counts));
    if (counts[top] / slips.length >= 0.4) {
      out.push({ id: `slipday-${h.id}`, emoji: '📆', tone: 'tip', weight: 70, text: `Most "${h.label.toLowerCase()}" slips land on ${WEEKDAYS[top]}s. Plan that day in advance.` });
    }
  }

  // The day after drinking
  if (has('alcohol')) {
    const after = past.filter((e) => summary.evalByDate[addDays(e.date, -1)]?.log?.avoid?.alcohol === 'slip');
    const others = past.filter((e) => summary.evalByDate[addDays(e.date, -1)]?.log?.avoid?.alcohol === 'clean');
    const r = compare(after.map((e) => e.pct ?? 0), others.map((e) => e.pct ?? 0), 2);
    if (r && r.b - r.a >= 10) {
      out.push({ id: 'hangover', emoji: '🍺', tone: 'tip', weight: 75, text: `The day after drinking you average ${Math.round(r.a)}%, vs ${Math.round(r.b)}% normally.` });
    }
  }

  // Mood
  const moodDays = past.filter((e) => e.log?.mood);
  const mood = (xs: DayEval[]) => xs.map((e) => e.log!.mood as number);
  const trained = compare(mood(moodDays.filter((e) => e.workoutCount > 0)), mood(moodDays.filter((e) => e.workoutCount === 0)));
  if (trained && trained.a - trained.b >= 0.4) {
    out.push({ id: 'mood-train', emoji: '💪', tone: 'tip', weight: 78, text: `You feel better on training days (mood ${trained.a.toFixed(1)} vs ${trained.b.toFixed(1)} out of 5).` });
  }
  if (has('sleep')) {
    const slept = compare(mood(moodDays.filter((e) => e.log?.done?.sleep === true)), mood(moodDays.filter((e) => e.log?.done?.sleep === false)));
    if (slept && slept.a - slept.b >= 0.4) {
      out.push({ id: 'mood-sleep', emoji: '🛌', tone: 'tip', weight: 77, text: `Your mood is ${slept.a.toFixed(1)}/5 after a proper night, ${slept.b.toFixed(1)} after a late one.` });
    }
  }

  // Weakest & most improved habits
  const last14 = summary.evals.filter((e) => diffDays(today, e.date) < 14 && e.date < today);
  const prev14 = summary.evals.filter((e) => diffDays(today, e.date) >= 14 && diffDays(today, e.date) < 28);
  const recent = habitRates(summary, last14).filter((r) => r.required >= 5);
  const weakest = [...recent].sort((a, b) => a.rate - b.rate)[0];
  if (weakest && weakest.rate < 0.6) {
    out.push({ id: `weak-${weakest.habit.id}`, emoji: '🎯', tone: 'bad', weight: 72, text: `Weakest lately: ${weakest.habit.label} (${weakest.done}/${weakest.required} days). Make it a focus.` });
  }
  const before = Object.fromEntries(habitRates(summary, prev14).map((r) => [r.habit.id, r]));
  const improved = recent
    .map((r) => ({ r, delta: before[r.habit.id]?.required >= 5 ? r.rate - before[r.habit.id].rate : 0 }))
    .sort((a, b) => b.delta - a.delta)[0];
  if (improved && improved.delta >= 0.25) {
    out.push({ id: `improved-${improved.r.habit.id}`, emoji: '🚀', tone: 'good', weight: 82, text: `${improved.r.habit.label} is up ${Math.round(improved.delta * 100)}% on the fortnight before. Keep going.` });
  }

  // Best and toughest weekday
  if (past.length >= 21) {
    const byDay = Array.from({ length: 7 }, (_, d) => past.filter((e) => weekday(e.date) === d && e.pct != null).map((e) => e.pct as number));
    const avgs = byDay.map((xs) => (xs.length >= 2 ? avg(xs)! : null));
    const valid = avgs.map((a, d) => ({ a, d })).filter((x) => x.a != null) as { a: number; d: number }[];
    if (valid.length >= 5) {
      const best = valid.reduce((x, y) => (y.a > x.a ? y : x));
      const worst = valid.reduce((x, y) => (y.a < x.a ? y : x));
      if (best.a - worst.a >= 15) {
        out.push({ id: 'weekday', emoji: '📅', tone: 'tip', weight: 65, text: `Best day: ${WEEKDAYS[best.d]} (${Math.round(best.a)}%). Toughest: ${WEEKDAYS[worst.d]} (${Math.round(worst.a)}%).` });
      }
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}
