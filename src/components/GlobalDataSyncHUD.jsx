import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * GlobalDataSyncHUD
 * Displays real-time visual feedback whenever Firebase Firestore or local cache is loading or synchronizing.
 * Listens to global window sync events (`hss-sync-start`, `hss-sync-update`, `hss-sync-complete`)
 * and supports direct props.
 */
export default function GlobalDataSyncHUD({
  isActive = false,
  message = '',
  progress = 0,
  recordCount = null
}) {
  const [syncState, setSyncState] = useState({
    active: isActive,
    message: message || 'Synchronizing database...',
    progress: progress || 0,
    collection: 'admissions',
    lastSyncTime: null,
    isSlowNetwork: false
  });

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync with prop updates
  useEffect(() => {
    if (isActive) {
      setSyncState(prev => ({
        ...prev,
        active: true,
        message: message || prev.message,
        progress: progress || prev.progress
      }));
    } else if (!isActive && !window._hssGlobalFetchActive) {
      setSyncState(prev => prev.active ? ({
        ...prev,
        active: false,
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }) : prev);
    }
  }, [isActive, message, progress]);

  // Global event listeners for database fetches in dbCache
  useEffect(() => {
    let slowTimer = null;

    const handleSyncStart = (e) => {
      const col = e?.detail?.collection || 'admissions';
      const customMsg = e?.detail?.message || `Synchronizing ${col} records...`;
      setSyncState(prev => ({
        ...prev,
        active: true,
        collection: col,
        message: customMsg,
        progress: 35,
        isSlowNetwork: false
      }));

      slowTimer = setTimeout(() => {
        setSyncState(prev => {
          if (prev.active) {
            return {
              ...prev,
              isSlowNetwork: true,
              message: 'Connecting to live database...'
            };
          }
          return prev;
        });
      }, 3500);
    };

    const handleSyncUpdate = (e) => {
      const count = e?.detail?.count;
      const pct = e?.detail?.progress || 70;
      setSyncState(prev => ({
        ...prev,
        progress: pct,
        message: count ? `Loaded ${count} records...` : prev.message
      }));
    };

    const handleSyncComplete = (e) => {
      clearTimeout(slowTimer);
      const count = e?.detail?.count;
      setSyncState(prev => ({
        ...prev,
        active: false,
        progress: 100,
        isSlowNetwork: false,
        message: count ? `Synchronized ${count} records` : 'Database Synchronized',
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }));
    };

    const handleSyncError = (e) => {
      clearTimeout(slowTimer);
      setSyncState(prev => ({
        ...prev,
        active: false,
        isSlowNetwork: false,
        message: e?.detail?.message || 'Using cached records'
      }));
    };

    window.addEventListener('hss-sync-start', handleSyncStart);
    window.addEventListener('hss-sync-update', handleSyncUpdate);
    window.addEventListener('hss-sync-complete', handleSyncComplete);
    window.addEventListener('hss-sync-error', handleSyncError);

    return () => {
      clearTimeout(slowTimer);
      window.removeEventListener('hss-sync-start', handleSyncStart);
      window.removeEventListener('hss-sync-update', handleSyncUpdate);
      window.removeEventListener('hss-sync-complete', handleSyncComplete);
      window.removeEventListener('hss-sync-error', handleSyncError);
    };
  }, []);

  const currentlyBusy = syncState.active || isActive;

  return (
    <>
      {/* Top Screen-Edge Minimal Animated Progress Line (1px non-intrusive) */}
      {currentlyBusy && (
        <div className="fixed top-0 left-0 right-0 z-[999999] h-0.5 bg-slate-900/10 dark:bg-slate-100/10 pointer-events-none overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-teal-400 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.8)]"
            style={{ width: `${syncState.progress || 85}%` }}
          />
        </div>
      )}

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-[99999] animate-fadeIn">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-600 text-white shadow-xl text-xs font-black">
            <WifiOff size={14} />
            <span>Offline: Cloud records are temporarily unavailable</span>
          </div>
        </div>
      )}
    </>
  );
}
