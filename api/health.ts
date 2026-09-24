/**
 * Vercel function: your iPhone Shortcut posts last night's Apple Watch sleep here each morning,
 * and it fills in "Asleep before 1am" and "Up before 9am" for you (unless you've already answered).
 *
 * Needs FIREBASE_SERVICE_ACCOUNT in Vercel → Settings → Environment Variables (same JSON as the GitHub secret).
 * Kept self-contained on purpose — Vercel builds each /api file on its own.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Accepts "00:42", "0:42", "00.42" or anything containing a time, like "24 Sep 2026 at 00:42". */
export function parseTime(value: unknown): string | null {
  const m = /(\d{1,2})[:.](\d{2})/.exec(String(value ?? ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
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
  const asleep = parseTime(fields.asleep);
  const awake = parseTime(fields.awake);
  if (!uid || !secret) return res.status(401).json({ error: 'Missing key — copy it from Improvr → More → Apple Watch sleep.' });
  if (!asleep || !awake) return res.status(400).json({ error: 'Send "asleep" and "awake" as times, e.g. 00:42 and 08:15.' });

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
