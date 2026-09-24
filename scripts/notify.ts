/**
 * Runs every 15 minutes on GitHub Actions (.github/workflows/notify.yml). For each user it:
 *  1. sends any smart notifications that are due (only when there's something to do),
 *  2. refreshes the buddy page, so your buddy sees the truth even if you stop opening the app,
 *  3. on Sunday evening, emails your buddy the weekly report (if Gmail is set up).
 *
 * Secrets: FIREBASE_SERVICE_ACCOUNT (required), GMAIL_USER + GMAIL_APP_PASSWORD (optional, for the email).
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { buddyLink, buddyReport, buddySnapshot } from '../src/lib/buddy';
import { defaultSettings } from '../src/lib/config';
import { dateKey, weekStart } from '../src/lib/dates';
import { summarize } from '../src/lib/engine';
import { dueNudges, type Nudge } from '../src/lib/nudges';
import type { AppData, Settings } from '../src/lib/types';

// Fallback only — the app records the address it's really opened on (settings.appUrl).
const DEFAULT_URL = (process.env.APP_URL || 'https://improvr.karum.co.uk').replace(/\/$/, '');
const TEST = process.env.TEST === 'true';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  console.log('FIREBASE_SERVICE_ACCOUNT secret is not set yet — nothing to do. See README → Smart notifications.');
  process.exit(0);
}
initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
const db = getFirestore();

const gmailUser = process.env.GMAIL_USER;
const mailer =
  gmailUser && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: process.env.GMAIL_APP_PASSWORD } })
    : null;

async function load<T>(uid: string, name: string): Promise<Record<string, T>> {
  const snap = await db.collection(`users/${uid}/${name}`).get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as T]));
}

async function runFor(uid: string) {
  const settingsSnap = await db.doc(`users/${uid}/meta/settings`).get();
  if (!settingsSnap.exists) return;
  const stored = settingsSnap.data() as Partial<Settings>;
  // Work in the user's own time zone (dates, deadlines, "8:30am" all mean local time).
  process.env.TZ = stored.timeZone || 'Europe/London';
  const now = new Date();
  const today = dateKey(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const settings: Settings = { ...defaultSettings(today), ...stored };
  const APP_URL = (settings.appUrl || DEFAULT_URL).replace(/\/$/, '');

  const [days, payments, serverSnap, privSnap, subs] = await Promise.all([
    load<AppData['days'][string]>(uid, 'days'),
    load<AppData['payments'][string]>(uid, 'payments'),
    db.doc(`users/${uid}/meta/server`).get(),
    db.doc(`users/${uid}/meta/private`).get(),
    db.collection(`users/${uid}/push`).get(),
  ]);
  const summary = summarize({ days, payments, events: {}, birthdays: {}, settings }, today);
  const server = serverSnap.data() ?? {};
  const sent: Record<string, string> = { ...(server.sent ?? {}) };
  const update: Record<string, unknown> = { lastRun: Date.now(), emailReady: !!mailer };

  // 1. Notifications
  const nudges: Nudge[] = TEST
    ? [{ id: 'lockin', title: '✅ Notifications work', body: 'This one came from the Improvr server. You are all set.' }]
    : dueNudges({ summary, date: today, minutes, sent });
  const priv = privSnap.data();
  if (nudges.length && priv?.vapidPublic && priv.vapidPrivate && !subs.empty) {
    for (const n of nudges) {
      for (const sub of subs.docs) {
        try {
          await webpush.sendNotification(sub.data() as webpush.PushSubscription, JSON.stringify({ ...n, url: APP_URL }), {
            TTL: 60 * 60,
            urgency: 'high',
            vapidDetails: { subject: APP_URL, publicKey: priv.vapidPublic, privateKey: priv.vapidPrivate },
          });
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sub.ref.delete(); // phone unsubscribed
          else console.error(`push ${n.id} failed (${code})`, (err as Error).message);
        }
      }
      if (!TEST) sent[n.id] = today;
      console.log(`${uid}: sent "${n.id}"`);
    }
  }
  update.sent = sent;

  // 2 + 3. Buddy page and weekly email
  const buddy = settings.buddy;
  if (buddy?.token) {
    const snapshot = buddySnapshot(summary, uid);
    await db.doc(`buddy/${buddy.token}`).set(snapshot);
    const ws = weekStart(today);
    if (mailer && buddy.email && now.getDay() === 0 && minutes >= 19 * 60 && server.emailWeek !== ws) {
      const link = buddyLink(APP_URL, buddy.token);
      await mailer.sendMail({
        from: `Improvr <${gmailUser}>`,
        to: buddy.email,
        subject: `${snapshot.name}'s week: grade ${snapshot.week.grade}${snapshot.fines.owed ? ` · owes £${snapshot.fines.owed}` : ''}`,
        text: `Hi ${buddy.name || 'there'},\n\nYou're ${snapshot.name}'s accountability buddy. Here's how the week went:\n\n${buddyReport(snapshot, link)}\n\nIf they're slacking, tell them. That's the deal.\n`,
      });
      update.emailWeek = ws;
      update.lastEmail = Date.now();
      console.log(`${uid}: emailed buddy`);
    }
  }

  await db.doc(`users/${uid}/meta/server`).set(update, { merge: true });
}

const users = await db.collection('users').listDocuments();
for (const user of users) {
  try {
    await runFor(user.id);
  } catch (err) {
    console.error(`user ${user.id} failed`, err);
    process.exitCode = 1;
  }
}
console.log(`Checked ${users.length} user(s).`);
