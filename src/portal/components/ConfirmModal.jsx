import React from 'react';
import { AlertTriangle, LogOut, Trash2, HelpCircle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation Required',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'info' | 'logout'
  loading = false,
}) {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/20',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20',
      icon: <Trash2 size={24} />,
    },
    logout: {
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/20',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20',
      icon: <LogOut size={24} />,
    },
    warning: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/20',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20',
      icon: <AlertTriangle size={24} />,
    },
    info: {
      bg: 'bg-teal-500/10 dark:bg-teal-500/20',
      text: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-500/20',
      btn: 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-500/20',
      icon: <HelpCircle size={24} />,
    },
  };

  const config = typeConfig[type] || typeConfig.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={16} />
        </button>

        <div className={`w-12 h-12 rounded-2xl ${config.bg} ${config.text} ${config.border} border flex items-center justify-center mx-auto shadow-xs`}>
          {config.icon}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer disabled:opacity-50 ${config.btn}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
