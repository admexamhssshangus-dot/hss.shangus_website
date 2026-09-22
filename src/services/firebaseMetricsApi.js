import { backendEndpoint } from './backendEndpoint';
import { auth } from './firebase';

const CACHE_KEY = 'hss_firebase_storage_metrics';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function fetchFirebaseStorageMetrics({ force = false } = {}) {
  // Check session cache if not forced
  if (!force) {
    try {
      const cachedRaw = sessionStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.timestamp && Date.now() - cached.timestamp < CACHE_TTL_MS && cached?.data) {
          return { ...cached.data, _fromCache: true, _cachedAt: cached.timestamp };
        }
      }
    } catch (_) {}
  }

  // Ensure user is authenticated
  if (!auth.currentUser && typeof auth.authStateReady === 'function') {
    try {
      await Promise.race([
        auth.authStateReady(),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
    } catch (_) {}
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required to fetch database quota metrics.');
  }

  const idToken = await user.getIdToken();
  const endpoint = backendEndpoint('fetch-firebase-metrics');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result) {
      const msg = result?.error || `Failed to fetch metrics (HTTP ${response.status})`;
      throw new Error(msg);
    }

    // Save to session cache
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: result,
      }));
    } catch (_) {}

    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Database metrics query timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function clearMetricsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch (_) {}
}

const firebaseMetricsApi = {
  fetchFirebaseStorageMetrics,
  clearMetricsCache,
};

export default firebaseMetricsApi;
