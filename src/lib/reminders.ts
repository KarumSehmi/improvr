/**
 * iPhone won't let a website send notifications without a server, so instead we hand your
 * Calendar app a set of repeating events with alerts. Calendar then does the notifying.
 */
import { createEvents, type DateArray, type EventAttributes } from 'ics';
import { DEFAULT_REMINDERS, habitsFor } from './config';
import { addDays, dateKey, weekday, type DateKey } from './dates';
import type { Summary } from './engine';
import type { Birthday, Settings } from './types';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function at(date: DateKey, time: string): DateArray {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return [y, m, d, hh, mm];
}

function daily(uid: string, title: string, description: string, time: string, today: DateKey): EventAttributes {
  // Times after midnight (e.g. 00:15) belong to "tonight", so start them tomorrow.
  const start = time < '04:00' ? addDays(today, 1) : today;
  return {
    uid: `${uid}@improvr`,
    title,
    description,
    start: at(start, time),
    startInputType: 'local',
    startOutputType: 'local',
    duration: { minutes: 5 },
    recurrenceRule: 'FREQ=DAILY',
    busyStatus: 'FREE',
    transp: 'TRANSPARENT',
    alarms: [{ action: 'display', description: title, trigger: { minutes: 0, before: true } }],
  };
}

export function buildReminders(settings: Settings, summary: Summary, birthdays: Record<string, Birthday>, today: DateKey = dateKey()): string {
  const r = { ...DEFAULT_REMINDERS, ...settings.reminders };
  const events: EventAttributes[] = [
    daily('morning', '🌅 Morning check-in', 'Weigh in, pills, face wash. Open Improvr.', r.morning, today),
    daily('caffeine', '☕ Caffeine cutoff at 2pm', 'Last coffee now.', r.caffeine, today),
    daily('lockin', '🔒 Lock in today on Improvr', `Answer honestly, write your note, lock it in. Miss the deadline and it's £${settings.fineAmount} to charity.`, r.lockIn, today),
    daily('bedtime', '🌙 Bed by 1am', 'Phone down. Face routine. Lights off.', r.bedtime, today),
  ];

  if (r.weeklyJobs) {
    for (const h of habitsFor(settings)) {
      const s = h.schedule;
      if (h.kind !== 'chore' || !s || 'every' in s) continue;
      // First real occurrence from today (an overdue one just rolls forward to its next slot).
      let first = summary.tracks[h.id]?.nextDue ?? today;
      while (first < today) first = addDays(first, 7 * (s.everyWeeks ?? 1));
      const interval = s.everyWeeks && s.everyWeeks > 1 ? `;INTERVAL=${s.everyWeeks}` : '';
      events.push({
        uid: `job-${h.id}@improvr`,
        title: `${h.emoji} ${h.label}`,
        description: 'From Improvr — it carries over until you do it.',
        start: at(first, '10:00'),
        startInputType: 'local',
        startOutputType: 'local',
        duration: { minutes: 30 },
        recurrenceRule: `FREQ=WEEKLY${interval};BYDAY=${BYDAY[s.weekday]}`,
        busyStatus: 'FREE',
        alarms: [{ action: 'display', description: h.label, trigger: { minutes: 0, before: true } }],
      });
    }
    events.push({
      uid: 'weekly-review@improvr',
      title: '📊 Weekly review on Improvr',
      description: 'How did the week go? Pick one habit to focus on next week.',
      start: at(addDays(today, (7 - weekday(today)) % 7), '19:00'),
      startInputType: 'local',
      startOutputType: 'local',
      duration: { minutes: 10 },
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
      alarms: [{ action: 'display', description: 'Weekly review', trigger: { minutes: 0, before: true } }],
    });
  }

  if (r.birthdays) {
    const year = Number(today.slice(0, 4));
    for (const b of Object.values(birthdays)) {
      events.push({
        uid: `bday-${b.id}@improvr`,
        title: `🎂 ${b.name}'s birthday`,
        start: [year, b.month, b.day],
        duration: { days: 1 },
        recurrenceRule: 'FREQ=YEARLY',
        busyStatus: 'FREE',
        alarms: [
          { action: 'display', description: `${b.name}'s birthday tomorrow`, trigger: { hours: 6, before: true } },
          { action: 'display', description: `${b.name}'s birthday today`, trigger: { hours: 9, before: false } },
        ],
      });
    }
  }

  const { error, value } = createEvents(events, { calName: 'Improvr', productId: 'improvr' });
  if (error || !value) throw error ?? new Error('Could not build calendar file');
  // The library writes a zero offset as "-PT", which Calendar rejects. Alert exactly at the start instead.
  return value.replace(/TRIGGER:-PT\r\n/g, 'TRIGGER:-PT0M\r\n');
}

export function downloadReminders(ics: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'improvr-reminders.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
