import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebaseConfig';
import { defaultSettings } from './config';
import { dateKey } from './dates';
import type { BuddySnapshot } from './buddy';
import { generateVapid } from './push';
import { COLLECTIONS, emptyData, setBackend, useApp, type ServerStatus } from './store';
import type { Settings } from './types';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Offline cache: the app opens instantly and works without signal, syncing when it can.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

const reportError = (err: unknown) => {
  console.error(err);
  useApp.setState({ syncError: err instanceof Error ? err.message : String(err) });
};

export function startCloud() {
  useApp.setState({ mode: 'cloud', status: 'loading' });
  let unsubs: Unsubscribe[] = [];

  onAuthStateChanged(auth, (user) => {
    unsubs.forEach((u) => u());
    unsubs = [];
    setBackend(null);
    if (!user) {
      useApp.setState({ ...emptyData(), status: 'signedOut', email: null, uid: null, server: null, pushDevices: 0 });
      return;
    }

    const uid = user.uid;
    useApp.setState({ status: 'loading', email: user.email, uid });
    setBackend({
      put: (col, id, value) => void setDoc(doc(db, 'users', uid, col, id), value).catch(reportError),
      remove: (col, id) => void deleteDoc(doc(db, 'users', uid, col, id)).catch(reportError),
      putSettings: (s) => void setDoc(doc(db, 'users', uid, 'meta', 'settings'), s).catch(reportError),
    });

    const pending = new Set<string>([...COLLECTIONS, 'settings']);
    const loaded = (key: string) => {
      pending.delete(key);
      if (pending.size === 0) useApp.setState({ status: 'ready' });
    };

    for (const col of COLLECTIONS) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, col),
          (snap) => {
            const items: Record<string, unknown> = {};
            snap.forEach((d) => {
              items[d.id] = d.data();
            });
            useApp.setState({ [col]: items });
            loaded(col);
          },
          reportError,
        ),
      );
    }

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid, 'meta', 'settings'),
        (snap) => {
          const defaults = defaultSettings(dateKey());
          if (!snap.exists()) {
            // Only create defaults once the server confirms there are none (not from an empty offline cache).
            if (snap.metadata.fromCache) return;
            void setDoc(snap.ref, defaults).catch(reportError);
            useApp.setState({ settings: defaults });
          } else {
            useApp.setState({ settings: { ...defaults, ...(snap.data() as Partial<Settings>) } });
          }
          loaded('settings');
        },
        reportError,
      ),
    );

    // Written by the background server; used to show whether notifications etc. are running.
    unsubs.push(
      onSnapshot(doc(db, 'users', uid, 'meta', 'server'), (snap) => useApp.setState({ server: (snap.data() as ServerStatus) ?? null }), () => {}),
      onSnapshot(collection(db, 'users', uid, 'push'), (snap) => useApp.setState({ pushDevices: snap.size }), () => {}),
    );
  });
}

function uid(): string {
  const id = useApp.getState().uid;
  if (!id) throw new Error('Not signed in');
  return id;
}

interface PrivateKeys {
  vapidPublic: string;
  vapidPrivate: string;
  shortcutSecret: string;
}

/** Per-user secrets (notification keys, Apple Watch key). Created on first use; only you and the server can read them. */
export async function ensurePrivate(): Promise<PrivateKeys> {
  const ref = doc(db, 'users', uid(), 'meta', 'private');
  const snap = await getDoc(ref);
  const current = (snap.data() ?? {}) as Partial<PrivateKeys>;
  if (current.vapidPublic && current.vapidPrivate && current.shortcutSecret) return current as PrivateKeys;
  const vapid = current.vapidPublic && current.vapidPrivate ? { publicKey: current.vapidPublic, privateKey: current.vapidPrivate } : await generateVapid();
  const next: PrivateKeys = {
    vapidPublic: vapid.publicKey,
    vapidPrivate: vapid.privateKey,
    shortcutSecret: current.shortcutSecret ?? Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join(''),
  };
  await setDoc(ref, next, { merge: true });
  return next;
}

async function pushDocId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function savePushSubscription(sub: PushSubscriptionJSON) {
  if (!sub.endpoint) throw new Error('No push endpoint');
  await setDoc(doc(db, 'users', uid(), 'push', await pushDocId(sub.endpoint)), {
    endpoint: sub.endpoint,
    keys: sub.keys,
    device: navigator.userAgent.includes('iPhone') ? 'iPhone' : navigator.platform || 'browser',
    createdAt: Date.now(),
  });
}

export async function removePushSubscription(endpoint: string) {
  await deleteDoc(doc(db, 'users', uid(), 'push', await pushDocId(endpoint)));
}

/** Key the iPhone Shortcut sends with your sleep times. */
export async function shortcutKey(): Promise<string> {
  const keys = await ensurePrivate();
  return `${uid()}.${keys.shortcutSecret}`;
}

export async function writeBuddy(token: string, snapshot: Omit<BuddySnapshot, 'uid'>) {
  await setDoc(doc(db, 'buddy', token), { ...snapshot, uid: uid() });
}

export async function deleteBuddy(token: string) {
  await deleteDoc(doc(db, 'buddy', token));
}

/** Public read of a buddy page (no login needed). */
export async function fetchBuddy(token: string): Promise<BuddySnapshot | null> {
  const snap = await getDoc(doc(db, 'buddy', token));
  return snap.exists() ? (snap.data() as BuddySnapshot) : null;
}

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp(email: string, password: string) {
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut() {
  await fbSignOut(auth);
}
