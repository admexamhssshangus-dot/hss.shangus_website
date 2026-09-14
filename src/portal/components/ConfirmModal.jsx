import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LogOut, Trash2, Info, CheckCircle2, ShieldAlert, X, RefreshCw } from 'lucide-react';

/**
 * ConfirmModal — Unified, premium, window-responsive confirmation dialog.
 * Replaces native browser window.confirm() dialogs with an accessible, high-contrast,
 * mobile-friendly design system component.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title = 'Confirmation Required',
  message = 'Are you sure you want to proceed?',
  consequence = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'info' | 'success' | 'logout'
  loading = false,
  showReasonInput = false,
  defaultReason = 'Routine Administrative Update'
}) {
  const [reasonCategory, setReasonCategory] = useState(defaultReason);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDismiss = useCallback(() => {
    if (loading || isSubmitting) return;
    const fn = onClose || onCancel;
    if (fn) fn();
  }, [loading, isSubmitting, onClose, onCancel]);

  useEffect(() => {
    if (!isOpen) {
      setCustomReason('');
      return undefined;
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  if (!isOpen) return null;

  const TYPE_CONFIG = {
    danger: {
      bar: 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600',
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-950/20',
      icon: Trash2,
      consequenceBorder: 'border-rose-200/80 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
    },
    logout: {
      bar: 'bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600',
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-950/20',
      icon: LogOut,
      consequenceBorder: 'border-rose-200/80 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
    },
    warning: {
      bar: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600',
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-md shadow-amber-950/20',
      icon: AlertTriangle,
      consequenceBorder: 'border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300'
    },
    info: {
      bar: 'bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md shadow-indigo-950/20',
      icon: Info,
      consequenceBorder: 'border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-300'
    },
    success: {
      bar: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400',
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-950/20',
      icon: CheckCircle2,
      consequenceBorder: 'border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300'
    }
  };

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.warning;
  const IconComponent = config.icon;

  const handleConfirmClick = async () => {
    if (!onConfirm || isSubmitting || loading) return;
    try {
      setIsSubmitting(true);
      if (showReasonInput) {
        await onConfirm({
          reasonCategory,
          customReason: customReason.trim()
        });
      } else {
        await onConfirm();
      }
    } catch (err) {
      console.error('Confirmation handler error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = loading || isSubmitting;

  return (
    <div
      className="fixed inset-0 z-[100050] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <style>{`
        @keyframes modalPopIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        style={{ animation: 'modalPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        className="w-full max-w-sm sm:max-w-md my-auto max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl relative overflow-hidden text-left"
      >
        {/* Top colored accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-[3.5px] ${config.bar}`} />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isBusy}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-40"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>

        {/* Modal Body - Scrollable if tall */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Header Icon + Title */}
          <div className="flex items-start gap-3.5">
            <div className={`shrink-0 w-11 h-11 rounded-2xl border flex items-center justify-center ${config.iconBg} shadow-xs mt-0.5`}>
              <IconComponent size={22} />
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <h3
                id="confirm-modal-title"
                className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug"
              >
                {title}
              </h3>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words">
                {message}
              </p>
            </div>
          </div>

          {/* Optional Consequence Box */}
          {consequence && (
            <div className={`p-3 rounded-2xl border text-xs font-semibold leading-relaxed flex items-start gap-2 ${config.consequenceBorder}`}>
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{consequence}</span>
            </div>
          )}

          {/* Optional Reason Input (Audit Log) */}
          {showReasonInput && (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Action Reason <span className="text-slate-400 font-normal">(Audit Log)</span>
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                disabled={isBusy}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Routine Administrative Update">Routine Administrative Update</option>
                <option value="Student Requested Correction">Student Requested Correction</option>
                <option value="Board / JKBOSE Data Alignment">Board / JKBOSE Data Alignment</option>
                <option value="Clerical Typo Correction">Clerical Typo Correction</option>
                <option value="Disciplinary / Policy Action">Disciplinary / Policy Action</option>
                <option value="Other Specific Justification">Other Specific Justification</option>
              </select>

              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                disabled={isBusy}
                placeholder="Optional notes or details for audit trail..."
                maxLength={180}
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isBusy}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-[0.98] transition-all cursor-pointer min-h-[42px] flex items-center justify-center disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isBusy}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold active:scale-[0.98] transition-all cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5 disabled:opacity-60 ${config.confirmBtn}`}
          >
            {isBusy ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
