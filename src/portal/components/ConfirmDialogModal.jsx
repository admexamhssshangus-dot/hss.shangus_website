import React, { useState } from 'react';
import { AlertTriangle, Info, CheckCircle2, Trash2, X, ShieldAlert, FileText } from 'lucide-react';

/**
 * ConfirmDialogModal — Premium Custom UI Confirmation Dialog with Reason Tracking
 * Replaces native browser window.confirm() popups with clean alerts, consequence summaries,
 * and mandatory audit reason logging.
 */
export default function ConfirmDialogModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Sensitive Operation',
  message = 'Are you sure you want to proceed with this operation?',
  consequence = 'This action will commit changes directly to database registers.',
  confirmText = 'Confirm & Proceed',
  cancelText = 'Cancel',
  type = 'warning', // 'danger' | 'warning' | 'info' | 'success'
  loading = false,
  showReasonInput = true
}) {
  const [reasonCategory, setReasonCategory] = useState('Routine Data Update & Correction');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      border: 'border-rose-500/40',
      bgGradient: 'from-rose-500/20 via-pink-500/10 to-rose-500/20',
      iconBg: 'bg-rose-600 text-white',
      icon: Trash2,
      badge: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40',
      confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
    },
    warning: {
      border: 'border-amber-500/40',
      bgGradient: 'from-amber-500/20 via-orange-500/10 to-amber-500/20',
      iconBg: 'bg-amber-500 text-slate-950',
      icon: AlertTriangle,
      badge: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40',
      confirmBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
    },
    info: {
      border: 'border-indigo-500/40',
      bgGradient: 'from-indigo-500/20 via-blue-500/10 to-indigo-500/20',
      iconBg: 'bg-indigo-600 text-white',
      icon: Info,
      badge: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/40',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30'
    },
    success: {
      border: 'border-emerald-500/40',
      bgGradient: 'from-emerald-500/20 via-teal-500/10 to-emerald-500/20',
      iconBg: 'bg-emerald-600 text-white',
      icon: CheckCircle2,
      badge: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40',
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
    }
  };

  const currentType = typeStyles[type] || typeStyles.warning;
  const Icon = currentType.icon;

  const handleConfirmClick = () => {
    if (onConfirm) {
      onConfirm({
        reasonCategory,
        customReason: customReason.trim()
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100005] flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}
    >
      <div className={`w-full max-w-md rounded-2xl border ${currentType.border} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col`}>
        
        {/* Header Bar */}
        <div className={`px-4 py-3 bg-gradient-to-r ${currentType.bgGradient} flex items-center justify-between border-b border-slate-200 dark:border-slate-800`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl ${currentType.iconBg} flex items-center justify-center font-black shadow-sm flex-shrink-0`}>
              <Icon size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
                {title}
              </h3>
              <span className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase border ${currentType.badge}`}>
                Admin Authorization & Audit Logged
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 space-y-3 text-xs font-bold">
          <p className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-extrabold leading-snug">
            {message}
          </p>

          {consequence && (
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <ShieldAlert size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black text-slate-800 dark:text-slate-200 mb-0.5">Operation Consequence:</strong>
                <span>{consequence}</span>
              </div>
            </div>
          )}

          {/* Audit Logging Reason Selector */}
          {showReasonInput && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <FileText size={12} className="text-amber-600" /> Activity Reason (Audit Trail)
              </label>

              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer text-slate-800 dark:text-slate-200"
              >
                <option value="Routine Data Update & Correction">📋 Routine Data Update & Correction</option>
                <option value="Duplicate / Invalid Entry Removal">🧹 Duplicate / Invalid Entry Removal</option>
                <option value="Batch Student Admission Ingestion">📥 Batch Student Admission Ingestion</option>
                <option value="Official Record Export / Verification">📄 Official Record Export / Verification</option>
                <option value="Student Photo Update">📷 Student Photo Update</option>
                <option value="Student Request / Grievance Resolution">✏️ Student Request / Grievance Resolution</option>
                <option value="Administrative Audit & Cleanup">⚙️ Administrative Audit & Cleanup</option>
              </select>

              <input
                type="text"
                placeholder="Optional custom reason notes (e.g. Approved by Head of Institution)..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-[11px]"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl font-extrabold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirmClick}
            className={`px-4 py-1.5 rounded-xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${currentType.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
