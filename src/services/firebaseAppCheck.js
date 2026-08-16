import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

let appCheckInstance = null;

/**
 * Initializes Firebase App Check when a reCAPTCHA Enterprise site key is
 * configured. Enforcement must also be enabled for Firestore, Storage and
 * Functions in the Firebase console after monitoring valid traffic.
 */
export function initializeFirebaseAppCheck(app) {
  const siteKey = process.env.REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey || typeof window === 'undefined') return null;
  if (appCheckInstance) return appCheckInstance;

  // Debug tokens are opt-in and must never be enabled in a production build.
  if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_ENABLE_APPCHECK_DEBUG === 'true') {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheckInstance;
}

export function getFirebaseAppCheck() {
  return appCheckInstance;
}
