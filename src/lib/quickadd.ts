/**
 * Quick add in plain English: "Book dentist fri 3pm", "Essay due 12 oct !", "Haircut every 2 weeks #home",
 * "Sort out phone contract someday". Pulls out the day, time, repeat, star and list, and leaves the title.
 * Nothing here is final — the add box shows what it understood, and you can drop any of it with a tap.
 */
import dayjs from 'dayjs';
import { addDays, diffDays, fmt, weekday, type DateKey } from './dates';
import type { TodoList } from './types';

export type ChipKind = 'date' | 'time' | 'repeat' | 'important' | 'list';

export interface ParsedTodo {
  title: string;
  /** undefined = not mentioned; null = someday. */
  date?: DateKey | null;
  time?: string;
  repeat?: number;
  important?: boolean;
  list?: string;
  /** What was understood, in a readable form, for the preview chips. */
  chips: { kind: ChipKind; label: string }[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS: [RegExp, number][] = [
  [/^sun/, 0],
  [/^mon/, 1],
  [/^tue/, 2],
  [/^wed/, 3],
  [/^thu/, 4],
  [/^fri/, 5],
  [/^sat/, 6],
];
const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (word: string) => DAYS.find(([re]) => re.test(word.toLowerCase()))?.[1] ?? null;
const num = (s: string) => NUMBERS[s.toLowerCase()] ?? Number(s);

/** Little words that only made sense next to a date ("due", "on", "by"…), cleaned off the title. */
const CUE = String.raw`(?:(?:on|by|due|before|for|from|at|this)\s+)?`;

function validDate(y: number, m: number, d: number): DateKey | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const key = `${y}-${pad(m)}-${pad(d)}`;
  return dayjs(key).format('YYYY-MM-DD') === key ? key : null;
}

/** The soonest `wd` on or after today (`next` = the one in the week after). */
function nextWeekday(today: DateKey, wd: number, next: boolean): DateKey {
  let d = addDays(today, (wd - weekday(today) + 7) % 7);
  if (next) {
    // "next friday" means the friday of next week, not the one coming up in this one.
    const daysToMonday = (8 - weekday(today)) % 7 || 7;
    if (diffDays(d, today) < daysToMonday) d = addDays(d, 7);
  }
  return d;
}

/** "Friday", "Tomorrow", "Sat 3 Jan 2027"… */
export function dayLabel(date: DateKey, today: DateKey): string {
  const n = diffDays(date, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return fmt(date, 'dddd');
  return fmt(date, date.slice(0, 4) === today.slice(0, 4) ? 'ddd D MMM' : 'ddd D MMM YYYY');
}

export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

export function repeatLabel(days: number): string {
  if (days === 1) return 'every day';
  if (days === 7) return 'every week';
  if (days === 14) return 'every 2 weeks';
  if (days === 30) return 'every month';
  if (days % 30 === 0) return `every ${days / 30} months`;
  if (days % 7 === 0) return `every ${days / 7} weeks`;
  return `every ${days} days`;
}

/** `ignore`: bits you've said aren't meant that way (tapped ✕ on the chip) — those words stay in the title. */
export function parseTodo(input: string, today: DateKey, lists: TodoList[] = [], ignore: ChipKind[] = []): ParsedTodo {
  let text = ` ${input} `;
  const out: ParsedTodo = { title: '', chips: [] };
  const skip = new Set(ignore);
  let kind: ChipKind = 'important';
  /** Find, remember and cut out the first match of `re`. */
  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean | void) => {
    if (skip.has(kind)) return;
    const m = re.exec(text);
    if (!m) return;
    if (fn(m) === false) return;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
  };
  const setDate = (d: DateKey | null) => {
    if (out.date !== undefined) return false;
    out.date = d;
    return true;
  };

  // Starred: a standalone "!" (or a title ending in "!")
  take(/(?:\s!{1,3}(?=\s)|!+\s*$)/, () => void (out.important = true));

  // A list: "#home" (only if it matches one of your lists)
  kind = 'list';
  take(/\s#([\p{L}\p{N}_-]+)/u, (m) => {
    const tag = m[1].toLowerCase();
    const list =
      lists.find((l) => l.id.toLowerCase() === tag || l.name.toLowerCase() === tag) ??
      lists.find((l) => tag.length >= 2 && l.name.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(tag)));
    if (!list) return false;
    out.list = list.id;
  });

  // Repeats
  kind = 'repeat';
  const repeats: [RegExp, (m: RegExpExecArray) => number][] = [
    [/\bevery\s+other\s+day\b/i, () => 2],
    [/\b(?:every\s+day|everyday|daily)\b/i, () => 1],
    [/\bevery\s+(\d+|two|three|four|five|six)\s+days?\b/i, (m) => num(m[1])],
    [/\b(?:every\s+other\s+week|every\s+fortnight|fortnightly)\b/i, () => 14],
    [/\bevery\s+(\d+|two|three|four|five|six)\s+weeks?\b/i, (m) => num(m[1]) * 7],
    [/\b(?:every\s+week|weekly)\b/i, () => 7],
    [/\bevery\s+(\d+|two|three|four|five|six)\s+months?\b/i, (m) => num(m[1]) * 30],
    [/\b(?:every\s+month|monthly)\b/i, () => 30],
  ];
  for (const [re, days] of repeats) {
    if (out.repeat) break;
    take(re, (m) => {
      const n = days(m);
      if (!(n >= 1 && n <= 365)) return false;
      out.repeat = n;
    });
  }
  // "every friday" = weekly, starting this friday
  if (!out.repeat) {
    take(/\bevery\s+(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i, (m) => {
      out.repeat = 7;
      if (!skip.has('date')) setDate(nextWeekday(today, dayOf(m[1])!, false));
    });
  }

  // Someday
  kind = 'date';
  take(new RegExp(String.raw`\s${CUE}(?:someday|some\s+day|sometime|no\s+date|whenever)\b`, 'i'), () => setDate(null));

  // Times: "3pm", "3:30pm", "15:30", "at 9", "noon"
  kind = 'time';
  take(/\b(?:at\s+)?(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?(?=\W|$)/i, (m) => {
    let h = Number(m[1]);
    if (h < 1 || h > 12 || Number(m[2]) > 59) return false;
    h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
    out.time = `${pad(h)}:${m[2]}`;
  });
  if (!out.time) {
    take(/\b(?:at\s+)?(\d{1,2})\s*([ap])\.?m\.?(?=\W|$)/i, (m) => {
      const h = Number(m[1]);
      if (h < 1 || h > 12) return false;
      out.time = `${pad((h % 12) + (m[2].toLowerCase() === 'p' ? 12 : 0))}:00`;
    });
  }
  if (!out.time) {
    // "15:30" anywhere; "15.30" only after "at" (so "version 2.10" stays a title)
    take(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b(?![:/]\d)/, (m) => void (out.time = `${pad(Number(m[1]))}:${m[2]}`));
  }
  if (!out.time) {
    take(/\bat\s+([01]?\d|2[0-3])\.([0-5]\d)\b(?![./]\d)/i, (m) => void (out.time = `${pad(Number(m[1]))}:${m[2]}`));
  }
  if (!out.time) {
    take(/\bat\s+(\d{1,2})\b(?!\s*(?:days?|weeks?|months?|[/:.]))/i, (m) => {
      const h = Number(m[1]);
      if (h < 1 || h > 12) return false;
      // "at 7" is probably the morning, "at 3" the afternoon.
      out.time = `${pad(h <= 6 ? h + 12 : h)}:00`;
    });
  }
  if (!out.time) take(/\b(?:at\s+)?(?:noon|midday)\b/i, () => void (out.time = '12:00'));

  // Dates: "12 oct", "12th of October 2026", "oct 12", "12/10", "the 5th"
  kind = 'date';
  const year = Number(today.slice(0, 4));
  const later = (d: DateKey | null, explicitYear: boolean) => (d && !explicitYear && d < today ? null : d);
  const withYear = (y: string | undefined, m: number, d: number) => {
    const y0 = y ? (Number(y) < 100 ? 2000 + Number(y) : Number(y)) : year;
    const first = validDate(y0, m, d);
    return later(first, !!y) ?? (y ? first : validDate(y0 + 1, m, d));
  };
  const MON = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?`;
  take(new RegExp(String.raw`\s${CUE}(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MON}(?:\s+(\d{4}))?(?=\W|$)`, 'i'), (m) => {
    const d = withYear(m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, Number(m[1]));
    return d ? setDate(d) : false;
  });
  take(new RegExp(String.raw`\s${CUE}${MON}\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?(?=\W|$)`, 'i'), (m) => {
    const d = withYear(m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, Number(m[2]));
    return d ? setDate(d) : false;
  });
  take(new RegExp(String.raw`\s${CUE}(\d{1,2})/(\d{1,2})(?:/(\d{2}|\d{4}))?(?=\W|$)`, 'i'), (m) => {
    const d = withYear(m[3], Number(m[2]), Number(m[1])); // UK: day/month
    return d ? setDate(d) : false;
  });
  take(new RegExp(String.raw`\s${CUE}the\s+(\d{1,2})(?:st|nd|rd|th)\b`, 'i'), (m) => {
    const [y, mo] = today.split('-').map(Number);
    const d = later(validDate(y, mo, Number(m[1])), false) ?? validDate(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, Number(m[1]));
    return d ? setDate(d) : false;
  });

  // Relative days
  take(new RegExp(String.raw`\s${CUE}(?:the\s+)?day\s+after\s+tomorrow\b`, 'i'), () => setDate(addDays(today, 2)));
  take(new RegExp(String.raw`\s${CUE}(?:tomorrow|tmrw|tmr|tomoz|2moro)\b`, 'i'), () => setDate(addDays(today, 1)));
  take(new RegExp(String.raw`\s${CUE}(?:today|tonight)\b`, 'i'), () => setDate(today));
  take(new RegExp(String.raw`\s${CUE}next\s+weekend\b`, 'i'), () => setDate(addDays(nextWeekday(today, 6, false), 7)));
  take(new RegExp(String.raw`\s${CUE}(?:this\s+)?weekend\b`, 'i'), () => setDate([0, 6].includes(weekday(today)) ? today : nextWeekday(today, 6, false)));
  take(new RegExp(String.raw`\s${CUE}next\s+week\b`, 'i'), () => setDate(nextWeekday(today, 1, true)));
  take(new RegExp(String.raw`\s${CUE}next\s+month\b`, 'i'), () => setDate(dayjs(today).add(1, 'month').startOf('month').format('YYYY-MM-DD')));
  take(/\bin\s+a\s+fortnight\b/i, () => setDate(addDays(today, 14)));
  take(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|weeks?|months?)\b/i, (m) => {
    const n = num(m[1]);
    if (!(n >= 1 && n <= 365)) return false;
    const unit = m[2].toLowerCase();
    return setDate(unit.startsWith('month') ? dayjs(today).add(n, 'month').format('YYYY-MM-DD') : addDays(today, unit.startsWith('week') ? n * 7 : n));
  });

  // Weekdays. Full names anywhere; short ones ("sat", "sun", "wed") only at the end or after "on"/"next",
  // so "sun cream" stays a title.
  take(new RegExp(String.raw`\s${CUE}(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b`, 'i'), (m) => setDate(nextWeekday(today, dayOf(m[2])!, !!m[1])));
  const SHORT = String.raw`(mon|tues?|weds?|thu(?:rs?)?|fri|sat|sun)`;
  take(new RegExp(String.raw`\s(?:(?:on|by|due|this)\s+|(next)\s+)${SHORT}\.?(?=\W|$)`, 'i'), (m) => setDate(nextWeekday(today, dayOf(m[2])!, !!m[1])));
  take(new RegExp(String.raw`\s${SHORT}\.?\s*$`, 'i'), (m) => setDate(nextWeekday(today, dayOf(m[1])!, false)));

  out.title = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:on|by|due|before|for|from|at|in|this|next|every)\b\s*)+/i, '')
    .replace(/(?:[\s,;–-]+(?:on|by|due|before|for|from|at|in|this|next|every))+$/i, '')
    .replace(/[\s,;:–-]+$/, '')
    .trim();

  if (out.date !== undefined) out.chips.push({ kind: 'date', label: out.date ? dayLabel(out.date, today) : 'Someday' });
  if (out.time) out.chips.push({ kind: 'time', label: timeLabel(out.time) });
  if (out.repeat) out.chips.push({ kind: 'repeat', label: repeatLabel(out.repeat) });
  if (out.important) out.chips.push({ kind: 'important', label: 'Starred' });
  if (out.list) {
    const l = lists.find((x) => x.id === out.list)!;
    out.chips.push({ kind: 'list', label: `${l.emoji} ${l.name}` });
  }
  return out;
}
