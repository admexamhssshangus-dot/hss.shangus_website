import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * ModuleErrorBoundary — Catches lazy chunk loading failures and runtime errors
 * in isolated dynamic portal modules without crashing the entire app or logging out the user.
 */
export default class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[ModuleErrorBoundary] Caught module error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(
        String(this.state.error?.message || this.state.error || '')
      );

      return (
        <div className="p-8 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            {isChunkError ? <RefreshCw size={24} className="animate-spin" /> : <AlertTriangle size={24} />}
          </div>
          <h3 className="font-black text-base text-slate-900 dark:text-white">
            {isChunkError ? 'Module Update Detected' : 'Unable to Load Module'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isChunkError
              ? 'A background update or network change occurred. Please reload to fetch the latest version.'
              : 'An unexpected error occurred while loading this section. Please try again.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-md transition-colors"
            >
              Refresh Application
            </button>
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
