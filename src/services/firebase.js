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
  memoryLocalCache,
  clearIndexedDbPersistence,
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
    localCache: memoryLocalCache()
  });
} catch (e) {
  firestoreInstance = getFirestore(app);
}

// Remove the previous SDK disk cache before consumers start their first read.
clearIndexedDbPersistence(firestoreInstance).catch(error => {
  console.warn('Close other portal tabs to finish removing the legacy offline cache:', error.code);
});
export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
export const db = firestoreInstance;
export const functions = getFunctions(app);
export const storage = getStorage(app);

let enableNetworkTimer = null;
let isReenablingNetwork = false;

/**
 * Re-establish Firestore WebChannel connectivity after browser/tab sleep or offline events.
 * Debounced and guarded to avoid watch stream race conditions and ID: ca9 assertion failures.
 */
export async function ensureFirestoreConnected() {
  try {
    if (!firestoreInstance || !navigator.onLine || isReenablingNetwork) return;
    if (enableNetworkTimer) {
      clearTimeout(enableNetworkTimer);
    }
    enableNetworkTimer = setTimeout(async () => {
      enableNetworkTimer = null;
      if (isReenablingNetwork || !navigator.onLine) return;
      isReenablingNetwork = true;
      try {
        if (firestoreInstance) {
          await enableNetwork(firestoreInstance).catch(() => {});
        }
      } catch (_) {}
      finally {
        setTimeout(() => {
          isReenablingNetwork = false;
        }, 3000);
      }
    }, 1500);
  } catch (_) {}
}

export default app;
