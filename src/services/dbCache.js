// =================================================================
// HSS SHANGUS — Fast SWR (Stale-While-Revalidate) & Memory Cache
// =================================================================
// Caches Firestore getDocs results in memory & sessionStorage with TTL.
// Provides instantaneous UI renders from cache while silently 
// fetching fresh updates in the background without UI flashing.
// =================================================================

import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const CACHE_PREFIX = 'hss_cache_';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes cache TTL

// In-memory cache for instant zero-latency cross-tab access
const memoryCache = new Map();
const memoryTs = new Map();

/**
 * Get cached collection data synchronously if available in memory or sessionStorage.
 * @param {string} collectionName
 * @returns {Array<object>|null}
 */
export function getCachedCollectionSync(collectionName) {
  if (memoryCache.has(collectionName)) {
    return memoryCache.get(collectionName);
  }
  try {
    const cacheKey = `${CACHE_PREFIX}${collectionName}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      memoryCache.set(collectionName, parsed);
      return parsed;
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return null;
}

/**
 * Save data into memory and sessionStorage cache safely.
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

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(list));
    sessionStorage.setItem(timestampKey, nowStr);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Clear older caches to make room
      try {
        sessionStorage.removeItem(`${CACHE_PREFIX}masterRegisters`);
        sessionStorage.setItem(cacheKey, JSON.stringify(list));
        sessionStorage.setItem(timestampKey, nowStr);
      } catch (_) {
        // Continue with memory cache only
      }
    }
  }
}

/**
 * Fetch documents from a Firestore collection with Stale-While-Revalidate (SWR) caching.
 *
 * @param {string} collectionName - Firestore collection name (e.g. 'admissions')
 * @param {boolean} forceRefresh - If true, forces background refresh
 * @param {number} ttlMs - Time to live in milliseconds (default: 30 mins)
 * @param {function} [onBackgroundUpdate] - Optional callback triggered when fresh data arrives silently
 * @returns {Promise<Array<object>>} Array of document data with id attached
 */
export async function getCachedCollection(collectionName, forceRefresh = false, ttlMs = DEFAULT_TTL_MS, onBackgroundUpdate = null) {
  const syncData = getCachedCollectionSync(collectionName);

  // If we have cached data and forceRefresh is false, return cached data IMMEDIATELY
  if (syncData && !forceRefresh) {
    // Trigger non-blocking silent background revalidation
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
    if (syncData) return syncData;
    return getFallbackSeedData(collectionName, err);
  }
}

/**
 * Background silent revalidation without blocking UI
 */
async function revalidateBackground(collectionName, currentData, onBackgroundUpdate) {
  try {
    const freshList = await fetchFreshFromFirestore(collectionName);
    setCachedCollectionData(collectionName, freshList);

    // If data changed and callback provided, notify component silently
    if (onBackgroundUpdate && typeof onBackgroundUpdate === 'function') {
      const currentJson = JSON.stringify(currentData);
      const freshJson = JSON.stringify(freshList);
      if (currentJson !== freshJson) {
        console.info(`[dbCache] Background update detected for ${collectionName}. Updating UI silently...`);
        onBackgroundUpdate(freshList);
      }
    }
  } catch (e) {
    console.warn(`[dbCache] Background revalidation note for ${collectionName}:`, e);
  }
}

/**
 * Internal helper to fetch fresh documents from Firestore
 */
async function fetchFreshFromFirestore(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });
  return list;
}

/**
 * Update an item inside cache in-place without invalidating the whole cache
 */
export function updateCachedItem(collectionName, docId, updatedFields) {
  const list = getCachedCollectionSync(collectionName);
  if (!list || !Array.isArray(list)) return;

  const cleanDocId = String(docId).replace(/^'/, '').toLowerCase().trim();
  const updatedList = list.map(item => {
    // 1. If chunk document containing an items array (like masterRegisters chunks)
    if (Array.isArray(item.items)) {
      let matchedInChunk = false;
      const updatedSubItems = item.items.map(subIt => {
        const subFNo = String(subIt['Form Number'] || subIt['Form No.'] || subIt.formNo || subIt.id || '').replace(/^'/, '').toLowerCase().trim();
        if (subFNo === cleanDocId || subFNo.replace(/^(active_|hist_)/, '') === cleanDocId) {
          matchedInChunk = true;
          return { ...subIt, ...updatedFields };
        }
        return subIt;
      });
      if (matchedInChunk) {
        return { ...item, items: updatedSubItems };
      }
    }

    // 2. Direct document match
    const itemId = String(item.id || item['Form Number'] || item['Form No.'] || item.formNo || '').replace(/^'/, '').toLowerCase().trim();
    if (itemId === cleanDocId || itemId.replace(/^(active_|hist_)/, '') === cleanDocId) {
      return { ...item, ...updatedFields };
    }
    return item;
  });

  setCachedCollectionData(collectionName, updatedList);
}

/**
 * Fallback seed data provider
 */
function getFallbackSeedData(collectionName, err) {
  try {
    const seedBundle = require('../data/masterSeedData.json');
    if (collectionName === 'masterRegisters' && seedBundle.source_data) {
      const groups = {};
      seedBundle.source_data.forEach(r => {
        const gKey = `${r['Session'] || 'Archive'}_${r['Class'] || 'General'}`;
        if (!groups[gKey]) groups[gKey] = [];
        groups[gKey].push(r);
      });
      const fallbackList = [];
      for (const [gKey, items] of Object.entries(groups)) {
        const chunkSize = 150;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          fallbackList.push({
            id: `${gKey}_part_${Math.floor(i / chunkSize) + 1}`,
            groupKey: gKey,
            items: chunk,
            totalCount: chunk.length
          });
        }
      }
      return fallbackList;
    } else if (collectionName === 'admissions' && seedBundle.adm_form) {
      return seedBundle.adm_form.map((a, idx) => ({ id: a['Form Number'] ? `active_${a['Form Number']}` : `adm_${idx}`, ...a }));
    }
  } catch (fallbackErr) {
    console.warn('[dbCache] Seed bundle fallback note:', fallbackErr);
  }
  throw err;
}

/**
 * Invalidate cache for a specific collection or all collections.
 * @param {string} [collectionName] - Optional collection name to invalidate
 */
export function invalidateCache(collectionName) {
  if (collectionName) {
    memoryCache.delete(collectionName);
    memoryTs.delete(collectionName);
    sessionStorage.removeItem(`${CACHE_PREFIX}${collectionName}`);
    sessionStorage.removeItem(`${CACHE_PREFIX}${collectionName}_ts`);
  } else {
    memoryCache.clear();
    memoryTs.clear();
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}
