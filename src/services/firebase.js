import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  GoogleAuthProvider
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
let _functionsInstance = null;
export const functions = new Proxy({}, {
  get(target, prop) {
    if (!_functionsInstance) _functionsInstance = getFunctions(app);
    const val = _functionsInstance[prop];
    return typeof val === 'function' ? val.bind(_functionsInstance) : val;
  }
});

let _storageInstance = null;
export const storage = new Proxy({}, {
  get(target, prop) {
    if (!_storageInstance) _storageInstance = getStorage(app);
    const val = _storageInstance[prop];
    return typeof val === 'function' ? val.bind(_storageInstance) : val;
  }
});

export default app;
