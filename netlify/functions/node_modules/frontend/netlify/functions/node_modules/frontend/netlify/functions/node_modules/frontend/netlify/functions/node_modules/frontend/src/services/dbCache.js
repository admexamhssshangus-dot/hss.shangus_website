// =================================================================
// HSS SHANGUS — Fast SWR (Stale-While-Revalidate) & Persistent Multi-Tier Cache
// =================================================================
// Caches Firestore getDocs results in memory, sessionStorage, and localStorage.
// Provides instantaneous UI renders (0ms) across logins and browser restarts,
// while avoiding unnecessary database reads when cache is fresh.
// =================================================================

import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const CACHE_PREFIX = 'hss_cache_';
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours cache TTL (was 60 mins — prevents unnecessary re-fetches)

// Separate lightweight photo URL cache (avoids stripping logic issues for photo fields)
const PHOTO_CACHE_KEY = 'hss_photo_url_cache_v1';
const MEMORY_ONLY_COLLECTIONS = new Set(['admissions', 'masterRegisters', 'users']);

// In-memory cache for instant zero-latency cross-tab access
const memoryCache = new Map();
const memoryTs = new Map();

/**
 * Clear all in-memory collection caches.
 */
export function clearAllMemoryCache() {
  memoryCache.clear();
  memoryTs.clear();
  if (typeof window !== 'undefined') {
    delete window._hssMasterRegistersCache;
  }
  try {
    sessionStorage.removeItem(`${CACHE_PREFIX}masterRegisters`);
    sessionStorage.removeItem(`${CACHE_PREFIX}masterRegisters_c0`);
    sessionStorage.removeItem(`${CACHE_PREFIX}masterRegisters_c1`);
    localStorage.removeItem(`${CACHE_PREFIX}masterRegisters`);
    localStorage.removeItem(`${CACHE_PREFIX}masterRegisters_c0`);
    localStorage.removeItem(`${CACHE_PREFIX}masterRegisters_c1`);
    localStorage.removeItem('hss_cache_masterRegisters_v2');
    localStorage.removeItem('hss_cache_masterRegisters_v2_c0');
    localStorage.removeItem('hss_cache_masterRegisters_v2_c1');
    sessionStorage.removeItem(`${CACHE_PREFIX}admissions`);
    localStorage.removeItem(`${CACHE_PREFIX}admissions`);
    localStorage.removeItem(PHOTO_CACHE_KEY);
  } catch (_) {}
}

// Automatically wipe memory cache when user logs out
if (typeof window !== 'undefined') {
  try {
    clearAllMemoryCache();
    ['admissions', 'users'].forEach(name => {
      sessionStorage.removeItem(`${CACHE_PREFIX}${name}`);
      localStorage.removeItem(`${CACHE_PREFIX}${name}`);
      localStorage.removeItem(`${CACHE_PREFIX}${name}_ts`);
    });
    localStorage.removeItem(PHOTO_CACHE_KEY);
    if (!localStorage.getItem('hss_photo_cache_v3_migrated')) {
      sessionStorage.removeItem('hss_cache_admissions');
      localStorage.removeItem('hss_cache_admissions');
      localStorage.setItem('hss_photo_cache_v3_migrated', 'true');
    }
  } catch (_) {}

  window.addEventListener('hss-auth-changed', (e) => {
    if (e?.detail?.loggedIn === false) {
      clearAllMemoryCache();
    }
  });
}

/**
 * Get cached collection data synchronously if available in memory, sessionStorage, or localStorage.
 * @param {string} collectionName
 * @returns {Array<object>|null}
 */
export function getCachedCollectionSync(collectionName) {
  if (collectionName === 'masterRegisters' && window._hssMasterRegistersCache && Array.isArray(window._hssMasterRegistersCache) && window._hssMasterRegistersCache.length > 0) {
    return window._hssMasterRegistersCache;
  }
  if (memoryCache.has(collectionName)) {
    return memoryCache.get(collectionName);
  }
  if (MEMORY_ONLY_COLLECTIONS.has(collectionName)) return null;
  try {
    const cacheKey = `${CACHE_PREFIX}${collectionName}`;
    let cachedData = sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey);
    
    // Fallback check for chunked masterRegisters keys
    if (!cachedData && collectionName === 'masterRegisters') {
      const c0 = localStorage.getItem(`${CACHE_PREFIX}masterRegisters_c0`) || localStorage.getItem(`hss_cache_masterRegisters_v2_c0`) || '';
      const c1 = localStorage.getItem(`${CACHE_PREFIX}masterRegisters_c1`) || localStorage.getItem(`hss_cache_masterRegisters_v2_c1`) || '';
      if (c0 || c1) cachedData = c0 + c1;
      if (!cachedData) {
        cachedData = localStorage.getItem('hss_cache_masterRegisters_v2');
      }
    }

    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        try {
          const photoCache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
          parsed.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const hasPhoto = item.photo_id || item['Student Photo'] || item.photoUrl || item.photoId;
            if (!hasPhoto) {
              const keys = [item.id, item['Form Number'], item['Form No.'], item.formNo, item['Board Registration Number']].filter(Boolean);
              for (const k of keys) {
                const p = photoCache[String(k).trim()];
                if (p) {
                  item.photo_id = p;
                  item['Student Photo'] = p;
                  break;
                }
              }
            }
          });
        } catch (_) {}
        memoryCache.set(collectionName, parsed);
        if (collectionName === 'masterRegisters') {
          window._hssMasterRegistersCache = parsed;
        }
        return parsed;
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return null;
}

/**
 * Save data into memory, sessionStorage, and localStorage cache safely.
 * @param {string} collectionName
 * @param {Array<object>} list
 */
export function setCachedCollectionData(collectionName, list) {
  if (!Array.isArray(list)) return;
  const cacheKey = `${CACHE_PREFIX}${collectionName}`;
  const timestampKey = `${CACHE_PREFIX}${collectionName}_ts`;
  const nowStr = Date.now().toString();

  memoryCache.set(collectionName, list);
  memoryTs.set(collectionName, Date.now());

  if (collectionName === 'masterRegisters') {
    window._hssMasterRegistersCache = list;
  }
  // Admissions, user profiles and master registers contain PII. Keep these
  // only in memory for the active authenticated session.
  if (MEMORY_ONLY_COLLECTIONS.has(collectionName)) return;

  // ── Photo URL extraction: save photo URLs SEPARATELY before stripping ──
  const PHOTO_FIELDS = [
    'photo_id', 'photoId', 'Student Photo', 'Student Photograph', 'Student Photo URL',
    'Photo', 'photoUrl', 'photo'
  ];
  try {
    const existingPhotoCache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
    list.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const docId = item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'];
      if (!docId) return;
      for (const field of PHOTO_FIELDS) {
        const val = item[field];
        if (val && typeof val === 'string' && val.length > 5) {
          existingPhotoCache[String(docId)] = val;
          if (item['Form Number']) existingPhotoCache[String(item['Form Number']).trim()] = val;
          if (item['Form No.']) existingPhotoCache[String(item['Form No.']).trim()] = val;
          if (item.formNo) existingPhotoCache[String(item.formNo).trim()] = val;
          if (item.id) existingPhotoCache[String(item.id).trim()] = val;
          break;
        }
      }
    });
    const photoStr = JSON.stringify(existingPhotoCache);
    if (photoStr.length < 4500000) {
      localStorage.setItem(PHOTO_CACHE_KEY, photoStr);
    }
  } catch (_) {}

  // Strip ONLY massive uncompressed blobs (>45KB) while keeping standard compressed thumbnails (<45KB)
  const liteList = list.map(item => {
    if (!item || typeof item !== 'object') return item;
    const clean = {};
    Object.keys(item).forEach(k => {
      const v = item[k];
      if (typeof v === 'string' && v.length > 45000) return;
      clean[k] = v;
    });
    return clean;
  });

  const jsonStr = JSON.stringify(liteList);
  
  try {
    if (jsonStr.length <= 4000000) {
      sessionStorage.setItem(cacheKey, jsonStr);
      sessionStorage.setItem(timestampKey, nowStr);
      localStorage.setItem(cacheKey, jsonStr);
      localStorage.setItem(timestampKey, nowStr);
    } else {
      // Chunked storage if payload exceeds 4MB
      const half = Math.ceil(jsonStr.length / 2);
      const part0 = jsonStr.slice(0, half);
      const part1 = jsonStr.slice(half);
      localStorage.setItem(`${cacheKey}_c0`, part0);
      localStorage.setItem(`${cacheKey}_c1`, part1);
      localStorage.setItem(timestampKey, nowStr);
    }
  } catch (e) {}
}

/**
 * Fetch documents from a Firestore collection with Stale-While-Revalidate (SWR) caching.
 *
 * @param {string} collectionName - Firestore collection name (e.g. 'admissions')
 * @param {boolean} forceRefresh - If true, forces background refresh
 * @param {number} ttlMs - Time to live in milliseconds (default: 60 mins)
 * @param {function} [onBackgroundUpdate] - Optional callback triggered when fresh data arrives silently
 * @returns {Promise<Array<object>>} Array of document data with id attached
 */
export async function getCachedCollection(collectionName, forceRefresh = false, ttlMs = DEFAULT_TTL_MS, onBackgroundUpdate = null) {
  const syncData = getCachedCollectionSync(collectionName);
  const timestampKey = `${CACHE_PREFIX}${collectionName}_ts`;
  const lastTs = Number(sessionStorage.getItem(timestampKey) || localStorage.getItem(timestampKey) || memoryTs.get(collectionName) || 0);
  const isFresh = (Date.now() - lastTs) < ttlMs;

  // If we have cached data and forceRefresh is false:
  if (syncData && !forceRefresh) {
    // If cache is fresh, DO NOT trigger any database reads! Zero reads consumed.
    if (isFresh) {
      return syncData;
    }
    // Only revalidate silently if TTL has expired
    setTimeout(() => {
      revalidateBackground(collectionName, syncData, onBackgroundUpdate).catch(() => {});
    }, 100);
    return syncData;
  }

  // If no sync data or forceRefresh, fetch fresh from Firebase
  try {
    const list = await fetchFreshFromFirestore(collectionName);
    setCachedCollectionData(collectionName, list);
    return list;
  } catch (err) {
    console.error(`[dbCache] Failed to fetch collection ${collectionName}:`, err);
    return syncData || [];
  }
}

/**
 * Real-time Firestore Collection Subscription.
 * Listens for live updates, filters out deleted docs, synchronizes the memory cache,
 * and calls onUpdate with the live list.
 *
 * @param {string} collectionName - Name of the collection (e.g. 'admissions')
 * @param {function} onUpdate - Callback called with fresh list on any change
 * @param {function} [onError] - Optional error callback
 * @returns {function} unsubscribe function
 */
export function subscribeToCollection(collectionName, onUpdate, onError) {
  try {
    const collRef = collection(db, collectionName);
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          data.Status === 'Deleted' ||
          data.status === 'Deleted' ||
          data._deleted === true
        ) return;
        list.push({ id: docSnap.id, ...data });
      });
      setCachedCollectionData(collectionName, list);
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate(list);
      }
    }, (err) => {
      console.warn(`[dbCache] Realtime listener error for ${collectionName}:`, err);
      if (onError && typeof onError === 'function') {
        onError(err);
      }
    });
    return unsubscribe;
  } catch (err) {
    console.warn(`[dbCache] Failed to attach realtime listener for ${collectionName}:`, err);
    if (onError && typeof onError === 'function') {
      onError(err);
    }
    return () => {};
  }
}

/**
 * Silently revalidate collection data in the background and trigger callback if changed.
 */
async function revalidateBackground(collectionName, existingData, onBackgroundUpdate) {
  const timestampKey = `${CACHE_PREFIX}${collectionName}_ts`;
  const lastTs = sessionStorage.getItem(timestampKey) || localStorage.getItem(timestampKey) || memoryTs.get(collectionName) || 0;

  // Check if cache is fresh enough (within TTL)
  if (Date.now() - Number(lastTs) < DEFAULT_TTL_MS && existingData && existingData.length > 0) {
    return;
  }

  try {
    const freshList = await fetchFreshFromFirestore(collectionName);
    if (freshList && freshList.length > 0) {
      setCachedCollectionData(collectionName, freshList);
      if (onBackgroundUpdate && typeof onBackgroundUpdate === 'function') {
        onBackgroundUpdate(freshList);
      }
    }
  } catch (e) {
    console.warn(`[dbCache] Silent background revalidation failed for ${collectionName}:`, e);
  }
}

/**
 * Directly fetch fresh documents from Firestore.
 * Filters out soft-deleted records (Status === 'Deleted' or _deleted === true)
 * so they never appear in the UI even if Firebase still has residual copies.
 */
async function fetchFreshFromFirestore(collectionName) {
  const querySnapshot = await getDocs(collection(db, collectionName));
  const list = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    // Skip any document explicitly marked as deleted
    if (
      data.Status === 'Deleted' ||
      data.status === 'Deleted' ||
      data._deleted === true
    ) return;
    list.push({ id: doc.id, ...data });
  });
  return list;
}

/**
 * Invalidate a specific collection cache.
 */
export function invalidateCache(collectionName) {
  const cacheKey = `${CACHE_PREFIX}${collectionName}`;
  const timestampKey = `${CACHE_PREFIX}${collectionName}_ts`;

  memoryCache.delete(collectionName);
  memoryTs.delete(collectionName);

  try {
    sessionStorage.removeItem(cacheKey);
    sessionStorage.removeItem(timestampKey);
  } catch (_) { }

  try {
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(timestampKey);
  } catch (_) { }
}

/**
 * Update a single item in cache without re-fetching entire collection.
 */
export function updateCachedItem(collectionName, itemId, updatedFields) {
  if (!collectionName || !itemId) return [];
  let current = getCachedCollectionSync(collectionName) || [];

  // Safeguard: if memory cache is uninitialized or incomplete, attempt reading raw localStorage first
  if (current.length <= 1) {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${collectionName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > current.length) {
          current = parsed;
        }
      }
    } catch (_) {}
  }

  const targetIdStr = String(itemId).trim();
  const normalizedTargetId = targetIdStr.replace(/[\/\s]/g, '_').toLowerCase();

  const isMatchingItem = (item) => {
    if (!item) return false;
    const candidates = [
      item.id, item.docId, item._docId, item.formNo, item['Form No.'], item['Form Number']
    ].filter(Boolean).map(v => String(v).trim());

    return candidates.some(c => c === targetIdStr || c.replace(/[\/\s]/g, '_').toLowerCase() === normalizedTargetId);
  };

  let updatedList;
  if (updatedFields === null || (updatedFields && (updatedFields._deleted === true || updatedFields.Status === 'Deleted' || updatedFields.status === 'Deleted'))) {
    // Delete single item cleanly from cache
    updatedList = current.filter(item => !isMatchingItem(item));
  } else {
    const idx = current.findIndex(isMatchingItem);
    if (idx !== -1) {
      updatedList = [...current];
      updatedList[idx] = { ...updatedList[idx], ...updatedFields };
    } else {
      updatedList = [{ id: itemId, ...updatedFields }, ...current];
    }
  }

  setCachedCollectionData(collectionName, updatedList);
  return updatedList;
}

/**
 * Save a single student's photo URL to the photo URL mini-cache.
 * Call this whenever a photo URL is discovered for a student.
 */
export function savePhotoUrlToCache(docId, photoUrl) {
  if (!docId || !photoUrl || typeof photoUrl !== 'string') return;
  if (photoUrl === '/logo.png') return;
  if (photoUrl.startsWith('data:') && photoUrl.length > 250000) return; // Skip uncompressed huge multi-megabyte base64
  try {
    const existing = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
    existing[String(docId)] = photoUrl;
    const str = JSON.stringify(existing);
    if (str.length < 4500000) {
      localStorage.setItem(PHOTO_CACHE_KEY, str);
    }
  } catch (_) {}
}

/**
 * Retrieve a student's cached photo URL by their document ID.
 * @param {string} docId - The Firestore document ID of the student
 * @returns {string|null} - The cached photo URL, or null if not found
 */
export function getPhotoUrlFromCache(docId) {
  if (!docId) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
    return cache[String(docId)] || null;
  } catch (_) {
    return null;
  }
}
