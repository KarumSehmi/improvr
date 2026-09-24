import { describe, expect, it } from 'vitest';
import { judgeSleep, localDate, parseTime } from '../../api/health';

describe('Apple Watch sleep endpoint', () => {
  it('reads times however the Shortcut formats them', () => {
    expect(parseTime('00:42')).toBe('00:42');
    expect(parseTime('8:05')).toBe('08:05');
    expect(parseTime('24 Sep 2026 at 23:50')).toBe('23:50');
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime(undefined)).toBeNull();
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
});
