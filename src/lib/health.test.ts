import { describe, expect, it } from 'vitest';
import handler, { judgeSleep, localDate, parseTimes, readNight } from '../../api/health';

describe('Apple Watch sleep endpoint', () => {
  it('reads times however the Shortcut formats them', () => {
    expect(parseTimes('00:42')).toEqual([42]);
    expect(parseTimes('24 Sep 2026 at 23:50')).toEqual([23 * 60 + 50]);
    expect(parseTimes('12:42 am')).toEqual([42]);
    expect(parseTimes('8:05 PM')).toEqual([20 * 60 + 5]);
    expect(parseTimes('25:00')).toEqual([]);
    expect(parseTimes(undefined)).toEqual([]);
  });

  it('works out the night from all the sleep samples, in any order', () => {
    // What Shortcuts sends for "Health Samples → Start Date / End Date" (one per line)
    const starts = '25 Sep 2026 at 02:10\n24 Sep 2026 at 23:41\n25 Sep 2026 at 04:55';
    const ends = '25 Sep 2026 at 02:40\n25 Sep 2026 at 01:05\n25 Sep 2026 at 08:12';
    expect(readNight(starts, ends)).toEqual({ asleep: '23:41', awake: '08:12' });
    expect(readNight('12:30 am\n3:10 am', '3:00 am\n9:20 am')).toEqual({ asleep: '00:30', awake: '09:20' });
    expect(readNight('00:42', '08:15')).toEqual({ asleep: '00:42', awake: '08:15' });
    expect(readNight('', '08:15')).toBeNull();
  });

  it('judges before 1am / before 9am', () => {
    expect(judgeSleep('23:40', '08:10')).toEqual({ sleepOk: true, wakeOk: true });
    expect(judgeSleep('00:59', '08:59')).toEqual({ sleepOk: true, wakeOk: true });
    expect(judgeSleep('01:00', '09:00')).toEqual({ sleepOk: false, wakeOk: false });
    expect(judgeSleep('02:30', '10:15')).toEqual({ sleepOk: false, wakeOk: false });
  });

  it("uses the phone's time zone for the date", () => {
    const lateUtc = new Date('2026-09-24T23:30:00Z');
    expect(localDate('Europe/London', lateUtc)).toBe('2026-09-25'); // BST
    expect(localDate('UTC', lateUtc)).toBe('2026-09-24');
  });

  it('explains a key pasted into the wrong box', async () => {
    let out: { code: number; body: { error?: string } } | null = null;
    const res = { status: (code: number) => ({ json: (body: { error?: string }) => void (out = { code, body }) }) };
    await handler({ method: 'POST', body: { 'abc123uid.0123456789abcdef0123456789': '', asleep: '00:42', awake: '08:15' } }, res as never);
    expect(out!.code).toBe(400);
    expect(out!.body.error).toMatch(/wrong box/);
  });
});
