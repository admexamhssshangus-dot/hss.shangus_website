import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

let appCheckInstance = null;

const REGISTERED_WORKSTATION_DEBUG_TOKEN = '3db0fe52-529d-44e0-bdcd-3c09d0e7cd8c';

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
    const configuredToken = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
    const token = configuredToken || (process.env.NODE_ENV === 'development' ? REGISTERED_WORKSTATION_DEBUG_TOKEN : undefined);
    if (token && typeof token === 'string') {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = token.trim();
    }
  }

  // On localhost, skip active ReCaptcha attestation unless an explicit valid string debug token is configured
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocalhost && (typeof window.FIREBASE_APPCHECK_DEBUG_TOKEN !== 'string' || !window.FIREBASE_APPCHECK_DEBUG_TOKEN.trim())) {
    if (process.env.NODE_ENV !== 'test') {
      return null;
    }
  }

  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('Firebase App Check initialization skipped:', err?.message || err);
    return null;
  }
  return appCheckInstance;
}

export function getFirebaseAppCheck() {
  return appCheckInstance;
}
