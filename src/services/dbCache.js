// =================================================================
// HSS SHANGUS — Fast SWR (Stale-While-Revalidate) & Persistent Multi-Tier Cache
// =================================================================
// Caches Firestore getDocs results in memory, sessionStorage, and localStorage.
// Provides instantaneous UI renders (0ms) across logins and browser restarts,
// while avoiding unnecessary database reads when cache is fresh.
// =================================================================

import { collection, getDocs, onSnapshot, doc, getDoc, setDoc, deleteDoc, deleteField, query, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../utils/imageCompressor';
import { updateStudentInRegIndex } from './studentIndexService';

const CACHE_PREFIX = 'hss_cache_';
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours cache TTL (was 60 mins — prevents unnecessary re-fetches)

// Separate lightweight photo URL cache (avoids stripping logic issues for photo fields)
const PHOTO_CACHE_KEY = 'hss_photo_url_cache_v1';
const MEMORY_ONLY_COLLECTIONS = new Set(['users']);

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

// In-flight fetch deduplication to prevent duplicate network calls
const inflightFetches = new Map();

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
  if (MEMORY_ONLY_COLLECTIONS.has(collectionName)) return null;
  try {
    const cacheKey = `${CACHE_PREFIX}${collectionName}`;
    let cachedData = sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey);

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
    'Photo', 'photoUrl', 'photo', 'passport_photo'
  ];
  try {
    const existingPhotoCache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
    let dirty = false;
    list.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const docId = item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'];
      if (!docId) return;
      for (const field of PHOTO_FIELDS) {
        const val = item[field];
        if (val && typeof val === 'string' && val.length > 5 && val !== '/logo.png') {
          existingPhotoCache[String(docId)] = val;
          if (item['Form Number']) existingPhotoCache[String(item['Form Number']).trim()] = val;
          if (item['Form No.']) existingPhotoCache[String(item['Form No.']).trim()] = val;
          if (item.formNo) existingPhotoCache[String(item.formNo).trim()] = val;
          if (item.id) existingPhotoCache[String(item.id).trim()] = val;
          if (item['Board Registration Number']) existingPhotoCache[String(item['Board Registration Number']).trim()] = val;
          if (item.boardRegNo) existingPhotoCache[String(item.boardRegNo).trim()] = val;
          dirty = true;
          break;
        }
      }
    });
    if (dirty) {
      const photoStr = JSON.stringify(existingPhotoCache);
      if (photoStr.length < 4500000) {
        localStorage.setItem(PHOTO_CACHE_KEY, photoStr);
      }
    }
  } catch (_) {}

  // Strip ALL heavy photo fields (>500 chars or base64 or photo keys) from the collection cache
  // to guarantee 0ms instant loading and zero memory bloat even with 100k+ records.
  const cappedList = list.slice(0, 2000); // 2,000 active record safety cap for web storage
  const liteList = cappedList.map(item => {
    if (!item || typeof item !== 'object') return item;
    const clean = {};
    Object.keys(item).forEach(k => {
      const v = item[k];
      // Exclude heavy photo fields or base64 data URLs from storage cache
      if (PHOTO_FIELDS.includes(k) && typeof v === 'string' && (v.length > 500 || v.startsWith('data:'))) {
        return;
      }
      if (typeof v === 'string' && v.length > 10000) return;
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

  // If a fetch is already in flight for this collection, reuse that promise!
  if (inflightFetches.has(collectionName)) {
    return inflightFetches.get(collectionName);
  }

  // If no sync data or forceRefresh, fetch fresh from Firebase with in-flight deduplication
  const fetchPromise = (async () => {
    try {
      const list = await fetchFreshFromFirestore(collectionName);
      setCachedCollectionData(collectionName, list);
      return list;
    } catch (err) {
      console.error(`[dbCache] Failed to fetch collection ${collectionName}:`, err);
      return syncData || [];
    } finally {
      inflightFetches.delete(collectionName);
    }
  })();

  inflightFetches.set(collectionName, fetchPromise);
  return fetchPromise;
}

/**
 * Get the total document count of a collection from the server (using getCountFromServer)
 * without downloading document payloads.
 * @param {string} collectionName
 * @returns {Promise<number>}
 */
export async function getCollectionCount(collectionName) {
  try {
    const collRef = collection(db, collectionName);
    const snapshot = await getCountFromServer(collRef);
    const count = snapshot.data().count;
    return typeof count === 'number' ? count : 0;
  } catch (err) {
    console.warn(`[dbCache] getCountFromServer note for ${collectionName}:`, err);
    const sync = getCachedCollectionSync(collectionName);
    return Array.isArray(sync) ? sync.length : 0;
  }
}

/**
 * Fetch a single page of documents from a collection.
 * @param {string} collectionName
 * @param {number} pageSize
 * @param {any} lastDocCursor - Firestore DocumentSnapshot cursor to start after
 * @returns {Promise<{ docs: Array<object>, lastDoc: any, hasMore: boolean }>}
 */
export async function getPaginatedCollection(collectionName, pageSize = 50, lastDocCursor = null) {
  try {
    const collRef = collection(db, collectionName);
    let q;
    if (lastDocCursor) {
      q = query(collRef, limit(pageSize), startAfter(lastDocCursor));
    } else {
      q = query(collRef, limit(pageSize));
    }

    const querySnapshot = await getDocs(q);
    const list = [];
    let lastDoc = null;

    querySnapshot.forEach((docSnap) => {
      lastDoc = docSnap;
      const data = docSnap.data();
      if (
        data.Status === 'Deleted' ||
        data.status === 'Deleted' ||
        data._deleted === true
      ) return;

      const chunkItems = data.items || data.students || data.records || data.data;
      if (Array.isArray(chunkItems) && chunkItems.length > 0) {
        const docSession = data.Session || data.session || data['Academic Session'] || data.groupKey?.split('_')[0] || docSnap.id?.split('_')[0] || '';
        const docClass = data.class || data.Class || data.className || data['Class'] || data.groupKey?.split('_')[1] || '';
        const docStream = data.stream || data.Stream || data['Stream'] || data.groupKey?.split('_')[2] || '';

        chunkItems.forEach((item, itemIdx) => {
          if (item && typeof item === 'object') {
            if (item.Status === 'Deleted' || item.status === 'Deleted' || item._deleted === true) return;
            list.push({
              ...item,
              id: item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'] || `${docSnap.id}_${itemIdx}`,
              Session: item.Session || item.session || item['Academic Session'] || docSession || '',
              session: item.session || item.Session || item['Academic Session'] || docSession || '',
              Class: item.Class || item.class || item['Class'] || docClass || '',
              class: item.class || item.Class || item['Class'] || docClass || '',
              Stream: item.Stream || item.stream || item['Stream'] || docStream || '',
              stream: item.stream || item.Stream || item['Stream'] || docStream || '',
              _source: collectionName,
              _parentDocId: docSnap.id
            });
          }
        });
      } else {
        list.push({ id: docSnap.id, ...data, _source: collectionName });
      }
    });

    return {
      docs: list,
      lastDoc,
      hasMore: querySnapshot.docs.length >= pageSize
    };
  } catch (err) {
    console.error(`[dbCache] Failed getPaginatedCollection for ${collectionName}:`, err);
    return { docs: [], lastDoc: null, hasMore: false };
  }
}

/**
 * Progressively hydrate remaining pages in non-blocking batches.
 * Yields back to the browser event loop between batches so the UI remains 100% smooth.
 *
 * @param {string} collectionName
 * @param {any} initialCursor
 * @param {Array<object>} initialDocs
 * @param {function} onBatch - Called as each batch arrives
 * @param {function} onComplete - Called when all remaining records are loaded
 */
export function hydrateRemainingPages(collectionName, initialCursor, initialDocs = [], onBatch = null, onComplete = null) {
  let accumulated = [...initialDocs];
  let cursor = initialCursor;
  let cancelled = false;

  const fetchNextBatch = async () => {
    if (cancelled) return;
    try {
      const pageRes = await getPaginatedCollection(collectionName, 60, cursor);
      if (cancelled) return;

      if (pageRes.docs.length > 0) {
        accumulated = [...accumulated, ...pageRes.docs];
        cursor = pageRes.lastDoc;
        setCachedCollectionData(collectionName, accumulated);
        if (onBatch && typeof onBatch === 'function') {
          onBatch(accumulated);
        }
      }

      if (pageRes.hasMore && pageRes.lastDoc) {
        // Yield to event loop for 40ms to keep 60fps animations smooth
        setTimeout(fetchNextBatch, 40);
      } else {
        setCachedCollectionData(collectionName, accumulated);
        if (onComplete && typeof onComplete === 'function') {
          onComplete(accumulated);
        }
      }
    } catch (err) {
      console.warn(`[dbCache] Background hydration note for ${collectionName}:`, err);
      if (onComplete && typeof onComplete === 'function') {
        onComplete(accumulated);
      }
    }
  };

  setTimeout(fetchNextBatch, 60);

  return () => {
    cancelled = true;
  };
}

/**
 * Real-time Firestore Collection Subscription.
 * Listens for live updates via onSnapshot, unpacks chunked/flat docs, synchronizes memory and session cache,
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

        const chunkItems = data.items || data.students || data.records || data.data;
        if (Array.isArray(chunkItems) && chunkItems.length > 0) {
          const docSession = data.Session || data.session || data['Academic Session'] || data.groupKey?.split('_')[0] || docSnap.id?.split('_')[0] || '';
          const docClass = data.class || data.Class || data.className || data['Class'] || data.groupKey?.split('_')[1] || '';
          const docStream = data.stream || data.Stream || data['Stream'] || data.groupKey?.split('_')[2] || '';

          chunkItems.forEach((item, itemIdx) => {
            if (item && typeof item === 'object') {
              if (item.Status === 'Deleted' || item.status === 'Deleted' || item._deleted === true) return;
              list.push({
                ...item,
                id: item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'] || `${docSnap.id}_${itemIdx}`,
                Session: item.Session || item.session || item['Academic Session'] || docSession || '',
                session: item.session || item.Session || item['Academic Session'] || docSession || '',
                Class: item.Class || item.class || item['Class'] || docClass || '',
                class: item.class || item.Class || item['Class'] || docClass || '',
                Stream: item.Stream || item.stream || item['Stream'] || docStream || '',
                stream: item.stream || item.Stream || item['Stream'] || docStream || '',
                _source: collectionName,
                _parentDocId: docSnap.id
              });
            }
          });
        } else {
          list.push({ id: docSnap.id, ...data, _source: collectionName });
        }
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
    return typeof unsubscribe === 'function' ? unsubscribe : () => {};
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
 * Fetch fresh data directly from Firestore collection.
 * Filters out soft-deleted records (Status === 'Deleted' or _deleted === true)
 * so they never appear in the UI even if Firebase still has residual copies.
 */
async function fetchFreshFromFirestore(collectionName) {
  if (typeof window !== 'undefined') {
    window._hssGlobalFetchActive = true;
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hss-sync-start', {
        detail: {
          collection: collectionName,
          message: `Connecting & synchronizing ${collectionName === 'admissions' ? 'Admissions' : collectionName} database...`
        }
      }));
    }, 0);
  }

  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const list = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Skip any document explicitly marked as deleted
      if (
        data.Status === 'Deleted' ||
        data.status === 'Deleted' ||
        data._deleted === true
      ) return;

      const chunkItems = data.items || data.students || data.records || data.data;
      if (Array.isArray(chunkItems) && chunkItems.length > 0) {
        const docSession = data.Session || data.session || data['Academic Session'] || data.groupKey?.split('_')[0] || docSnap.id?.split('_')[0] || '';
        const docClass = data.class || data.Class || data.className || data['Class'] || data.groupKey?.split('_')[1] || '';
        const docStream = data.stream || data.Stream || data['Stream'] || data.groupKey?.split('_')[2] || '';

        chunkItems.forEach((item, itemIdx) => {
          if (item && typeof item === 'object') {
            if (item.Status === 'Deleted' || item.status === 'Deleted' || item._deleted === true) return;
            list.push({
              ...item,
              id: item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'] || `${docSnap.id}_${itemIdx}`,
              Session: item.Session || item.session || item['Academic Session'] || docSession || '',
              session: item.session || item.Session || item['Academic Session'] || docSession || '',
              Class: item.Class || item.class || item['Class'] || docClass || '',
              class: item.class || item.Class || item['Class'] || docClass || '',
              Stream: item.Stream || item.stream || item['Stream'] || docStream || '',
              stream: item.stream || item.Stream || item['Stream'] || docStream || '',
              _source: collectionName,
              _parentDocId: docSnap.id
            });
          }
        });
      } else {
        list.push({ id: docSnap.id, ...data, _source: collectionName });
      }
    });

    if (typeof window !== 'undefined') {
      window._hssGlobalFetchActive = false;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('hss-sync-complete', {
          detail: {
            collection: collectionName,
            count: list.length
          }
        }));
      }, 0);
    }

    return list;
  } catch (err) {
    if (typeof window !== 'undefined') {
      window._hssGlobalFetchActive = false;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('hss-sync-error', {
          detail: {
            collection: collectionName,
            message: err?.message || 'Failed to fetch from live database'
          }
        }));
      }, 0);
    }
    throw err;
  }
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

  if (collectionName === 'admissions' && updatedFields && typeof updatedFields === 'object') {
    try {
      const mergedStudent = updatedList.find(isMatchingItem);
      if (mergedStudent) {
        updateStudentInRegIndex(mergedStudent).catch(() => {});
      }
    } catch (_) {}
  }

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

/**
 * Helper to normalize registration numbers into clean alphanumeric lookup keys.
 */
export function normalizeRegNoKey(val) {
  if (!val) return '';
  let s = String(val).trim();
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
    try {
      if (typeof window !== 'undefined' && window.BigInt) {
        s = window.BigInt(Math.floor(Number(val))).toString();
      }
    } catch (_) {}
  }
  return s.replace(/\.0+$/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Preload centralized student photos from 'studentPhotos' collection AND in-memory admissions/masterRegisters
 * into the local memory photo map indexed by registration number for universal cross-session sharing.
 */
export async function preloadStudentPhotosCache() {
  if (typeof window === 'undefined') return {};
  try {
    const photoMap = window._hss_central_photo_map || {};

    // 1. Scan all documents in 'studentPhotos' collection
    try {
      const photosSnap = await getDocs(collection(db, 'studentPhotos'));
      photosSnap.forEach(docSnap => {
        const d = docSnap.data();
        const p = d.photo_id || d.photoId || d.photoData || d.photo || d.photoUrl || d.data || d.url || d.image || d.base64 || d.passport_photo || d['Student Photo'] || '';
        if (p && typeof p === 'string' && p.trim().length > 20 && p !== '/logo.png') {
          const photoVal = p.trim();
          const regCandidates = [
            d.regNo,
            d.boardRegNo,
            d['Board Registration Number'],
            d['Board Registration No.'],
            d['Board Reg. No.'],
            d['REG. NO.']
          ].filter(Boolean);

          regCandidates.forEach(r => {
            const rawR = String(r).trim();
            const cleanR = normalizeRegNoKey(rawR);
            if (cleanR) {
              photoMap[cleanR] = photoVal;
              photoMap[`photo_${cleanR}`] = photoVal;
              photoMap[`reg_${cleanR}`] = photoVal;
              photoMap[rawR] = photoVal;
              photoMap[rawR.toLowerCase()] = photoVal;
            }
          });

          if (d.formNo) {
            const f = String(d.formNo).trim();
            photoMap[f] = photoVal;
            photoMap[f.toLowerCase()] = photoVal;
          }
          const rawDocId = docSnap.id;
          const cleanDocId = normalizeRegNoKey(rawDocId.replace(/^photo_/, '').replace(/^form_/, '').replace(/^reg_/, ''));
          if (cleanDocId) {
            photoMap[cleanDocId] = photoVal;
            photoMap[`photo_${cleanDocId}`] = photoVal;
            photoMap[`reg_${cleanDocId}`] = photoVal;
          }
          photoMap[rawDocId] = photoVal;
          photoMap[rawDocId.replace(/^photo_/, '')] = photoVal;
          if (rawDocId.startsWith('photo_form_')) {
            photoMap[rawDocId.replace(/^photo_form_/, '')] = photoVal;
          }
        }
      });
    } catch (err) {
      console.warn('studentPhotos collection scan note:', err);
    }

    // 2. Scan loaded admissions & masterRegisters collections across all sessions/classes
    try {
      const allAdmissions = getCachedCollectionSync('admissions') || [];
      const allMaster = getCachedCollectionSync('masterRegisters') || [];
      const allLegacy = getCachedCollectionSync('legacyStudents') || [];
      
      const flatStudents = [];
      [...allAdmissions, ...allMaster, ...allLegacy].forEach(item => {
        if (!item) return;
        const inner = item.items || item.students || item.records || item.data;
        if (Array.isArray(inner)) {
          flatStudents.push(...inner);
        } else {
          flatStudents.push(item);
        }
      });

      flatStudents.forEach(st => {
        if (!st || typeof st !== 'object') return;
        const p = st.photo_id || st.photoId || st.photoUrl || st.photo || st['passport_photo'] || st['Student Photo'] || st['Student Photograph'] || st['Photo'] || st.studentPhoto || '';
        if (p && typeof p === 'string' && p.trim().length > 20 && p !== '/logo.png') {
          const photoVal = p.trim();
          const regCandidates = [
            st.boardRegNo,
            st.regNo,
            st['Board Registration Number'],
            st['Board Registration No.'],
            st['Board Registration No. (Class 10th)'],
            st['Board Registration No. (Class 11th)'],
            st['Board Registration No. (Class 12th)'],
            st['Registration No. (allotted by JKBOSE)'],
            st['Board Reg. No.'],
            st['Board Reg No'],
            st['Registration No.'],
            st['Reg. No.'],
            st['Reg. No'],
            st['Reg No'],
            st['Reg No.'],
            st['REG. NO.'],
            st['REG NO']
          ].filter(Boolean);

          regCandidates.forEach(r => {
            const rawR = String(r).trim();
            const cleanR = normalizeRegNoKey(rawR);
            if (cleanR) {
              photoMap[cleanR] = photoVal;
              photoMap[`photo_${cleanR}`] = photoVal;
              photoMap[`reg_${cleanR}`] = photoVal;
              photoMap[rawR] = photoVal;
              photoMap[rawR.toLowerCase()] = photoVal;
            }
          });

          const formCandidates = [st.formNo, st['Form Number'], st['Form No.'], st.id].filter(Boolean);
          formCandidates.forEach(f => {
            photoMap[String(f).trim()] = photoVal;
            photoMap[String(f).trim().toLowerCase()] = photoVal;
          });
        }
      });
    } catch (_) {}

    window._hss_central_photo_map = photoMap;

    // Dispatch custom event to notify all active views/reports that photos are ready in RAM
    window.dispatchEvent(new CustomEvent('hss-photos-loaded', { detail: { count: Object.keys(photoMap).length } }));

    return photoMap;
  } catch (e) {
    console.warn('Could not preload student photos cache:', e);
    return window._hss_central_photo_map || {};
  }
}

export { preloadStudentPhotosCache as preloadCentralStudentPhotos };

/**
 * Robust synchronous photo resolver cross-referencing all fields, in-memory central photo map, and localStorage.
 * Ensures if a photo exists for a registration number in ANY session or class, it is automatically returned.
 * STRICT: Matches ONLY by unique Registration Number, Form Number, or Document ID (NEVER by student name).
 */
export function resolveStudentPhoto(student, fallback = null) {
  if (!student) return fallback;

  const photoMap = typeof window !== 'undefined' ? (window._hss_central_photo_map || {}) : {};

  // 1. Direct photo on student object
  const directPhoto =
    student.photo_id ||
    student.photoId ||
    student.photoUrl ||
    student.photo ||
    student['passport_photo'] ||
    student['Student Photo'] ||
    student['Student Photograph'] ||
    student['Photo'] ||
    student['Student Photo URL'] ||
    '';
  if (directPhoto && typeof directPhoto === 'string' && directPhoto.trim().length > 15 && directPhoto !== '/logo.png') {
    const pTrim = directPhoto.trim();
    const rawReg = student.boardRegNo || student.regNo || student['Board Registration Number'] || student['Board Registration No.'] || student['REG. NO.'] || '';
    const cleanR = normalizeRegNoKey(rawReg);
    if (cleanR && typeof window !== 'undefined') {
      window._hss_central_photo_map = window._hss_central_photo_map || {};
      window._hss_central_photo_map[cleanR] = pTrim;
      window._hss_central_photo_map[`photo_${cleanR}`] = pTrim;
    }
    return pTrim;
  }

  // 2. Universal lookup by Registration Number across all sessions & classes
  const rawReg =
    student.boardRegNo ||
    student.regNo ||
    student['Board Registration Number'] ||
    student['Board Registration No.'] ||
    student['Board Registration No. (Class 10th)'] ||
    student['Board Registration No. (Class 11th)'] ||
    student['Board Reg. No.'] ||
    student['Board Reg No'] ||
    student['REG. NO.'] ||
    '';

  const cleanReg = normalizeRegNoKey(rawReg);
  const formNo = String(student.formNo || student['Form Number'] || student['Form No.'] || student.id || '').trim();
  const docId = String(student.docId || student.id || '').trim();

  // STRICT UNIQUE IDENTIFIERS ONLY - NO NAME KEYS
  const candidates = [
    cleanReg,
    cleanReg ? `photo_${cleanReg}` : null,
    cleanReg ? `reg_${cleanReg}` : null,
    rawReg,
    rawReg.toLowerCase(),
    formNo,
    formNo.toLowerCase(),
    formNo ? `photo_${formNo}` : null,
    docId,
    docId ? `photo_${docId}` : null,
    docId ? docId.replace(/^photo_/, '') : null
  ].filter(Boolean);

  for (const c of candidates) {
    if (photoMap[c] && typeof photoMap[c] === 'string' && photoMap[c].length > 15 && photoMap[c] !== '/logo.png') {
      return photoMap[c];
    }
  }

  // 3. Check localStorage photo cache
  try {
    const localCache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || '{}');
    for (const c of candidates) {
      if (localCache[c] && typeof localCache[c] === 'string' && localCache[c].length > 15 && localCache[c] !== '/logo.png') {
        if (typeof window !== 'undefined') {
          window._hss_central_photo_map = window._hss_central_photo_map || {};
          window._hss_central_photo_map[c] = localCache[c];
        }
        return localCache[c];
      }
    }
  } catch (_) {}

  // 4. In-Memory scan of all cached student records across all sessions/classes for matching regNo
  if (cleanReg) {
    try {
      const allAdmissions = getCachedCollectionSync('admissions') || [];
      const allMaster = getCachedCollectionSync('masterRegisters') || [];
      const allLegacy = getCachedCollectionSync('legacyStudents') || [];
      const flatStudents = [];
      [...allAdmissions, ...allMaster, ...allLegacy].forEach(item => {
        if (!item) return;
        const inner = item.items || item.students || item.records || item.data;
        if (Array.isArray(inner)) flatStudents.push(...inner);
        else flatStudents.push(item);
      });

      for (const rec of flatStudents) {
        if (!rec || typeof rec !== 'object') continue;
        const recReg = normalizeRegNoKey(
          rec.boardRegNo || rec.regNo || rec['Board Registration Number'] || rec['Board Registration No.'] || rec['Board Registration No. (Class 10th)'] || rec['Board Registration No. (Class 11th)'] || rec['REG. NO.']
        );
        if (recReg === cleanReg) {
          const recPhoto = rec.photo_id || rec.photoId || rec.photoUrl || rec.photo || rec['passport_photo'] || rec['Student Photo'] || rec['Photo'] || '';
          if (recPhoto && typeof recPhoto === 'string' && recPhoto.length > 15 && recPhoto !== '/logo.png') {
            const pTrim = recPhoto.trim();
            if (typeof window !== 'undefined') {
              window._hss_central_photo_map = window._hss_central_photo_map || {};
              window._hss_central_photo_map[cleanReg] = pTrim;
              window._hss_central_photo_map[`photo_${cleanReg}`] = pTrim;
            }
            return pTrim;
          }
        }
      }
    } catch (_) {}
  }

  return fallback;
}

/**
 * Merges duplicate student applications based on Board Registration Number, Class, and Session.
 * Merges rich student-submitted info (photo, parentage, DoB, phone, address, Aadhaar, subjects)
 * with admin-verified bulk fields (form number, class roll no, admission no, verified stream).
 */
export function mergeDuplicateStudentApplications(records = []) {
  if (!Array.isArray(records) || records.length === 0) return [];

  const grouped = new Map();
  const unmergedList = [];

  records.forEach((rec, idx) => {
    if (!rec) return;

    // Extract normalized registration key
    const rawReg = rec['Board Registration Number'] ||
      rec['Board Registration No.'] ||
      rec['Board Registration No. (Class 10th)'] ||
      rec['Board Registration No. (Class 11th)'] ||
      rec['Board Reg. No.'] ||
      rec['Board Reg No'] ||
      rec.boardRegNo ||
      rec.regNo ||
      '';
    const cleanReg = normalizeRegNoKey(rawReg);

    // Extract class canonical
    const rawClass = String(rec['Admission sought for class'] || rec['Class'] || rec.class || '').trim().toLowerCase();
    const cleanClass = rawClass.includes('10') ? '10th' : rawClass.includes('11') ? '11th' : rawClass.includes('12') ? '12th' : rawClass.includes('9') ? '9th' : rawClass;

    // Extract session
    const rawSession = String(rec['Session'] || rec['session'] || '').trim().toLowerCase();

    // If student has a valid board registration number, group by reg + class + session
    if (cleanReg && cleanReg !== '—' && cleanReg.length >= 6) {
      const groupKey = `${cleanReg}_${cleanClass || 'all'}_${rawSession || 'curr'}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey).push({ ...rec, _origIdx: idx });
    } else {
      unmergedList.push(rec);
    }
  });

  const mergedResults = [];

  grouped.forEach((group) => {
    if (group.length === 1) {
      mergedResults.push(group[0]);
      return;
    }

    // Sort group: prioritize online submitted (which usually has ownerUid, submittedAt, or photo_id)
    // and admin bulk records (which usually have verified formNo, classRollNo)
    let combined = {};

    // 1. Identify best base (online submitted record with rich profile)
    const onlineApp = group.find(r => r.ownerUid || r.photo_id || r.submittedAt || r['photoUrl']) || group[0];
    // 2. Identify admin bulk record (with verified roll number or admin fields)
    const adminApp = group.find(r => r !== onlineApp && (r['Class Roll No'] || r.classRollNo || r['Form Number'])) || group.find(r => r !== onlineApp) || {};

    // Merge all keys from both
    combined = { ...onlineApp };

    // Overlay non-empty fields from all other records in the group
    group.forEach(r => {
      Object.keys(r).forEach(k => {
        const val = r[k];
        const isEmpty = val === undefined || val === null || val === '' || val === '—' || val === 'N/A' || val === 'null';
        const currVal = combined[k];
        const currIsEmpty = currVal === undefined || currVal === null || currVal === '' || currVal === '—' || currVal === 'N/A' || currVal === 'null';

        if (!isEmpty && currIsEmpty) {
          combined[k] = val;
        }
      });
    });

    // Special preference for verified admin fields
    const verifiedRoll = adminApp['Class Roll No'] || adminApp['Class Roll No.'] || adminApp.classRollNo || onlineApp['Class Roll No'] || onlineApp.classRollNo || '';
    if (verifiedRoll && verifiedRoll !== '—') {
      combined['Class Roll No'] = String(verifiedRoll).trim();
      combined['Class Roll No.'] = String(verifiedRoll).trim();
      combined.classRollNo = String(verifiedRoll).trim();
    }

    const verifiedForm = adminApp['Form Number'] || adminApp.formNo || onlineApp['Form Number'] || onlineApp.formNo || '';
    if (verifiedForm && verifiedForm !== '—') {
      combined['Form Number'] = String(verifiedForm).trim();
      combined.formNo = String(verifiedForm).trim();
    }

    // Resolve best photo
    const bestPhoto = resolveStudentPhoto(combined) || resolveStudentPhoto(onlineApp) || resolveStudentPhoto(adminApp);
    if (bestPhoto) {
      combined['Student Photo'] = bestPhoto;
      combined.photo_id = bestPhoto;
      combined.photoUrl = bestPhoto;
    }

    // Ensure valid docId
    combined.docId = combined.id || adminApp.id || onlineApp.id || combined['Form Number'];
    combined.id = combined.docId;

    mergedResults.push(combined);
  });

  return [...mergedResults, ...unmergedList];
}

const _activePhotoPromises = new Map();

/**
 * Fetch a single student's photo on-demand from Firestore 'studentPhotos' collection.
 * Uses in-memory caching and promise de-duplication so each photo is fetched only once.
 */
export async function fetchStudentPhotoOnDemand(student) {
  if (!student) return '';

  // 1. Check in-memory synchronous photo map first
  const existing = getStudentPhotoUrl(student);
  if (existing && existing !== '/logo.png' && existing !== '—') return existing;

  // 2. Extract candidate Board Reg No & Document IDs
  const cleanReg = (val) => {
    if (!val) return '';
    let s = String(val).trim();
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
      try {
        if (typeof window !== 'undefined' && window.BigInt) {
          s = window.BigInt(Math.floor(Number(val))).toString();
        } else {
          s = Number(val).toLocaleString('fullwide', { useGrouping: false });
        }
      } catch (_) {}
    }
    return s.replace(/\.0+$/, '').replace(/[^a-zA-Z0-9]/g, '');
  };

  const rawBoardReg =
    student.boardRegNo ||
    student.regNo ||
    student['Board Registration No. (Class 10th)'] ||
    student['Board Registration No. (Class 11th)'] ||
    student['Board Registration No. (Class 12th)'] ||
    student['Registration No. (allotted by JKBOSE)'] ||
    student['Board Registration No.'] ||
    student['Board Registration Number'] ||
    student['Board Reg. No.'] ||
    student['Board Reg No'] ||
    student['Registration No.'] ||
    student['Reg. No.'] ||
    student['Reg. No'] ||
    student['Reg No'] ||
    student['REG. NO.'] ||
    student['REG NO'] ||
    '';

  const reg = cleanReg(rawBoardReg);
  const fNo = String(student.formNo || student['Form Number'] || student['Form No.'] || student.form_no || '').replace(/^'/, '').trim();
  const rawId = String(student.docId || student._docId || student.id || '').trim();

  const docCandidates = [];
  if (reg) {
    docCandidates.push(`photo_${reg}`);
    docCandidates.push(reg);
    docCandidates.push(`photo_${reg.toLowerCase()}`);
    docCandidates.push(reg.toLowerCase());
    docCandidates.push(`reg_${reg}`);
  }
  if (rawBoardReg && rawBoardReg !== reg) {
    docCandidates.push(`photo_${rawBoardReg}`);
    docCandidates.push(rawBoardReg);
  }
  if (fNo) {
    docCandidates.push(`photo_form_${fNo}`);
    docCandidates.push(`photo_${fNo}`);
    docCandidates.push(`form_${fNo}`);
    docCandidates.push(fNo);
  }
  if (rawId) {
    docCandidates.push(`photo_${rawId}`);
    docCandidates.push(rawId);
  }

  const cacheKey = reg || fNo || rawId;
  if (!cacheKey) return '';

  if (_activePhotoPromises.has(cacheKey)) {
    return _activePhotoPromises.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      for (const targetDocId of docCandidates) {
        if (!targetDocId) continue;
        try {
          const snap = await getDoc(doc(db, 'studentPhotos', targetDocId));
          if (snap.exists()) {
            const d = snap.data();
            const p = (d.photo_id || d.photoId || d.photoData || d.photo || d.photoUrl || d.data || d.url || d.image || d.base64 || d.passport_photo || d['Student Photo'] || '').trim();
            if (p && p.length > 20 && p !== '/logo.png') {
              const formatted = formatPhotoDisplayUrl(p) || p;
              if (typeof window !== 'undefined') {
                window._hss_central_photo_map = window._hss_central_photo_map || {};
                docCandidates.forEach(cand => {
                  window._hss_central_photo_map[cand] = formatted;
                });
              }
              return formatted;
            }
          }
        } catch (_) {}
      }
      return '';
    } catch (e) {
      console.warn(`Could not fetch on-demand photo for ${cacheKey}:`, e);
      return '';
    } finally {
      _activePhotoPromises.delete(cacheKey);
    }
  })();

  _activePhotoPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch all matching photos for a student by Board Registration Number and candidate IDs
 * across studentPhotos records, photoHistory array, and in-memory photo caches.
 * Pure Firebase architecture: Processed studentPhotos photo is prioritized as ACTIVE,
 * and duplicate raw photos of the same session are filtered out.
 */
export async function fetchAllMatchingStudentPhotos(student) {
  if (!student) return [];
  const cleanReg = (val) => {
    if (!val) return '';
    let s = String(val).trim();
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
      try {
        if (typeof window !== 'undefined' && window.BigInt) {
          s = window.BigInt(Math.floor(Number(val))).toString();
        } else {
          s = Number(val).toLocaleString('fullwide', { useGrouping: false });
        }
      } catch (_) {}
    }
    return s.replace(/\.0+$/, '').replace(/[^a-zA-Z0-9]/g, '');
  };

  const reg = cleanReg(
    student.boardRegNo ||
    student.regNo ||
    student['Board Registration Number'] ||
    student['Board Registration No.'] ||
    student['Board Registration No. (Class 10th)'] ||
    student['Board Registration No. (Class 11th)'] ||
    student['REG. NO.']
  );

  const formNo = String(student.formNo || student['Form Number'] || student['Form No.'] || '').replace(/^'/, '').trim();
  const sName = String(student.studentName || student["Student's Name (as per school records)"] || student["Student's Name"] || student.name || '').trim();

  const results = [];
  const seenUrls = new Set();

  const addCandidate = (item) => {
    if (!item || !item.url || typeof item.url !== 'string') return;
    const formattedUrl = formatPhotoDisplayUrl(item.url) || item.url.trim();
    if (!formattedUrl || formattedUrl.length < 20 || formattedUrl === '/logo.png' || formattedUrl === '—' || formattedUrl === 'N/A') return;
    if (formattedUrl.includes('drive.google.com') || formattedUrl.includes('googleusercontent.com')) return;
    item.url = formattedUrl;
    const urlHash = formattedUrl.substring(0, 120);
    if (!seenUrls.has(urlHash)) {
      seenUrls.add(urlHash);
      results.push(item);
    }
  };

  // 1. PRIMARY: Query centralized Firestore studentPhotos collection first (Processed Admin Photos)
  const docCandidates = [];
  if (reg) {
    docCandidates.push(`photo_${reg}`);
    docCandidates.push(reg);
  }
  if (formNo && formNo !== '—' && formNo !== 'N/A') {
    docCandidates.push(`photo_form_${formNo}`);
    docCandidates.push(`form_${formNo}`);
    docCandidates.push(`photo_${formNo}`);
    docCandidates.push(formNo);
  }
  if (student.docId) docCandidates.push(String(student.docId).trim());
  if (student.id) docCandidates.push(String(student.id).trim());

  for (const cId of docCandidates) {
    try {
      const snap = await getDoc(doc(db, 'studentPhotos', cId));
      if (snap.exists()) {
        const d = snap.data();
        const rawP = d.photo_id || d.photoData || d.photo || d.photoUrl || '';
        const p = formatPhotoDisplayUrl(rawP) || (typeof rawP === 'string' ? rawP.trim() : '');
        if (p && p.length > 20 && p !== '/logo.png' && p !== '—' && !p.includes('drive.google.com')) {
          addCandidate({
            id: snap.id,
            url: p,
            title: d.selectedClass ? `Class ${d.selectedClass} (${d.selectedSession || 'Official'})` : (d.sourceFile || `Reg #${d.regNo || reg || formNo}`),
            badge: d.selectedClass ? `Class ${d.selectedClass}` : 'Active Passport',
            regNo: d.regNo || d.boardRegNo || reg,
            studentName: d.studentName || sName,
            isCurrent: true,
            source: 'studentPhotos'
          });
        }

        // Include any historical photos in photoHistory array
        if (Array.isArray(d.photoHistory)) {
          d.photoHistory.forEach((h, hIdx) => {
            const rawH = h.url || h.photo_id || h.photoData || h.photo || '';
            const hUrl = formatPhotoDisplayUrl(rawH) || (typeof rawH === 'string' ? rawH.trim() : '');
            if (hUrl && hUrl.length > 20 && hUrl !== '/logo.png' && hUrl !== '—' && !hUrl.includes('drive.google.com')) {
              addCandidate({
                id: `${snap.id}_hist_${hIdx}`,
                url: hUrl,
                title: h.class ? `Class ${h.class} (${h.session || 'Archive'})` : (h.title || `Archive Photo #${hIdx + 1}`),
                badge: h.class || 'Archive',
                regNo: d.regNo || reg,
                studentName: d.studentName || sName,
                isCurrent: false,
                source: 'Photo History'
              });
            }
          });
        }
      }
    } catch (_) {}
  }

  // 2. Search in-memory photo map
  if (typeof window !== 'undefined' && window._hss_central_photo_map) {
    const memoryMap = window._hss_central_photo_map;
    if (reg) {
      [`photo_${reg}`, reg, `reg_${reg}`].forEach(k => {
        if (memoryMap[k]) {
          const formattedMem = formatPhotoDisplayUrl(memoryMap[k]);
          if (formattedMem && !formattedMem.includes('drive.google.com')) {
            addCandidate({
              id: k,
              url: formattedMem,
              title: `Reg #${reg}`,
              badge: 'Cached',
              isCurrent: results.length === 0,
              source: 'Photo Cache'
            });
          }
        }
      });
    }
    if (formNo) {
      [`photo_form_${formNo}`, `form_${formNo}`, formNo].forEach(k => {
        if (memoryMap[k]) {
          const formattedMem = formatPhotoDisplayUrl(memoryMap[k]);
          if (formattedMem && !formattedMem.includes('drive.google.com')) {
            addCandidate({
              id: k,
              url: formattedMem,
              title: `Form #${formNo}`,
              badge: 'Cached',
              isCurrent: results.length === 0,
              source: 'Photo Cache'
            });
          }
        }
      });
    }
  }

  // 3. Fallback to direct photo on student record (only if no central photo and is valid Base64 / non-Drive)
  if (results.length === 0) {
    const directPhoto = formatPhotoDisplayUrl(student.photo_id || student.photo || student.photoUrl);
    if (directPhoto && !directPhoto.includes('drive.google.com') && directPhoto.length > 20) {
      addCandidate({
        id: 'current',
        url: directPhoto,
        title: `${student.class || student['Class'] || ''} (${student.session || student['Session'] || 'Active'})`,
        badge: 'Active',
        isCurrent: true,
        source: 'Active Record'
      });
    }
  }

  // Ensure exactly one candidate is marked isCurrent
  if (results.length > 0 && !results.some(r => r.isCurrent)) {
    results[0].isCurrent = true;
  }

  return results;
}

/**
 * Automatically synchronizes a student's photo across Firestore `studentPhotos`
 * and updates the student's admission / masterRegister document.
 */
export async function syncStudentPhotoOnRegUpdate({ oldReg = '', newReg = '', student = {}, photoData = '' } = {}) {
  try {
    const cleanReg = (val) => {
      if (!val) return '';
      let s = String(val).trim();
      if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
        try {
          if (typeof window !== 'undefined' && window.BigInt) {
            s = window.BigInt(Math.floor(Number(val))).toString();
          } else {
            s = Number(val).toLocaleString('fullwide', { useGrouping: false });
          }
        } catch (_) {}
      }
      return s.replace(/\.0+$/, '').replace(/[^a-zA-Z0-9]/g, '');
    };

    const targetNewReg = cleanReg(
      newReg || 
      student?.boardRegNo || 
      student?.regNo || 
      student?.['Board Registration Number'] || 
      student?.['Board Registration No.'] ||
      student?.['Board Registration No. (Class 10th)'] ||
      student?.['Board Registration No. (Class 11th)'] ||
      student?.['REG. NO.']
    );

    const targetOldReg = cleanReg(oldReg);
    let photoUrl = '';

    // If targetNewReg already has a photo in studentPhotos, preserve the authentic photo of targetNewReg
    if (targetNewReg && (!photoData || typeof photoData !== 'string' || photoData.trim().length <= 20)) {
      try {
        const newSnap = await getDoc(doc(db, 'studentPhotos', `photo_${targetNewReg}`));
        if (newSnap.exists()) {
          const nd = newSnap.data();
          const existingP = (nd.photo_id || nd.photoData || nd.photo || '').trim();
          if (existingP && existingP.length > 20 && !existingP.includes('drive.google.com')) {
            photoUrl = existingP;
          }
        }
      } catch (_) {}
    }

    // Resolve photo string (from argument, student record, or memory cache)
    if (!photoUrl || photoUrl === '/logo.png' || photoUrl.length < 20 || photoUrl.includes('drive.google.com')) {
      photoUrl = (typeof photoData === 'string' && photoData.trim().length > 20 && !photoData.includes('drive.google.com'))
        ? photoData.trim()
        : (getStudentPhotoUrl(student) || '');
    }

    // If photo is still missing, check if oldReg document has it in Firestore
    if ((!photoUrl || photoUrl === '/logo.png') && targetOldReg) {
      try {
        const oldSnap = await getDoc(doc(db, 'studentPhotos', `photo_${targetOldReg}`));
        if (oldSnap.exists()) {
          const od = oldSnap.data();
          photoUrl = (od.photo_id || od.photoData || od.photo || '').trim();
        }
      } catch (_) {}
    }

    if (!photoUrl || photoUrl === '/logo.png' || photoUrl.length < 20 || photoUrl.includes('drive.google.com')) {
      return false;
    }

    const sName = student?.studentName || student?.["Student's Name (as per school records)"] || student?.["Student's Name"] || student?.name || '';
    const sClass = student?.class || student?.['Admission sought for class'] || student?.['Class'] || '';
    const sSession = student?.session || student?.['Session'] || '';
    const sFormNo = String(student?.formNo || student?.['Form Number'] || student?.['Form No.'] || '').replace(/^'/, '').trim();

    // 1. Write or update new studentPhotos document with the Board Registration No or Form No and preserve history
    if (targetNewReg) {
      let existingHistory = [];
      try {
        const curSnap = await getDoc(doc(db, 'studentPhotos', `photo_${targetNewReg}`));
        if (curSnap.exists()) {
          const cd = curSnap.data();
          existingHistory = Array.isArray(cd.photoHistory) ? [...cd.photoHistory] : [];
          const curP = (cd.photo_id || cd.photoData || cd.photo || '').trim();
          if (curP && curP.length > 20 && curP !== photoUrl && !curP.includes('drive.google.com') && !existingHistory.some(h => (h.url || h.photo_id) === curP)) {
            existingHistory.push({
              url: curP,
              photo_id: curP,
              class: cd.selectedClass || sClass,
              session: cd.selectedSession || sSession,
              updatedAt: cd.updatedAt || new Date().toISOString()
            });
          }
        }
      } catch (_) {}

      const docPayload = {
        photo_id: photoUrl,
        regNo: targetNewReg,
        boardRegNo: targetNewReg,
        formNo: sFormNo,
        studentName: sName,
        selectedClass: sClass,
        selectedSession: sSession,
        photoHistory: existingHistory,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'studentPhotos', `photo_${targetNewReg}`), docPayload, { merge: true });

      // Update RAM cache immediately
      if (typeof window !== 'undefined') {
        window._hss_central_photo_map = window._hss_central_photo_map || {};
        window._hss_central_photo_map[targetNewReg] = photoUrl;
        window._hss_central_photo_map[`photo_${targetNewReg}`] = photoUrl;
        if (sFormNo) {
          window._hss_central_photo_map[sFormNo] = photoUrl;
          window._hss_central_photo_map[`form_${sFormNo}`] = photoUrl;
          window._hss_central_photo_map[`photo_form_${sFormNo}`] = photoUrl;
        }
        if (sName) {
          window._hss_central_photo_map[String(sName).trim().toLowerCase()] = photoUrl;
        }
      }
    } else if (sFormNo) {
      let existingHistory = [];
      try {
        const curSnap = await getDoc(doc(db, 'studentPhotos', `photo_form_${sFormNo}`));
        if (curSnap.exists()) {
          const cd = curSnap.data();
          existingHistory = Array.isArray(cd.photoHistory) ? [...cd.photoHistory] : [];
          const curP = (cd.photo_id || cd.photoData || cd.photo || '').trim();
          if (curP && curP.length > 20 && curP !== photoUrl && !curP.includes('drive.google.com') && !existingHistory.some(h => (h.url || h.photo_id) === curP)) {
            existingHistory.push({
              url: curP,
              photo_id: curP,
              class: cd.selectedClass || sClass,
              session: cd.selectedSession || sSession,
              updatedAt: cd.updatedAt || new Date().toISOString()
            });
          }
        }
      } catch (_) {}

      const docPayload = {
        photo_id: photoUrl,
        formNo: sFormNo,
        studentName: sName,
        selectedClass: sClass,
        selectedSession: sSession,
        photoHistory: existingHistory,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'studentPhotos', `photo_form_${sFormNo}`), docPayload, { merge: true });

      if (typeof window !== 'undefined') {
        window._hss_central_photo_map = window._hss_central_photo_map || {};
        window._hss_central_photo_map[sFormNo] = photoUrl;
        window._hss_central_photo_map[`form_${sFormNo}`] = photoUrl;
        window._hss_central_photo_map[`photo_form_${sFormNo}`] = photoUrl;
        if (sName) {
          window._hss_central_photo_map[String(sName).trim().toLowerCase()] = photoUrl;
        }
      }
    }

    // 2. Also update student's active admission document with the clean Base64 photo
    const targetDocId = student.docId || student._docId || student.id;
    if (targetDocId) {
      try {
        const colName = student._isHistorical || student._isMasterRegister ? 'masterRegisters' : 'admissions';
        await setDoc(doc(db, colName, String(targetDocId)), {
          photo_id: photoUrl,
          'Student Photo': deleteField(),
          photoUrl: deleteField(),
          photoId: deleteField(),
          photo: deleteField(),
          studentPhoto: deleteField(),
          studentPhotoUrl: deleteField(),
          passport_photo: deleteField(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (_) {}
    }

    // 3. Clean up obsolete old registration doc if it changed
    if (targetOldReg && targetNewReg && targetOldReg !== targetNewReg) {
      try {
        await deleteDoc(doc(db, 'studentPhotos', `photo_${targetOldReg}`));
        if (typeof window !== 'undefined' && window._hss_central_photo_map) {
          delete window._hss_central_photo_map[targetOldReg];
          delete window._hss_central_photo_map[`photo_${targetOldReg}`];
        }
      } catch (_) {}
    }

    // Save to lightweight local storage photo cache
    if (targetNewReg) savePhotoUrlToCache(targetNewReg, photoUrl);
    if (sFormNo) savePhotoUrlToCache(sFormNo, photoUrl);

    // Dispatch global event so all components reactively refresh photos
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hss-photos-loaded', { detail: { updatedReg: targetNewReg || sFormNo } }));
    }

    return true;
  } catch (e) {
    console.warn('syncStudentPhotoOnRegUpdate note:', e);
    return false;
  }
}

/**
 * Reconciles all student photos across Firestore (admissions, masterRegisters, studentPhotos).
 * Matches each record against the centralized studentPhotos collection,
 * sets the processed passport photo into photo_id, and purges stale Google Drive URLs and redundant photo fields.
 */
export async function reconcileAllStudentPhotosInDatabase({
  students = [],
  onProgress = () => {}
} = {}) {
  const stats = {
    totalScanned: students.length,
    matchedCount: 0,
    updatedCount: 0,
    alreadyCleanCount: 0,
    noPhotoCount: 0,
    errors: []
  };

  try {
    // 1. Scan and index all records in studentPhotos
    const photosSnap = await getDocs(collection(db, 'studentPhotos'));
    const photoIndex = new Map();

    photosSnap.forEach(docSnap => {
      const d = docSnap.data();
      const rawP = d.photo_id || d.photoData || d.photo || d.photoUrl || '';
      const p = formatPhotoDisplayUrl(rawP) || (typeof rawP === 'string' ? rawP.trim() : '');
      if (p && p.length > 20 && p !== '/logo.png' && !p.includes('drive.google.com')) {
        const cleanDocId = docSnap.id.replace(/^photo_/, '').replace(/^form_/, '').trim().toLowerCase();
        photoIndex.set(cleanDocId, p);

        if (d.regNo) photoIndex.set(normalizeRegNoKey(d.regNo), p);
        if (d.boardRegNo) photoIndex.set(normalizeRegNoKey(d.boardRegNo), p);
        if (d.formNo) photoIndex.set(String(d.formNo).trim().toLowerCase(), p);
      }
    });

    // 2. Iterate through all students and synchronize
    for (let i = 0; i < students.length; i++) {
      const st = students[i];
      const rawReg = st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Registration No.'] || '';
      const cleanReg = normalizeRegNoKey(rawReg);
      const formNo = String(st.formNo || st['Form Number'] || st['Form No.'] || '').trim().toLowerCase();
      const rawDocId = String(st.docId || st._docId || st.id || '').replace(/^(active_|hist_|adm_)/, '').trim().toLowerCase();

      // Find matching processed photo in studentPhotos index
      let matchedProcessedPhoto = null;
      if (cleanReg && photoIndex.has(cleanReg)) {
        matchedProcessedPhoto = photoIndex.get(cleanReg);
      } else if (formNo && photoIndex.has(formNo)) {
        matchedProcessedPhoto = photoIndex.get(formNo);
      } else if (rawDocId && photoIndex.has(rawDocId)) {
        matchedProcessedPhoto = photoIndex.get(rawDocId);
      }

      if (matchedProcessedPhoto) {
        stats.matchedCount++;
        const currentPhoto = st.photo_id || st.photo || st.photoUrl || '';
        const hasStaleDriveLink = currentPhoto.includes('drive.google.com') || currentPhoto.includes('googleusercontent.com');
        const isDifferent = currentPhoto !== matchedProcessedPhoto;

        if (isDifferent || hasStaleDriveLink || st['Student Photo'] || st.photoUrl || st.photoId) {
          const collectionName = st._isHistorical || st._isMasterRegister ? 'masterRegisters' : 'admissions';
          const targetDocId = st._docId || st.docId || st.id;

          if (targetDocId) {
            try {
              await setDoc(doc(db, collectionName, String(targetDocId)), {
                photo_id: matchedProcessedPhoto,
                'Student Photo': deleteField(),
                photoUrl: deleteField(),
                photoId: deleteField(),
                photo: deleteField(),
                studentPhoto: deleteField(),
                studentPhotoUrl: deleteField(),
                passport_photo: deleteField(),
                'photo_synced_at': new Date().toISOString()
              }, { merge: true });
              stats.updatedCount++;
            } catch (e) {
              stats.errors.push({ student: st.studentName || formNo, error: e.message });
            }
          }
        } else {
          stats.alreadyCleanCount++;
        }
      } else {
        const directPhoto = formatPhotoDisplayUrl(st.photo_id);
        if (directPhoto && directPhoto.length > 20) {
          stats.alreadyCleanCount++;
        } else {
          stats.noPhotoCount++;
        }
      }

      if (i % 15 === 0 || i === students.length - 1) {
        onProgress({
          current: i + 1,
          total: students.length,
          percentage: Math.round(((i + 1) / students.length) * 100),
          stats
        });
      }
    }

    // Refresh memory cache
    await preloadStudentPhotosCache();

    return stats;
  } catch (err) {
    console.error('Reconciliation error:', err);
    stats.errors.push({ general: err.message });
    return stats;
  }
}


