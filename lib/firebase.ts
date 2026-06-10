/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, getAuth } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

export const app = firebaseConfig.apiKey ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()) : null;
export let auth: any = null;
try {
  if (app) {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  }
} catch (e) {
  try {
    auth = app ? getAuth(app) : null;
  } catch (err) {
    console.error("Failed to initialize Firebase Auth:", err);
  }
}
export let db: any = null;
try {
  db = app ? initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }) : null;
  if (db && typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
      } else if (err.code == 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence');
      }
    });
  }
} catch (e) {
  console.error("Failed to initialize Firestore:", e);
}

export let analytics: any = null;
try {
  analytics = typeof window !== 'undefined' && app ? getAnalytics(app) : null;
} catch (e) {
  console.warn("Analytics blocked or unsupported:", e);
}
