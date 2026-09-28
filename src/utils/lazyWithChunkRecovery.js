import { lazy } from 'react';

/**
 * lazyWithChunkRecovery — Resilient lazy loader for React code-split components
 *
 * Handles ChunkLoadError caused by stale asset manifests after new builds,
 * network hiccups, or webpack hot reload re-compilations:
 * 1. Immediate in-memory retry (handles transient dev server recompile lag)
 * 2. Automated page reload with sessionStorage deduplication guard (fetches fresh HTML & manifest)
 * 3. Throws error if recovery exhausted so ErrorBoundary can gracefully catch it.
 *
 * @param {Function} importer - Dynamic import function, e.g. () => import('./MyComponent')
 * @param {string} [chunkKey='module'] - Unique identifier for sessionStorage reload tracking
 * @returns {React.LazyExoticComponent}
 */
export const lazyWithChunkRecovery = (importer, chunkKey = 'module') => lazy(async () => {
  const retryKey = `hss_chunk_retry_${chunkKey}`;

  // Try loading up to 2 times with a brief delay before forcing a reload
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const module = await importer();
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(retryKey);
        }
      } catch (_) {}
      return module;
    } catch (error) {
      const message = String(error?.message || error || '');
      const isChunkFailure = /ChunkLoadError|Loading chunk|Failed to fetch|error loading dynamically imported module|Importing a module script failed|error loading chunk|dynamically imported module|Load failed|Script error|NetworkError|unexpected require|disposed module/i.test(message);

      // If the device is currently offline, avoid destroying the SPA with window.location.reload()
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const offlineErr = new Error('No internet connection. Please check your mobile data or Wi-Fi.');
        offlineErr.name = 'OfflineError';
        offlineErr.isOffline = true;
        throw offlineErr;
      }

      if (!isChunkFailure || attempt >= 1) {
        let alreadyRetried = false;
        try {
          if (typeof window !== 'undefined') {
            alreadyRetried = sessionStorage.getItem(retryKey) === '1';
          }
        } catch (_) {}

        if (isChunkFailure && !alreadyRetried && typeof window !== 'undefined') {
          // Double-check network connection before forcing hard reload
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const offlineErr = new Error('No internet connection. Please check your mobile data or Wi-Fi.');
            offlineErr.name = 'OfflineError';
            offlineErr.isOffline = true;
            throw offlineErr;
          }

          try {
            sessionStorage.setItem(retryKey, '1');
          } catch (_) {}
          window.location.reload();
          return new Promise(() => {}); // Hold suspense until reload executes
        }
        if (isChunkFailure) {
          try {
            // Clean retry marker so manual retry doesn't get permanently suppressed
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem(retryKey);
            }
          } catch (_) {}
        }
        throw error;
      }

      // Small delay before in-memory retry in case dev server is currently writing chunk
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
});

export default lazyWithChunkRecovery;
