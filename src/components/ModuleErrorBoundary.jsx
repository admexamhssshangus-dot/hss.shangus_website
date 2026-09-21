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

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    try {
      if (typeof window !== 'undefined') {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('hss_chunk_retry_')) {
            sessionStorage.removeItem(key);
          }
        });
      }
    } catch (_) {}
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    try {
      if (typeof window !== 'undefined') {
        Object.keys(sessionStorage).forEach(key => {
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

  render() {
    if (this.state.hasError) {
      const errorMsg = String(this.state.error?.message || this.state.error || '');
      const isChunkError = /ChunkLoadError|Loading chunk|Failed to fetch|error loading dynamically imported module|Importing a module script failed|error loading chunk|dynamically imported module|Load failed|Script error|NetworkError|unexpected require|disposed module/i.test(
        errorMsg
      );

      return (
        <div className="p-6 sm:p-8 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto my-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            {isChunkError ? <RefreshCw size={24} className="animate-spin" /> : <AlertTriangle size={24} />}
          </div>
          <h3 className="font-black text-base text-slate-900 dark:text-white">
            {isChunkError ? 'Module Update Detected' : 'Unable to Load Module'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {isChunkError
              ? 'A background update or bundle recompile occurred. Click Refresh Application to fetch the fresh bundle version.'
              : 'An unexpected runtime error occurred while loading this section. You can retry or refresh the application.'}
          </p>

          {/* Diagnostic Details Box */}
          {this.state.error && (
            <div className="text-left bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <span>Diagnostic Info</span>
                <span className={isChunkError ? 'text-amber-500 font-bold' : 'text-rose-500 font-bold'}>
                  {isChunkError ? 'Bundle / Chunk Load Error' : 'Component Runtime Error'}
                </span>
              </div>
              <p className="text-rose-600 dark:text-rose-400 font-bold break-all m-0 text-xs">
                {this.state.error?.name ? `${this.state.error.name}: ` : ''}{errorMsg}
              </p>
              {this.state.error?.stack && (
                <details className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 cursor-pointer">
                  <summary className="hover:text-slate-700 dark:hover:text-slate-300 font-sans">
                    View Stack Trace
                  </summary>
                  <pre className="mt-1 p-2 rounded bg-slate-100 dark:bg-slate-900 overflow-x-auto whitespace-pre-wrap max-h-36 text-[9.5px]">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

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
