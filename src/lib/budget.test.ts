import { describe, expect, it } from 'vitest';
import { budgetMessage, budgetStatus, cardMonth, pastMonths } from './budget';
import { defaultSettings } from './config';
import { summarize } from './engine';
import { dueNudges } from './nudges';
import type { Settings, SpendEntry } from './types';

const settings: Settings = defaultSettings('2026-09-01');
const entries = (...xs: [string, number][]) => Object.fromEntries(xs.map(([date, spent]) => [date, { id: date, date, spent, at: 0 } as SpendEntry]));

describe('card spending', () => {
  it('works out the card month, even when it starts mid-month', () => {
    expect(cardMonth('2026-09-25')).toEqual({ start: '2026-09-01', next: '2026-10-01' });
    expect(cardMonth('2026-09-25', 15)).toEqual({ start: '2026-09-15', next: '2026-10-15' });
    expect(cardMonth('2026-09-10', 15)).toEqual({ start: '2026-08-15', next: '2026-09-15' });
    expect(cardMonth('2026-01-05', 15)).toEqual({ start: '2025-12-15', next: '2026-01-15' });
  });

  it('defaults to an £800 limit, well under £1,000', () => {
    const b = budgetStatus({}, settings, '2026-09-25');
    expect(b).toMatchObject({ state: 'no-data', limit: 800, ceiling: 1000, needsUpdate: true, totalDays: 30 });
    expect(budgetMessage(b)).toContain('£27 a day');
  });

  it('on track: shows what you can spend a day and a week for the rest of the month', () => {
    const b = budgetStatus(entries(['2026-09-14', 300]), settings, '2026-09-15');
    expect(b.state).toBe('on-track');
    expect(Math.round(b.pace)).toBe(373);
    expect(b).toMatchObject({ daysLeft: 16, left: 500, perDay: 31.25, perWeek: 218.75, needsUpdate: false });
    expect(budgetMessage(b)).toBe('✅ On track, £73 under pace. You can spend £31 a day (£219 a week) for the rest of the month.');
  });

  it('overspending: how much to spend, and how much to cut back, to make it to the end of the month', () => {
    const b = budgetStatus(entries(['2026-09-14', 500]), settings, '2026-09-15');
    expect(b.state).toBe('over-pace');
    expect(b).toMatchObject({ perDay: 18.75, perWeek: 131.25, runPerWeek: 250, cutPerWeek: 118.75 });
    expect(Math.round(b.projected)).toBe(1071);
    expect(budgetMessage(b)).toBe("⚠️ £127 ahead of pace. To finish under £800, keep it to £19 a day (£131 a week) — about £119 a week less than you've been spending.");
  });

  it('over the limit', () => {
    const b = budgetStatus(entries(['2026-09-20', 850]), settings, '2026-09-20');
    expect(b.state).toBe('over-limit');
    expect(budgetMessage(b)).toContain('£50 over your £800 limit');
    expect(budgetMessage(b)).toContain('£150 from £1,000');
  });

  it('asks for an update once a week, and last month is kept as history', () => {
    const s = entries(['2026-08-30', 760], ['2026-09-14', 300]);
    expect(budgetStatus(s, settings, '2026-09-20').needsUpdate).toBe(false);
    expect(budgetStatus(s, settings, '2026-09-21').needsUpdate).toBe(true);
    expect(budgetStatus(entries(['2026-08-30', 760]), settings, '2026-09-02').state).toBe('no-data'); // new month
    expect(pastMonths(s, settings, '2026-09-21')).toEqual([{ start: '2026-08-01', spent: 760 }]);
  });

  it('updating it earns XP, and a Sunday notification reminds you if you have not', () => {
    const data = { days: {}, events: {}, birthdays: {}, payments: {}, todos: {}, settings: defaultSettings('2026-09-21') };
    const base = summarize({ ...data, spending: {} }, '2026-09-22').evalByDate['2026-09-22'].points;
    expect(summarize({ ...data, spending: entries(['2026-09-22', 100]) }, '2026-09-22').evalByDate['2026-09-22'].points - base).toBe(10);

    const sunday = '2026-09-27';
    const summary = summarize({ ...data, spending: {} }, sunday);
    const ids = (spending: Record<string, SpendEntry>, hh = 18) => dueNudges({ summary, date: sunday, minutes: hh * 60 + 5, sent: {}, spending }).map((n) => n.id);
    expect(ids({})).toContain('spending');
    expect(ids(entries(['2026-09-25', 200]))).not.toContain('spending');
    expect(ids({}, 12)).not.toContain('spending');
  });
});
