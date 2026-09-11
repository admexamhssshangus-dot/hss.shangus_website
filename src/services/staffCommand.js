import { getToken } from 'firebase/app-check';
import { auth } from './firebase';
import { getFirebaseAppCheck } from './firebaseAppCheck';
import { backendEndpoint } from './backendEndpoint';

// Retains the callable result shape while using the Spark-compatible backend.
export function staffCallable(name) {
  return async (data = {}) => {
    const appCheck = getFirebaseAppCheck();
    let appToken = null;
    if (appCheck) {
      try {
        const tokenResult = await getToken(appCheck);
        appToken = tokenResult?.token || null;
      } catch (err) {
        console.warn('AppCheck token retrieval note (proceeding without app token):', err?.message || err);
      }
    }
    const headers = { 'Content-Type': 'application/json' };
    if (appToken) {
      headers['X-Firebase-AppCheck'] = appToken;
    }
    if (auth.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(backendEndpoint('staff-command'), { method: 'POST', headers,
        body: JSON.stringify({ command: name, data }), cache: 'no-store', signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || !Object.prototype.hasOwnProperty.call(result, 'data')) {
        throw Object.assign(new Error(result?.error || 'The staff backend is unavailable. Check its deployment.'), { code: result?.code });
      }
      return result;
    } finally { clearTimeout(timeout); }
  };
}
