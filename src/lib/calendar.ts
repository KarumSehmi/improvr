import { diffDays, type DateKey } from './dates';
import type { Birthday, CalEvent } from './types';

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function birthdayInYear(b: Birthday, year: number): DateKey {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return `${year}-${String(b.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface UpcomingBirthday {
  birthday: Birthday;
  date: DateKey;
  daysAway: number;
  turning: number | null;
}

export function nextBirthday(b: Birthday, today: DateKey): UpcomingBirthday {
  const year = Number(today.slice(0, 4));
  let date = birthdayInYear(b, year);
  if (date < today) date = birthdayInYear(b, year + 1);
  const y = Number(date.slice(0, 4));
  return { birthday: b, date, daysAway: diffDays(date, today), turning: b.year ? y - b.year : null };
}

export function upcomingBirthdays(birthdays: Record<string, Birthday>, today: DateKey, withinDays = 366): UpcomingBirthday[] {
  return Object.values(birthdays)
    .map((b) => nextBirthday(b, today))
    .filter((u) => u.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway || a.birthday.name.localeCompare(b.birthday.name));
}

export function birthdaysOn(birthdays: Record<string, Birthday>, date: DateKey): Birthday[] {
  const year = Number(date.slice(0, 4));
  return Object.values(birthdays).filter((b) => birthdayInYear(b, year) === date);
}

export function eventsOn(events: Record<string, CalEvent>, date: DateKey): CalEvent[] {
  return Object.values(events)
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
}

export function eventsBetween(events: Record<string, CalEvent>, from: DateKey, to: DateKey): CalEvent[] {
  return Object.values(events)
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
}

export const EVENT_COLORS = ['violet', 'blue', 'teal', 'orange', 'pink', 'red', 'yellow', 'gray'];
