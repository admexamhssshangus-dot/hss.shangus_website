// =================================================================
// HSS SHANGUS — Fast SWR (Stale-While-Revalidate) & Persistent Multi-Tier Cache
// =================================================================
// Caches Firestore getDocs results in memory, sessionStorage, and localStorage.
// Provides instantaneous UI renders (0ms) across logins and browser restarts,
// while avoiding unnecessary database reads when cache is fresh.
// =================================================================

import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const CACHE_PREFIX = 'hss_cache_';
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours cache TTL (was 60 mins — prevents unnecessary re-fetches)

// Separate lightweight photo URL cache (avoids stripping logic issues for photo fields)
const PHOTO_CACHE_KEY = 'hss_photo_url_cache_v1';

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
  } catch (_) {}
}

// Automatically wipe memory cache when user logs out
if (typeof window !== 'undefined') {
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

  // ── Photo URL extraction: save photo URLs SEPARATELY before stripping ──
  const PHOTO_FIELDS = [
    'Student Photo', 'Student Photograph', 'Student Photo URL',
    'Photo', 'photo_id', 'photoId', 'photoUrl', 'photo'
  ];
  try {
    const existingPhotoCache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
    list.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const docId = item.id || item['Form Number'] || item['Board Registration Number'];
      if (!docId) return;
      for (const field of PHOTO_FIELDS) {
        const val = item[field];
        if (val && typeof val === 'string' && val.length > 5 && (val.startsWith('data:') ? val.length < 50000 : true)) {
          existingPhotoCache[String(docId)] = val;
          break;
        }
      }
    });
    const photoStr = JSON.stringify(existingPhotoCache);
    if (photoStr.length < 3500000) {
      localStorage.setItem(PHOTO_CACHE_KEY, photoStr);
    }
  } catch (_) {}

  // Strip large blobs
  const liteList = list.map(item => {
    if (!item || typeof item !== 'object') return item;
    const clean = {};
    Object.keys(item).forEach(k => {
      const v = item[k];
      if (typeof v === 'string' && (v.startsWith('data:') || v.length > 5000)) return;
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
 */
async function fetchFreshFromFirestore(collectionName) {
  const querySnapshot = await getDocs(collection(db, collectionName));
  const list = [];
  querySnapshot.forEach((doc) => {
    list.push({ id: doc.id, ...doc.data() });
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
  const current = getCachedCollectionSync(collectionName) || [];
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
  if (photoUrl.startsWith('data:') && photoUrl.length > 50000) return; // Skip uncompressed huge base64
  try {
    const existing = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
    existing[String(docId)] = photoUrl;
    const str = JSON.stringify(existing);
    if (str.length < 3500000) {
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
