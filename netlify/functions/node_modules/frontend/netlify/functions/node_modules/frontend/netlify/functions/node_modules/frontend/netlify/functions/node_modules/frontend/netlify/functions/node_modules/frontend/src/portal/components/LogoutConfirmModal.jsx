import React from 'react';
import { LogOut, X, ShieldAlert } from 'lucide-react';

/**
 * LogoutConfirmModal — A premium animated confirmation dialog shown before logout.
 * Usage:
 *   <LogoutConfirmModal
 *     isOpen={showLogoutConfirm}
 *     onConfirm={onLogout}
 *     onCancel={() => setShowLogoutConfirm(false)}
 *     userName="Sheikh Gulfam"   // optional
 *   />
 */
export default function LogoutConfirmModal({ isOpen, onConfirm, onCancel, userName }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      <div
        className="w-full max-w-sm rounded-3xl border shadow-2xl p-6 space-y-5 relative overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderColor: 'var(--border-ui, #e2e8f0)',
          animation: 'logoutModalPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <style>{`
          @keyframes logoutModalPop {
            from { opacity: 0; transform: scale(0.88) translateY(12px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Subtle top danger gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500 rounded-t-3xl" />

        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          aria-label="Cancel logout"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center">
            <ShieldAlert size={26} className="text-rose-500" />
          </div>
        </div>

        {/* Title & Body */}
        <div className="text-center space-y-1.5">
          <h2
            id="logout-modal-title"
            className="text-lg font-black text-slate-900 dark:text-white"
          >
            Sign Out?
          </h2>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
            {userName ? (
              <>You are signed in as <span className="text-slate-700 dark:text-slate-200 font-black">{userName}</span>.<br /></>
            ) : null}
            Are you sure you want to sign out of the portal?
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-2xl text-xs font-black border transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97]"
            style={{ borderColor: 'var(--border-ui, #e2e8f0)', color: 'var(--text-muted, #64748b)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            id="logout-confirm-btn"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-2xl text-xs font-black bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/30 transition-all hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-1.5"
          >
            <LogOut size={14} />
            Yes, Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
