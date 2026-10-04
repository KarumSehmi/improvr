import { describe, expect, it } from 'vitest';
import { parseTodo } from './quickadd';
import { DEFAULT_TODO_LISTS } from './todos';

const SUN = '2026-10-04'; // a Sunday
const WED = '2026-10-07';
const p = (text: string, today = SUN, ignore: Parameters<typeof parseTodo>[3] = []) => parseTodo(text, today, DEFAULT_TODO_LISTS, ignore);

describe('quick add in plain English', () => {
  it('pulls out the day and time', () => {
    expect(p('Book dentist fri 3pm')).toMatchObject({ title: 'Book dentist', date: '2026-10-09', time: '15:00' });
    expect(p('Call mum tomorrow at 6')).toMatchObject({ title: 'Call mum', date: '2026-10-05', time: '18:00' });
    expect(p('Meet Sam at 7')).toMatchObject({ title: 'Meet Sam', time: '07:00' });
    expect(p('Dentist 3.30pm')).toMatchObject({ title: 'Dentist', time: '15:30' });
    expect(p('Pay council tax 15:00')).toMatchObject({ title: 'Pay council tax', time: '15:00' });
    expect(p('Lunch with Sam at noon fri')).toMatchObject({ title: 'Lunch with Sam', time: '12:00', date: '2026-10-09' });
    expect(p('Gym tonight')).toMatchObject({ title: 'Gym', date: SUN });
    expect(p('Submit form by friday 5pm')).toMatchObject({ title: 'Submit form', date: '2026-10-09', time: '17:00' });
  });

  it('understands dates, UK style', () => {
    expect(p('Essay due 12 oct')).toMatchObject({ title: 'Essay', date: '2026-10-12' });
    expect(p('Essay due 12th of October 2027')).toMatchObject({ title: 'Essay', date: '2027-10-12' });
    expect(p('Exam 12/1')).toMatchObject({ title: 'Exam', date: '2027-01-12' }); // already passed this year
    expect(p('Pay rent on the 1st')).toMatchObject({ title: 'Pay rent', date: '2026-11-01' });
    expect(p('Renew passport in 2 weeks')).toMatchObject({ title: 'Renew passport', date: '2026-10-18' });
    expect(p('Book flights next month')).toMatchObject({ title: 'Book flights', date: '2026-11-01' });
    expect(p('Do it by tmrw')).toMatchObject({ title: 'Do it', date: '2026-10-05' });
  });

  it('"next friday" is the one next week', () => {
    expect(p('Drinks friday', WED).date).toBe('2026-10-09');
    expect(p('Drinks next friday', WED).date).toBe('2026-10-16');
    expect(p('Plan next week', WED).date).toBe('2026-10-12');
  });

  it('repeats, stars, lists and someday', () => {
    expect(p('Haircut every 2 weeks #home')).toMatchObject({ title: 'Haircut', repeat: 14, list: 'home' });
    expect(p('Haircut every friday')).toMatchObject({ title: 'Haircut', repeat: 7, date: '2026-10-09' });
    expect(p('Read every day')).toMatchObject({ title: 'Read', repeat: 1 });
    expect(p('Pay the fine !')).toMatchObject({ title: 'Pay the fine', important: true });
    expect(p('Sort out phone contract someday')).toMatchObject({ title: 'Sort out phone contract', date: null });
    expect(p('Revise #uni').list).toBe('work'); // matches "Work & uni"
    expect(p('Party #nonexistent')).toMatchObject({ title: 'Party #nonexistent' });
  });

  it("leaves ordinary words alone, and lets you say a match wasn't meant", () => {
    expect(p('Buy sun cream')).toMatchObject({ title: 'Buy sun cream' });
    expect(p('Return 3 books')).toMatchObject({ title: 'Return 3 books' });
    expect(p('Install version 2.10')).toMatchObject({ title: 'Install version 2.10' });
    expect(p('Watch tomorrow never dies', SUN, ['date'])).toMatchObject({ title: 'Watch tomorrow never dies' });
    expect(p('Watch tomorrow never dies', SUN, ['date']).date).toBeUndefined();
  });

  it('shows what it understood', () => {
    expect(p('Book dentist fri 3pm !').chips).toEqual([
      { kind: 'date', label: 'Friday' },
      { kind: 'time', label: '3pm' },
      { kind: 'important', label: 'Starred' },
    ]);
    expect(p('Haircut every 2 weeks #home someday').chips.map((c) => c.label)).toEqual(['Someday', 'every 2 weeks', '🏠 Home']);
  });
});
