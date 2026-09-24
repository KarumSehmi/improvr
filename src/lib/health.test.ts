import { describe, expect, it } from 'vitest';
import handler, { judgeSleep, localDate, mergeSleep, parseStamp, parseTimes, readNight } from '../../api/health';
import { averageClock, formatDuration, sleepMinutes } from './sleep';

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

  it('reads dates in UK, US and ISO formats', () => {
    const base = Date.UTC(2026, 8, 24) / 60_000;
    expect(parseStamp('24 Sep 2026 at 23:41')).toBe(base + 23 * 60 + 41);
    expect(parseStamp('Sep 24, 2026 at 11:41 PM')).toBe(base + 23 * 60 + 41);
    expect(parseStamp('Thursday 24 September 2026 at 23:41')).toBe(base + 23 * 60 + 41);
    expect(parseStamp('24/09/2026, 23:41')).toBe(base + 23 * 60 + 41);
    expect(parseStamp('2026-09-24T23:41:00+01:00')).toBe(base + 23 * 60 + 41);
    expect(parseStamp('23:41')).toBeNull();
  });

  it('"in the last 1 day" picks out last night, ignoring yesterday\'s lie-in and a nap', () => {
    // Samples from yesterday morning (end of the night before), an afternoon nap, then last night
    const starts = [
      '24 Sep 2026 at 08:40', '24 Sep 2026 at 09:30', // yesterday's lie-in
      '24 Sep 2026 at 15:05', // nap
      '24 Sep 2026 at 23:41', '25 Sep 2026 at 01:10', '25 Sep 2026 at 04:02', '25 Sep 2026 at 07:30',
    ].join('\n');
    const ends = [
      '24 Sep 2026 at 09:30', '24 Sep 2026 at 10:15',
      '24 Sep 2026 at 15:45',
      '25 Sep 2026 at 01:10', '25 Sep 2026 at 04:02', '25 Sep 2026 at 07:30', '25 Sep 2026 at 08:12',
    ].join('\n');
    expect(readNight(starts, ends)).toEqual({ asleep: '23:41', awake: '08:12' });
    // Same night in US format, samples in random order
    const us = (s: string) => s;
    expect(
      readNight(
        us('Sep 25, 2026 at 1:10 AM\nSep 24, 2026 at 11:41 PM\nSep 25, 2026 at 4:02 AM'),
        us('Sep 25, 2026 at 4:02 AM\nSep 25, 2026 at 1:10 AM\nSep 25, 2026 at 8:12 AM'),
      ),
    ).toEqual({ asleep: '23:41', awake: '08:12' });
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

  it('fills in both answers and the actual times, even over a manual answer', () => {
    const day = { done: { sleep: true, pills: true }, times: {}, note: 'hi' };
    const out = mergeSleep(day, '01:25', '08:40', 123) as { done: Record<string, boolean>; times: Record<string, string>; note: string };
    expect(out.done).toEqual({ sleep: false, wake: true, pills: true });
    expect(out.times).toEqual({ sleep: '01:25', wake: '08:40' });
    expect(out.note).toBe('hi');
  });

  it('works out time asleep and averages', () => {
    expect(formatDuration(sleepMinutes('23:41', '08:12'))).toBe('8h 31m');
    expect(formatDuration(sleepMinutes('00:30', '07:35'))).toBe('7h 05m');
    expect(averageClock(['23:30', '00:30'])).toBe('00:00');
    expect(averageClock([])).toBeNull();
  });
});
