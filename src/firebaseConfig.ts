/**
 * Paste your Firebase web config here to sync between your phone and computer
 * (Firebase console → Project settings → Your apps → Web app → SDK setup → Config).
 *
 * These values are not secret — your data is protected by login + the rules in firestore.rules.
 * Leave apiKey empty to run in local-only mode (data stays in this browser only).
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const cloudEnabled = firebaseConfig.apiKey.trim() !== '';
