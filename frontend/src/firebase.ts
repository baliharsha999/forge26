import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Firebase configuration from environment or fallback placeholders
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForBuildVerification",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nagarik-ai-civic.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nagarik-ai-civic",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nagarik-ai-civic.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "100000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:100000000000:web:0000000000000000000000",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XXXXXXXXXX"
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth - Zero-friction Anonymous Citizen Sign-In
export const auth = getAuth(app);

// Sign in anonymous citizen if not signed in
export const initAnonymousCitizen = async (): Promise<User | null> => {
  try {
    if (!auth.currentUser) {
      const cred = await signInAnonymously(auth);
      return cred.user;
    }
    return auth.currentUser;
  } catch (err) {
    console.warn("Firebase Anonymous Sign-In notice:", err);
    return null;
  }
};

// Firebase Firestore - Citizen Dossier & Saved Entitlements (Offline-First)
export const db = getFirestore(app);

// Enable IndexedDB offline persistence for rural low-connectivity access
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch(() => {
    // Silent catch if already enabled or unsupported in current tab
  });
}

// Conditionally initialize analytics in browser environment
export let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported && import.meta.env.VITE_FIREBASE_API_KEY) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics not supported in this environment
  });
}

// Safe civic telemetry logger (Zero-PII compliant)
export const logCivicTelemetry = (eventName: string, params: Record<string, any> = {}) => {
  try {
    if (analytics) {
      logEvent(analytics, eventName, params);
    }
  } catch {}
};

export default app;
