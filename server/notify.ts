/**
 * Sends one person's smart notifications that are due right now. Used by the Vercel endpoint
 * (api/notify.ts, hit every few minutes by cron-job.org) and the GitHub Actions backup (scripts/notify.ts).
 *
 * Imports end in .js so Node can run the compiled files on Vercel (TypeScript maps them to the .ts files).
 */
import type { Firestore } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { defaultSettings } from '../src/lib/config.js';
import { dateKey } from '../src/lib/dates.js';
import { summarize } from '../src/lib/engine.js';
import { badgeCount, logicalNow } from '../src/lib/moments.js';
import { dueNudges, type Nudge } from '../src/lib/nudges.js';
import type { AppData, Settings } from '../src/lib/types.js';

export type RunVia = 'cron' | 'github';

const TEST_NUDGE: Nudge = { id: 'lockin', title: '✅ Notifications work', body: 'This one came from the Improvr server. You are all set.' };

export async function notifyUser(db: Firestore, uid: string, opts: { via: RunVia; test?: boolean; fallbackUrl: string }): Promise<string[]> {
  const settingsSnap = await db.doc(`users/${uid}/meta/settings`).get();
  if (!settingsSnap.exists) return [];
  const stored = settingsSnap.data() as Partial<Settings>;
  // Work in the user's own time zone (dates, deadlines, "8:30am" all mean local time).
  process.env.TZ = stored.timeZone || 'Europe/London';
  const now = new Date();
  const today = dateKey(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const settings: Settings = { ...defaultSettings(today), ...stored };
  const appUrl = (settings.appUrl || opts.fallbackUrl).replace(/\/$/, '');

  const load = async <T>(name: string): Promise<Record<string, T>> => {
    const snap = await db.collection(`users/${uid}/${name}`).get();
    return Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as T]));
  };
  const [days, payments, todos, privSnap, subs] = await Promise.all([
    load<AppData['days'][string]>('days'),
    load<AppData['payments'][string]>('payments'),
    load<AppData['todos'][string]>('todos'),
    db.doc(`users/${uid}/meta/private`).get(),
    db.collection(`users/${uid}/push`).get(),
  ]);
  const priv = privSnap.data();
  const canSend = !!priv?.vapidPublic && !!priv.vapidPrivate && !subs.empty;
  const summary = summarize({ days, payments, events: {}, birthdays: {}, todos, settings }, today);

  // Claim what's due inside a transaction, so two runs at once (cron + GitHub) never send the same thing twice.
  const serverRef = db.doc(`users/${uid}/meta/server`);
  const nudges = await db.runTransaction(async (t) => {
    const server = (await t.get(serverRef)).data() ?? {};
    const sent: Record<string, string> = { ...(server.sent ?? {}) };
    const due = !canSend ? [] : opts.test ? [TEST_NUDGE] : dueNudges({ summary, date: today, minutes, sent, todos });
    if (!opts.test) for (const n of due) sent[n.id] = today;
    const at = Date.now();
    t.set(serverRef, { lastRun: at, ...(opts.via === 'cron' && { lastCron: at }), sent }, { merge: true });
    return due;
  });

  // The number on the app icon: what's due right now (the notification updates it).
  const moment = logicalNow(now);
  const badge = badgeCount(summary.evalByDate[moment.date], moment.hour, todos, today);

  for (const n of nudges) {
    for (const sub of subs.docs) {
      try {
        await webpush.sendNotification(sub.data() as webpush.PushSubscription, JSON.stringify({ ...n, url: appUrl, badge }), {
          TTL: 60 * 60,
          urgency: 'high',
          vapidDetails: { subject: appUrl, publicKey: priv!.vapidPublic, privateKey: priv!.vapidPrivate },
        });
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sub.ref.delete(); // phone unsubscribed
        else console.error(`push ${n.id} failed (${code})`, (err as Error).message);
      }
    }
    console.log(`${uid}: sent "${n.id}"`);
  }
  return nudges.map((n) => n.id);
}
