// =================================================================
// HSS SHANGUS — Lightweight Firebase Read Cache
// =================================================================
// Caches Firestore getDocs results in sessionStorage with a TTL
// to protect against exceeding Firebase 50k free tier daily reads.
// =================================================================

import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const CACHE_PREFIX = 'hss_cache_';
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

/**
 * Fetch documents from a Firestore collection with sessionStorage caching.
 *
 * @param {string} collectionName - Firestore collection name (e.g. 'admissions')
 * @param {boolean} forceRefresh - If true, bypasses cache and fetches fresh data
 * @param {number} ttlMs - Time to live in milliseconds (default: 10 mins)
 * @returns {Promise<Array<object>>} Array of document data with id attached
 */
export async function getCachedCollection(collectionName, forceRefresh = false, ttlMs = DEFAULT_TTL_MS) {
  const cacheKey = `${CACHE_PREFIX}${collectionName}`;
  const timestampKey = `${CACHE_PREFIX}${collectionName}_ts`;

  if (!forceRefresh) {
    try {
      const cachedData = sessionStorage.getItem(cacheKey);
      const cachedTs = sessionStorage.getItem(timestampKey);

      if (cachedData && cachedTs) {
        const age = Date.now() - parseInt(cachedTs, 10);
        if (age < ttlMs) {
          return JSON.parse(cachedData);
        }
      }
    } catch (e) {
      console.warn(`[dbCache] Failed to read cache for ${collectionName}:`, e);
    }
  }

  // Fetch fresh from Firebase
  try {
    const snap = await getDocs(collection(db, collectionName));
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });

    // Save to cache gracefully
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(list));
      sessionStorage.setItem(timestampKey, Date.now().toString());
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // Clear all cached collections to free up space, then retry key write
        try {
          invalidateCache();
          sessionStorage.setItem(cacheKey, JSON.stringify(list));
          sessionStorage.setItem(timestampKey, Date.now().toString());
        } catch (retryErr) {
          // If still over quota, continue without caching
        }
      } else {
        console.warn(`[dbCache] Failed to write cache for ${collectionName}:`, e);
      }
    }

    return list;
  } catch (err) {
    console.error(`[dbCache] Failed to fetch collection ${collectionName}:`, err);
    // Graceful fallback to local static masterSeedData bundle (generated from db_30 Jul 2026.xlsx)
    try {
      const seedBundle = require('../data/masterSeedData.json');
      if (collectionName === 'masterRegisters' && seedBundle.source_data) {
        console.info('[dbCache] Serving masterRegisters from local masterSeedData source_data bundle');
        const groups = {};
        seedBundle.source_data.forEach(r => {
          const gKey = `${r['Session'] || 'Archive'}_${r['Class'] || 'General'}`;
          if (!groups[gKey]) groups[gKey] = [];
          groups[gKey].push(r);
        });
        const fallbackList = [];
        let idx = 0;
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
        console.info('[dbCache] Serving admissions from local masterSeedData adm_form bundle');
        return seedBundle.adm_form.map((a, idx) => ({ id: a['Form Number'] ? `active_${a['Form Number']}` : `adm_${idx}`, ...a }));
      }
    } catch (fallbackErr) {
      console.warn('[dbCache] Seed bundle fallback note:', fallbackErr);
    }
    throw err;
  }
}

/**
 * Invalidate cache for a specific collection or all collections.
 * @param {string} [collectionName] - Optional collection name to invalidate
 */
export function invalidateCache(collectionName) {
  if (collectionName) {
    sessionStorage.removeItem(`${CACHE_PREFIX}${collectionName}`);
    sessionStorage.removeItem(`${CACHE_PREFIX}${collectionName}_ts`);
  } else {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}
