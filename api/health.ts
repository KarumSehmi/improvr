/**
 * Vercel function: your iPhone Shortcut posts last night's Apple Watch sleep here each morning,
 * and it fills in "Asleep before 1am" and "Up before 9am" for you, with the actual times.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT in Vercel → Settings → Environment Variables (same JSON as the GitHub secret).
 * Imports end in .js so Node can run the compiled files on Vercel.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SLEEP_TARGETS, clockLabel, sleepTargets } from '../src/lib/config.js';
import type { Settings } from '../src/lib/types.js';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Every time in the text, as minutes past midnight. Handles "00:42", "12:42 am" and the list the
 * Shortcut sends when you pass all the Watch's sleep samples ("24 Sep 2026 at 23:41\n25 Sep 2026 at 00:10…").
 */
export function parseTimes(value: unknown): number[] {
  const out: number[] = [];
  for (const m of String(value ?? '').matchAll(/(\d{1,2})[:.](\d{2})(?:\s*([ap])\.?\s?m\.?)?/gi)) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    if (m[3]) {
      if (h < 1 || h > 12) continue;
      h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
    }
    if (h > 23 || min > 59) continue;
    out.push(h * 60 + min);
  }
  return out;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Date + time of one sample as minutes on a simple local timeline (null if there's no readable date).
 * Handles ISO ("2026-09-24T23:41:00+01:00"), UK ("24 Sep 2026 at 23:41", "24/09/2026, 23:41")
 * and US ("Sep 24, 2026 at 11:41 PM") formats — whatever the phone's Shortcuts uses.
 */
export function parseStamp(text: string): number | null {
  const time = parseTimes(text)[0];
  if (time == null) return null;
  let y = 0;
  let m = 0;
  let d = 0;
  let x: RegExpExecArray | null;
  if ((x = /(\d{4})-(\d{2})-(\d{2})/.exec(text))) {
    [y, m, d] = [Number(x[1]), Number(x[2]), Number(x[3])];
  } else if ((x = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/.exec(text))) {
    const [a, b] = [Number(x[1]), Number(x[2])];
    y = Number(x[3]) < 100 ? 2000 + Number(x[3]) : Number(x[3]);
    [d, m] = b > 12 ? [b, a] : [a, b]; // UK order unless that's impossible
  } else {
    const month = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?/i.exec(text);
    const year = /\b(20\d{2})\b/.exec(text);
    if (!month || !year) return null;
    m = MONTHS.indexOf(month[1].toLowerCase()) + 1;
    y = Number(year[1]);
    const before = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?$/i.exec(text.slice(0, month.index)); // "24 Sep"
    const after = /^\s*(\d{1,2})\b/.exec(text.slice(month.index + month[0].length)); // "Sep 24"
    d = Number(before?.[1] ?? after?.[1] ?? 0);
  }
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, m - 1, d) / 60_000 + time;
}

// Without dates, evening times (6pm onwards) count as "before midnight" so they sort before 00:xx.
const toNight = (m: number) => (m >= 18 * 60 ? m - 24 * 60 : m);
const toClock = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`;
};

/** A night is lots of back-to-back samples; a gap longer than this starts a new block (e.g. a nap). */
const GAP_MIN = 180;
/** Blocks shorter than this are naps. */
const MIN_NIGHT = 3 * 60;

/**
 * Works out last night from every sleep sample the Shortcut sends (one per line; the Nth start goes with
 * the Nth end). The samples can cover more than last night — "in the last 1 day" also catches yesterday's
 * lie-in or a nap — so they're joined into blocks and the most recent proper night wins.
 */
export function readNight(asleep: unknown, awake: unknown): { asleep: string; awake: string } | null {
  const lines = (v: unknown) => String(v ?? '').split(/\r?\n/).filter((l) => l.trim());
  const startLines = lines(asleep);
  const endLines = lines(awake);
  const startStamps = startLines.map(parseStamp);
  const endStamps = endLines.map(parseStamp);
  const dated = [...startStamps, ...endStamps].every((t) => t != null);

  // Minutes on a timeline: real dates if we have them, otherwise clock times with the evening before midnight.
  const starts = dated ? (startStamps as number[]) : parseTimes(asleep).map(toNight);
  const ends = dated ? (endStamps as number[]) : parseTimes(awake).map(toNight);
  if (!starts.length || !ends.length) return null;

  // Lists don't line up (shouldn't happen) — fall back to earliest start / latest end.
  if (starts.length !== ends.length) return { asleep: toClock(Math.min(...starts)), awake: toClock(Math.max(...ends)) };

  const samples = starts.map((s, i) => ({ s, e: Math.max(s, ends[i]) })).sort((a, b) => a.s - b.s);
  const blocks: { s: number; e: number }[] = [];
  for (const x of samples) {
    const last = blocks[blocks.length - 1];
    if (last && x.s <= last.e + GAP_MIN) last.e = Math.max(last.e, x.e);
    else blocks.push({ ...x });
  }
  const nights = blocks.filter((b) => b.e - b.s >= MIN_NIGHT);
  const night = nights[nights.length - 1] ?? blocks.reduce((a, b) => (b.e - b.s > a.e - a.s ? b : a));
  return { asleep: toClock(night.s), awake: toClock(night.e) };
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * "Before 1am" = any time in the evening or after midnight but before 1am. "Before 9am" = woke before 09:00.
 * At the weekend the targets are later (2am / 10:30 by default).
 */
export function judgeSleep(asleep: string, awake: string, targets: { sleep: string; wake: string } = SLEEP_TARGETS.weekday): { sleepOk: boolean; wakeOk: boolean } {
  const a = minutesOf(asleep);
  return { sleepOk: a >= 12 * 60 || a < minutesOf(targets.sleep), wakeOk: minutesOf(awake) < minutesOf(targets.wake) };
}

/**
 * Fill a day in from the Watch: both answers and the actual times. The Watch is the source of truth,
 * so this overwrites whatever was there when it syncs (you can still change it by hand afterwards).
 */
export function mergeSleep(day: Record<string, unknown>, asleep: string, awake: string, at: number, targets = SLEEP_TARGETS.weekday): Record<string, unknown> {
  const { sleepOk, wakeOk } = judgeSleep(asleep, awake, targets);
  // Tick times let the app race yesterday's pace.
  const doneAt = { ...(day.doneAt as Record<string, number>) };
  for (const [id, ok] of [['sleep', sleepOk], ['wake', wakeOk]] as const) {
    if (!ok) delete doneAt[id];
    else doneAt[id] ??= at;
  }
  return {
    ...day,
    done: { ...(day.done as object), sleep: sleepOk, wake: wakeOk },
    times: { ...(day.times as object), sleep: asleep, wake: awake },
    doneAt,
    sleepAuto: { asleep, awake, at },
    updatedAt: at,
  };
}

/** Today's date (YYYY-MM-DD) in the given time zone. */
export function localDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send a POST from the Shortcut.' });
  let body = req.body as Record<string, unknown> | string | undefined;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as Record<string, unknown>;
    } catch {
      body = undefined;
    }
  }
  const fields = (body ?? {}) as Record<string, unknown>;
  const [uid, secret] = String(fields.key ?? '').split('.');
  if (!uid || !secret) {
    // Common mix-up: pasting the key into the left (name) box instead of the right (value) box.
    const misplaced = Object.keys(fields).some((k) => k.length > 30 && k.includes('.'));
    return res.status(400).json({
      error: misplaced
        ? 'Your key is in the wrong box. In Get Contents of URL the left box should say key, and your long code goes in the right box.'
        : 'Missing "key" field — copy your key from Improvr → More → Apple Watch sleep.',
    });
  }
  const night = readNight(fields.asleep, fields.awake);
  if (!night) {
    return res.status(400).json({ error: 'Couldn\'t find any times in "asleep" / "awake". Set them to Health Samples → Start Date and End Date.' });
  }
  const { asleep, awake } = night;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) return res.status(500).json({ error: 'Server not set up: add FIREBASE_SERVICE_ACCOUNT in Vercel.' });
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  const db = getFirestore();

  const priv = await db.doc(`users/${uid}/meta/private`).get();
  if (!priv.exists || priv.get('shortcutSecret') !== secret) return res.status(401).json({ error: 'Wrong key.' });

  const settings = (await db.doc(`users/${uid}/meta/settings`).get()).data() ?? {};
  const date = localDate((settings.timeZone as string) || 'Europe/London');
  const targets = sleepTargets(settings as Settings, date);
  const { sleepOk, wakeOk } = judgeSleep(asleep, awake, targets);
  const ref = db.doc(`users/${uid}/days/${date}`);
  const at = Date.now();

  await db.runTransaction(async (t) => {
    const day = (await t.get(ref)).data() ?? {};
    t.set(ref, mergeSleep(day, asleep, awake, at, targets));
  });
  await db.doc(`users/${uid}/meta/server`).set({ lastSleep: { date, asleep, awake, at } }, { merge: true });

  return res.status(200).json({ ok: true, date, [`asleepBefore${clockLabel(targets.sleep)}`]: sleepOk, [`upBefore${clockLabel(targets.wake)}`]: wakeOk });
}
