import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  GoogleAuthProvider
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableNetwork
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { initializeFirebaseAppCheck } from './firebaseAppCheck';

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
initializeFirebaseAppCheck(app);

// Export Auth with resilient LocalStorage -> IndexedDB fallback (prevents Chromium "Database is closing/hidden" crashes)
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [browserLocalPersistence, indexedDBLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch (e) {
  authInstance = getAuth(app);
}

// Export Firestore with resilient persistent multi-tab cache (IndexedDB)
// Eliminates redundant network reads across page reloads and tab restarts
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  firestoreInstance = getFirestore(app);
}

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
export const db = firestoreInstance;
export const functions = getFunctions(app);
export const storage = getStorage(app);

let enableNetworkTimer = null;

/**
 * Re-establish Firestore WebChannel connectivity after browser/tab sleep or inactivity.
 * Debounced to avoid stream race conditions during rapid visibility/focus transitions.
 */
export async function ensureFirestoreConnected() {
  try {
    if (!firestoreInstance) return;
    if (enableNetworkTimer) {
      clearTimeout(enableNetworkTimer);
    }
    enableNetworkTimer = setTimeout(async () => {
      enableNetworkTimer = null;
      try {
        if (firestoreInstance) {
          await enableNetwork(firestoreInstance).catch(() => {});
        }
      } catch (_) {}
    }, 600);
  } catch (_) {}
}

export default app;
