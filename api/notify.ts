/**
 * Vercel function: cron-job.org opens https://<your site>/api/notify?key=<your key> every 5 minutes
 * and this sends any smart notifications that are due. (GitHub's own timer is the backup — it can
 * skip hours at a time, which is why this exists.)
 *
 * Uses the same key as the Apple Watch Shortcut, and FIREBASE_SERVICE_ACCOUNT in Vercel.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { notifyUser } from '../server/notify.js';

interface Req {
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

export default async function handler(req: Req, res: Res) {
  const [uid, secret] = String(req.query?.key ?? '').split('.');
  if (!uid || !secret) return res.status(400).json({ error: 'Add ?key=… — copy the full link from Improvr → More → Notifications.' });

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) return res.status(500).json({ error: 'Server not set up: add FIREBASE_SERVICE_ACCOUNT in Vercel.' });
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  const db = getFirestore();

  const priv = await db.doc(`users/${uid}/meta/private`).get();
  if (!priv.exists || priv.get('shortcutSecret') !== secret) return res.status(401).json({ error: 'Wrong key.' });

  const host = String(req.headers?.host ?? 'improvr.karum.co.uk');
  const sent = await notifyUser(db, uid, { via: 'cron', fallbackUrl: `https://${host}` });
  return res.status(200).json({ ok: true, sent });
}
