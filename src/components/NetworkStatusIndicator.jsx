import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';
// NetworkStatusIndicator
// Smartly tracks network & mobile data availability across the entire application.
// Non-intrusively notifies users when disconnected, avoids exposing technical codes,
// and seamlessly restores cloud connections upon reconnection.
export default function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnectedBadge, setShowReconnectedBadge] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setWasOffline(prev => {
      if (prev) {
        setShowReconnectedBadge(true);
        setTimeout(() => {
          setShowReconnectedBadge(false);
        }, 3500);
      }
      return false;
    });

    // Re-establish Firestore WebChannel connectivity dynamically if needed
    if (typeof window !== 'undefined') {
      import('../services/firebase')
        .then(({ ensureFirestoreConnected }) => {
          try {
            ensureFirestoreConnected();
          } catch (_) {}
        })
        .catch(() => {});
    }
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
    setShowReconnectedBadge(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      // Lightweight non-cached ping test to verify real connection
      const response = await fetch('/manifest.json?cache_bust=' + Date.now(), {
        method: 'HEAD',
        cache: 'no-store'
      });
      if (response.ok || response.status === 304 || response.status === 200) {
        handleOnline();
      }
    } catch (_) {
      // Still offline
      setIsOnline(false);
      setWasOffline(true);
    } finally {
      setTimeout(() => {
        setIsChecking(false);
      }, 600);
    }
  };

  if (typeof document === 'undefined') return null;

  // 1. Offline Floating Banner
  if (!isOnline) {
    return createPortal(
      <div
        role="alert"
        aria-live="assertive"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[99999] animate-fadeIn"
      >
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-rose-500/40 backdrop-blur-md text-xs font-semibold">
          <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
            <WifiOff size={13} className="animate-pulse" />
          </div>

          <div className="flex flex-col">
            <span className="font-bold text-[11px] text-rose-300 leading-tight">
              No Internet Connection
            </span>
            <span className="text-[10px] text-slate-300 leading-tight">
              Mobile data or Wi-Fi is disconnected
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            className="ml-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-white/10 hover:bg-white/20 active:bg-white/30 text-white cursor-pointer transition-colors flex items-center gap-1 border border-white/10"
            title="Check connection"
          >
            <RefreshCw size={11} className={isChecking ? 'animate-spin' : ''} />
            <span>{isChecking ? 'Checking...' : 'Retry'}</span>
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // 2. "Back Online" temporary celebration badge
  if (showReconnectedBadge) {
    return createPortal(
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[99999] animate-fadeIn"
      >
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-950/95 text-emerald-100 shadow-2xl border border-emerald-500/50 backdrop-blur-md text-xs font-bold">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={13} />
          </div>
          <span className="text-[11px]">Back Online! Reconnected successfully.</span>
        </div>
      </div>,
      document.body
    );
  }

  return null;
}
