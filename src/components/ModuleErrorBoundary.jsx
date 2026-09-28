import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle, Home, ArrowLeft } from 'lucide-react';

/**
 * ModuleErrorBoundary — Gracefully catches offline drops, chunk loading failures,
 * and runtime errors without exposing raw code, stack traces, or internal paths.
 * Smartly recognizes mobile network / Wi-Fi disconnection and auto-heals when back online.
 */
export default class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);
    }
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);
    }
  }

  handleOnlineEvent = () => {
    this.setState({ isOnline: true });
    // When network signal is restored, automatically recover the failed component!
    if (this.state.hasError) {
      setTimeout(() => {
        this.handleRetry();
      }, 500);
    }
  };

  handleOfflineEvent = () => {
    this.setState({ isOnline: false });
  };

  componentDidCatch(error, errorInfo) {
    // Only log to console for diagnostic monitoring; NEVER expose stack traces in the UI
    console.warn('[ModuleErrorBoundary] Caught component error:', error?.message || error, errorInfo);
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  isNetworkOrOfflineError(error) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
    if (!error) return false;
    if (error.isOffline || error.name === 'OfflineError') return true;

    const errorMsg = String(error?.message || error || '').toLowerCase();
    return (
      errorMsg.includes('offline') ||
      errorMsg.includes('failed to fetch') ||
      errorMsg.includes('networkerror') ||
      errorMsg.includes('network request failed') ||
      errorMsg.includes('net::err_') ||
      errorMsg.includes('load failed') ||
      errorMsg.includes('chunkloaderror') ||
      errorMsg.includes('loading chunk') ||
      errorMsg.includes('error loading chunk') ||
      errorMsg.includes('dynamically imported module') ||
      errorMsg.includes('importing a module script failed') ||
      errorMsg.includes('client is offline') ||
      errorMsg.includes('unavailable') ||
      errorMsg.includes('the network connection was lost') ||
      errorMsg.includes('internet disconnected') ||
      errorMsg.includes('connection refused') ||
      errorMsg.includes('timeout')
    );
  }

  handleRetry = () => {
    this.setState({ isRetrying: true });

    try {
      if (typeof window !== 'undefined') {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('hss_chunk_retry_')) {
            sessionStorage.removeItem(key);
          }
        });
      }
    } catch (_) {}

    // Allow quick check to verify connection before clearing error state
    setTimeout(() => {
      this.setState({ hasError: false, error: null, isRetrying: false });
    }, 300);
  };

  handleReload = () => {
    // If device is offline, prevent hard refresh to avoid browser dinosaur error
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.handleRetry();
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('hss_chunk_retry_')) {
            sessionStorage.removeItem(key);
          }
        });
        window.location.reload();
      }
    } catch (_) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      const isOffline = this.isNetworkOrOfflineError(this.state.error);

      if (isOffline) {
        return (
          <div className="p-6 sm:p-8 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-lg max-w-lg mx-auto my-8 animate-fadeIn">
            {/* Soft Warm Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto shadow-inner">
              <WifiOff size={28} className="animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                No Internet Connection
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400">
                Mobile Network or Wi-Fi is Disconnected
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              We couldn't load this section because your internet connection dropped.
              Please check your mobile data or Wi-Fi signal.
            </p>

            {/* Network checklist guide */}
            <div className="text-left bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                <span>Quick Network Tips:</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                <li>Ensure Mobile Data or Wi-Fi is switched ON.</li>
                <li>Check your signal reception or toggle Airplane mode OFF.</li>
                <li>This page will automatically resume once your network reconnects.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-500 active:bg-amber-700 cursor-pointer shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw size={13} className={this.state.isRetrying ? 'animate-spin' : ''} />
                <span>{this.state.isRetrying ? 'Checking Connection...' : 'Check Connection & Retry'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Home size={13} />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        );
      }

      // Polite, Non-Leaking Application Runtime Error Card
      return (
        <div className="p-6 sm:p-8 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg max-w-lg mx-auto my-8 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle size={28} />
          </div>

          <div className="space-y-1">
            <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
              Unable to Display Section
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              An unexpected temporary issue occurred while loading this view. Your session and data are secure.
            </p>
          </div>

          {/* Clean User Guidance (Zero Code Exposure) */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-md transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Reload Section</span>
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Home size={13} />
              <span>Return to Home</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

