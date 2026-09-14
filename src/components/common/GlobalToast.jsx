import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Dispatches a toast notification globally from anywhere in the application
 * (including non-React callbacks, async functions, and nested modals).
 *
 * @param {string} message - Text or title to display
 * @param {'success' | 'error' | 'warning' | 'info'} type - Variant type
 * @param {number} duration - Auto-dismiss timeout in milliseconds (default: 3500ms)
 */
export function showToast(message, type = 'info', duration = 3500) {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('app-toast', {
    detail: {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      message: String(message || '').trim(),
      type,
      duration
    }
  });
  window.dispatchEvent(event);
}

/**
 * Convenient object helper: toast.success('Saved!'), toast.error('Failed!'), etc.
 */
export const toast = {
  success: (msg, dur) => showToast(msg, 'success', dur),
  error: (msg, dur) => showToast(msg, 'error', dur),
  warning: (msg, dur) => showToast(msg, 'warning', dur),
  info: (msg, dur) => showToast(msg, 'info', dur)
};

const TOAST_STYLES = {
  success: {
    border: 'border-emerald-500/40 dark:border-emerald-500/50',
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
  },
  error: {
    border: 'border-rose-500/40 dark:border-rose-500/50',
    bar: 'bg-rose-500',
    iconBg: 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400',
    icon: AlertCircle,
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
  },
  warning: {
    border: 'border-amber-500/40 dark:border-amber-500/50',
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
  },
  info: {
    border: 'border-indigo-500/40 dark:border-indigo-500/50',
    bar: 'bg-indigo-500',
    iconBg: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400',
    icon: Info,
    badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
  }
};

/**
 * GlobalToast — Modern, glassmorphic, window-responsive toast notification container.
 * Automatically mounts onto document.body via createPortal.
 */
export default function GlobalToast() {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const { id, message, type, duration } = e.detail || {};
      if (!message) return;

      const newToast = { id, message, type: type || 'info', duration: duration || 3500 };

      setToasts((prev) => {
        // Keep at most 4 simultaneous toasts to avoid cluttering screen
        const updated = [...prev, newToast];
        return updated.length > 4 ? updated.slice(updated.length - 4) : updated;
      });

      if (duration !== Infinity && duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, [dismissToast]);

  if (toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed z-[999999] top-3 sm:top-5 inset-x-3 sm:inset-x-auto sm:right-5 flex flex-col gap-2 pointer-events-none max-w-md w-full sm:w-auto"
    >
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {toasts.map((t) => {
        const style = TOAST_STYLES[t.type] || TOAST_STYLES.info;
        const IconComponent = style.icon;

        return (
          <div
            key={t.id}
            role="alert"
            style={{ animation: 'toastSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both' }}
            className={`pointer-events-auto relative flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border ${style.border} shadow-xl shadow-slate-950/10 dark:shadow-slate-950/40 text-slate-900 dark:text-slate-100 overflow-hidden w-full transition-all`}
          >
            {/* Top colored accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${style.bar}`} />

            {/* Icon */}
            <div className={`shrink-0 w-8 h-8 rounded-xl ${style.iconBg} flex items-center justify-center mt-0.5 shadow-2xs`}>
              <IconComponent size={18} />
            </div>

            {/* Message Body */}
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs sm:text-sm font-semibold leading-snug whitespace-pre-line break-words">
                {t.message}
              </p>
            </div>

            {/* Dismiss Close Button */}
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 p-1.5 -mr-1 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
