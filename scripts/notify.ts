/**
 * Backup timer on GitHub Actions (.github/workflows/notify.yml): sends any smart notifications that
 * are due for every user. GitHub often runs this late or skips it, so the main timer is cron-job.org
 * calling api/notify.ts — both are safe to run at once.
 *
 * Secret: FIREBASE_SERVICE_ACCOUNT.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { notifyUser } from '../server/notify.js';

// Fallback only — the app records the address it's really opened on (settings.appUrl).
const fallbackUrl = process.env.APP_URL || 'https://improvr.karum.co.uk';
const test = process.env.TEST === 'true';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  console.log('FIREBASE_SERVICE_ACCOUNT secret is not set yet — nothing to do. See README → Smart notifications.');
  process.exit(0);
}
initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
const db = getFirestore();

const users = await db.collection('users').listDocuments();
for (const user of users) {
  try {
    await notifyUser(db, user.id, { via: 'github', test, fallbackUrl });
  } catch (err) {
    console.error(`user ${user.id} failed`, err);
    process.exitCode = 1;
  }
}
console.log(`Checked ${users.length} user(s).`);
