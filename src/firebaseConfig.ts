/**
 * Paste your Firebase web config here to sync between your phone and computer
 * (Firebase console → Project settings → Your apps → Web app → SDK setup → Config).
 *
 * These values are not secret — your data is protected by login + the rules in firestore.rules.
 * Leave apiKey empty to run in local-only mode (data stays in this browser only).
 */
const firebaseConfig = {
  apiKey: "AIzaSyBs8CiuhaVFVP0c_c31I8_6s-tn1lB0pYU",
  authDomain: "improvr-9c547.firebaseapp.com",
  projectId: "improvr-9c547",
  storageBucket: "improvr-9c547.firebasestorage.app",
  messagingSenderId: "407368528316",
  appId: "1:407368528316:web:eb1e93cc5a28e962eafbb9",
  measurementId: "G-LEFJ9EYH87"
};

export const cloudEnabled = firebaseConfig.apiKey.trim() !== '';
