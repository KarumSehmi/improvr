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
import { COLLECTIONS, emptyData, setBackend, useApp } from './store';
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
      useApp.setState({ ...emptyData(), status: 'signedOut', email: null });
      return;
    }

    const uid = user.uid;
    useApp.setState({ status: 'loading', email: user.email });
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
  });
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
