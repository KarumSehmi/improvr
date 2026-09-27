/**
 * Are you actually getting better? Scores over time (smoothed with a 7-day average so one bad
 * day doesn't hide the trend), a habit's last week as dots, and your personal bests.
 */
import { addDays, diffDays, weekStart, type DateKey } from './dates';
import { habitOutcome, isOpen, weekStats, type DayEval, type Summary } from './engine';

export interface TrendPoint {
  date: DateKey;
  /** Score once the day is finished (locked in, or past its logging window); null on a day off. */
  score: number | null;
  /** Average of the finished days in the 7 ending here (null until there are 3 of them). */
  avg: number | null;
}

export interface Trend {
  points: TrendPoint[];
  /** Average score over the last 28 finished days, and the 28 before that. */
  recent: number | null;
  previous: number | null;
  /** Number of finished days with a score in the window. */
  scored: number;
}

/** A day only counts once it's done with: locked in, or its logging window has passed. */
export function finishedScore(e: DayEval | undefined, today: DateKey): number | null {
  if (!e || e.dayOff || e.pct == null) return null;
  return e.closed || !isOpen(e.date, today) ? e.pct : null;
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function scoreTrend(summary: Summary, days = 56): Trend {
  const { today, evalByDate } = summary;
  const score = (d: DateKey) => finishedScore(evalByDate[d], today);
  const from = addDays(today, -(days - 1));
  const points: TrendPoint[] = [];
  let scored = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const s = score(date);
    if (s != null) scored++;
    const window: number[] = [];
    for (let k = 6; k >= 0; k--) {
      const v = score(addDays(date, -k));
      if (v != null) window.push(v);
    }
    points.push({ date, score: s, avg: window.length >= 3 ? mean(window) : null });
  }
  const block = (start: DateKey, n: number) => {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = score(addDays(start, i));
      if (v != null) xs.push(v);
    }
    return xs.length >= 5 ? mean(xs) : null;
  };
  return { points, recent: block(addDays(today, -27), 28), previous: block(addDays(today, -55), 28), scored };
}

export interface PersonalBests {
  bestDay: { date: DateKey; pct: number } | null;
  bestWeek: { start: DateKey; avg: number } | null;
  mostXp: { date: DateKey; xp: number } | null;
  longestLog: number;
}

export function personalBests(summary: Summary): PersonalBests {
  const { today, evals } = summary;
  let bestDay: PersonalBests['bestDay'] = null;
  let mostXp: PersonalBests['mostXp'] = null;
  for (const e of evals) {
    const pct = finishedScore(e, today);
    // Ties go to the most recent day — that's the one to be proud of.
    if (pct != null && (!bestDay || pct >= bestDay.pct)) bestDay = { date: e.date, pct };
    if (!e.dayOff && (e.closed || !isOpen(e.date, today)) && (!mostXp || e.points >= mostXp.xp)) mostXp = { date: e.date, xp: e.points };
  }
  let bestWeek: PersonalBests['bestWeek'] = null;
  const weeks = new Set(evals.map((e) => weekStart(e.date)));
  for (const w of weeks) {
    if (diffDays(today, addDays(w, 6)) < 1) continue; // not finished yet
    const st = weekStats(summary, w);
    if (st.days === 7 && st.avgPct != null && (!bestWeek || st.avgPct >= bestWeek.avg)) bestWeek = { start: w, avg: st.avgPct };
  }
  return { bestDay, bestWeek, mostXp, longestLog: summary.logStreak.best };
}

export type HistoryState = 'done' | 'missed' | 'open' | 'none' | 'off';

/** A habit's last `n` days (today last): done, missed, still open, not due, or a day off. */
export function habitHistory(summary: Summary, habitId: string, n = 7): { date: DateKey; state: HistoryState }[] {
  const idx = summary.habits.findIndex((h) => h.id === habitId);
  const out: { date: DateKey; state: HistoryState }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(summary.today, -i);
    const e = summary.evalByDate[date];
    const item = e?.items[idx];
    let state: HistoryState = 'none';
    if (!e || !item || !item.visible) state = 'none';
    else if (e.dayOff) state = item.done ? 'done' : 'off';
    else {
      const open = isOpen(date, summary.today);
      const o = habitOutcome(item, e, open);
      state = o === 'success' ? 'done' : o === 'fail' ? 'missed' : item.required && open ? 'open' : 'none';
    }
    out.push({ date, state });
  }
  return out;
}
