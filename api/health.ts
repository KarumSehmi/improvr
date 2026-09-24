/**
 * Vercel function: your iPhone Shortcut posts last night's Apple Watch sleep here each morning,
 * and it fills in "Asleep before 1am" and "Up before 9am" for you (unless you've already answered).
 *
 * Needs FIREBASE_SERVICE_ACCOUNT in Vercel → Settings → Environment Variables (same JSON as the GitHub secret).
 * Kept self-contained on purpose — Vercel builds each /api file on its own.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

// Evening times (6pm onwards) belong to "before midnight", so they sort before 00:xx.
const toNight = (m: number) => (m >= 18 * 60 ? m - 24 * 60 : m);
const toClock = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`;
};

/** Fell asleep = earliest start, woke = latest end, whatever order the samples arrive in. */
export function readNight(asleep: unknown, awake: unknown): { asleep: string; awake: string } | null {
  const starts = parseTimes(asleep).map(toNight);
  const ends = parseTimes(awake).map(toNight);
  if (!starts.length || !ends.length) return null;
  return { asleep: toClock(Math.min(...starts)), awake: toClock(Math.max(...ends)) };
}

/** "Before 1am" = any time in the evening or 00:00–00:59. "Before 9am" = woke before 09:00. */
export function judgeSleep(asleep: string, awake: string): { sleepOk: boolean; wakeOk: boolean } {
  const [ah] = asleep.split(':').map(Number);
  const [wh, wm] = awake.split(':').map(Number);
  return { sleepOk: ah >= 12 || ah < 1, wakeOk: wh * 60 + wm < 9 * 60 };
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
  const { sleepOk, wakeOk } = judgeSleep(asleep, awake);
  const ref = db.doc(`users/${uid}/days/${date}`);
  const at = Date.now();

  await db.runTransaction(async (t) => {
    const day = (await t.get(ref)).data() ?? {};
    const done = { ...(day.done ?? {}) } as Record<string, boolean>;
    const times = { ...(day.times ?? {}) } as Record<string, string>;
    // Anything you answered yourself wins.
    if (done.sleep == null) {
      done.sleep = sleepOk;
      if (!sleepOk) times.sleep = asleep;
    }
    if (done.wake == null) {
      done.wake = wakeOk;
      if (!wakeOk) times.wake = awake;
    }
    t.set(ref, { ...day, done, times, sleepAuto: { asleep, awake, at }, updatedAt: at });
  });
  await db.doc(`users/${uid}/meta/server`).set({ lastSleep: { date, asleep, awake, at } }, { merge: true });

  return res.status(200).json({ ok: true, date, asleepBefore1am: sleepOk, upBefore9am: wakeOk });
}
