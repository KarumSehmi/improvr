import { describe, expect, it } from 'vitest';
import { defaultSettings } from './config';
import { breathAt, cravingPeak, logUrge } from './cravings';
import { startOfDay } from './dates';
import { summarize } from './engine';
import { insights } from './insights';
import type { DayLog } from './types';

const settings = defaultSettings('2026-09-01');
const at = (date: string, hh: number) => startOfDay(date) + hh * 3_600_000;

describe('craving SOS', () => {
  it('guides breathing: in 4, hold 4, out 6', () => {
    expect(breathAt(0)).toMatchObject({ phase: 'Breathe in', left: 4 });
    expect(breathAt(5)).toMatchObject({ phase: 'Hold', left: 3 });
    expect(breathAt(9)).toMatchObject({ phase: 'Breathe out', left: 5 });
    expect(breathAt(14)).toMatchObject({ phase: 'Breathe in', left: 4 }); // round again
  });

  it('beating a craving counts it and remembers when', () => {
    const l: DayLog = { urges: { vape: 1 } };
    logUrge(l, 'vape', 123);
    expect(l).toMatchObject({ urges: { vape: 2 }, urgeAt: { vape: [123] } });
  });

  it('spots when cravings usually hit', () => {
    const days: Record<string, DayLog> = {};
    ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'].forEach((d, i) => {
      days[d] = { urgeAt: { vape: [at(d, 22), ...(i === 0 ? [at(d, 10)] : [])] } };
    });
    const s = summarize({ days, events: {}, birthdays: {}, payments: {}, todos: {}, spending: {}, settings }, '2026-09-25');
    expect(cravingPeak(s, 'vape')).toEqual({ label: 'late at night', count: 5, total: 6 });
    expect(cravingPeak(s, 'porn')).toBeNull();
    expect(insights(s).find((i) => i.id === 'craving-vape')?.text).toBe('Most nicotine cravings hit late at night (5 of 6). Plan something for then.');
  });
});
