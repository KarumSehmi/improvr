/** Small helpers for sleep times coming from the Apple Watch. */

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Minutes from falling asleep to waking (handles going to bed before midnight). */
export function sleepMinutes(asleep: string, awake: string): number {
  return (toMin(awake) - toMin(asleep) + 24 * 60) % (24 * 60);
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Average of clock times, treating evening times as "before midnight" (so 23:30 and 00:30 average to 00:00). */
export function averageClock(times: string[]): string | null {
  if (!times.length) return null;
  const vals = times.map((t) => {
    const m = toMin(t);
    return m >= 18 * 60 ? m - 24 * 60 : m;
  });
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const x = ((avg % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}
