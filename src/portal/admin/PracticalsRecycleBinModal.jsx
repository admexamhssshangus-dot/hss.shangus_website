import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, RotateCcw, Trash2, Search, RefreshCw, Archive, Clock,
  CheckCircle2, Flame, Loader2, AlertTriangle, Users,
  BookOpen, ChevronDown
} from 'lucide-react';
import {
  getPracticalsRecycleBinItems,
  restoreSubmissionFromBin,
  purgeSubmissionFromBin
} from '../../services/practicalsBinService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { auth } from '../../services/firebase';
import ConfirmDialogModal from '../components/ConfirmDialogModal';
import ModernLoader from '../../components/ModernLoader';

function StatusBadge({ item }) {
  if (item.wasRestored) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[9px] font-black border border-emerald-500/30 uppercase tracking-wider">
        <CheckCircle2 size={9} /> Restored
      </span>
    );
  }
  if (item.originalStatus === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-800 dark:text-blue-300 text-[9px] font-black border border-blue-500/30 uppercase tracking-wider">
        Was Approved
      </span>
    );
  }
  if (item.originalStatus === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-300 text-[9px] font-black border border-rose-500/30 uppercase tracking-wider">
        <AlertTriangle size={9} /> Was Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[9px] font-black border border-amber-500/30 uppercase tracking-wider">
      <Clock size={9} /> Was Pending
    </span>
  );
}

export default function PracticalsRecycleBinModal({ isOpen, onClose, onRestoreSuccess }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [purgingId, setPurgingId] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [actionProgress, setActionProgress] = useState(null);
  const [toast, setToast] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const list = await getPracticalsRecycleBinItems();
      setItems(list || []);
    } catch (err) {
      console.error('[PracticalsRecycleBin] Fetch error:', err);
      setToast({ type: 'error', message: `Failed to load recycle bin: ${err.message}` });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isOpen) fetchItems(); }, [isOpen]); // eslint-disable-line

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase().trim();
    return items.filter(it => {
      const hay = [
        it.subject, it.subjectCode, it.className, it.practicalType,
        it.yearSuffix, it.submittedBy, it.submittedByEmail,
        it.deletedBy, it.originalDocId
      ].map(v => String(v || '').toLowerCase()).join(' ');
      return hay.includes(term);
    });
  }, [items, searchTerm]);

  const restorableCount = items.filter(i => i.restorable).length;

  // ── Restore ──────────────────────────────────────────────────────
  const handleRestore = (item) => {
    if (!item || !item.restorable) return;
    const label = `${item.subject || 'Subject'} (${item.className || 'Class'})`;
    const teacher = item.submittedBy || 'Teacher';
    setConfirmConfig({
      isOpen: true,
      type: 'success',
      title: 'Restore Submission Back to Active Records?',
      message: `Restore the award submission for "${label}" originally submitted by ${teacher} (${item.recordsCount || 0} students) back into the live database?`,
      consequence: 'If the teacher has already re-submitted afresh, the restoration will FAIL SAFELY with a conflict error to protect new data.',
      confirmText: 'Confirm & Restore Submission',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          setRestoringId(item.id);
          const cu = auth.currentUser;
          await restoreSubmissionFromBin(item.id, {
            name: cu?.displayName || 'Administrator',
            email: cu?.email || '',
          });
          await logAdminActivity({
            actionType: 'restore',
            actionTitle: 'Restored Practical Submission from Recycle Bin',
            details: `Restored award submission "${label}" by ${teacher} back to practicalsData`,
            metadata: { binDocId: item.id, originalDocId: item.originalDocId, subject: item.subject, className: item.className }
          }).catch(() => {});
          showToast('success', `Submission for "${label}" restored to live database!`);
          await fetchItems();
          if (onRestoreSuccess) onRestoreSuccess(item);
        } catch (err) {
          console.error('[PracticalsRecycleBin] Restore error:', err);
          showToast('error', `Restore failed: ${err.message}`);
        } finally {
          setRestoringId(null);
        }
      }
    });
  };

  // ── Purge ────────────────────────────────────────────────────────
  const handlePurge = (item) => {
    if (!item) return;
    const label = `${item.subject || 'Subject'} (${item.className || 'Class'})`;
    setConfirmConfig({
      isOpen: true,
      type: 'danger',
      title: 'Permanently Delete from Recycle Bin?',
      message: `PERMANENTLY PURGE the recycled submission for "${label}" by ${item.submittedBy || 'Teacher'}?`,
      consequence: 'This cannot be undone. The submission data will be permanently erased — the teacher can still submit afresh (their slot is already free).',
      confirmText: 'Permanently Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmConfig(null);
        setActionProgress({
          title: `Purging "${label}"`,
          subtitle: `${item.recordsCount || 0} student records`,
          percent: 25, step: 1,
          steps: ['Starting purge', 'Deleting from recycle bin', 'Complete']
        });
        try {
          setPurgingId(item.id);
          await new Promise(r => setTimeout(r, 350));
          setActionProgress(p => p ? { ...p, percent: 65, step: 2 } : null);
          await purgeSubmissionFromBin(item.id);
          setActionProgress(p => p ? { ...p, percent: 100, step: 3, done: true } : null);
          await logAdminActivity({
            actionType: 'delete',
            actionTitle: 'Permanently Purged Practical Submission from Recycle Bin',
            details: `Permanently purged "${label}" (${item.originalDocId}) from practicalsRecycleBin`,
            metadata: { binDocId: item.id, subject: item.subject, className: item.className }
          }).catch(() => {});
          await new Promise(r => setTimeout(r, 500));
          showToast('success', `Submission for "${label}" permanently deleted.`);
          await fetchItems();
        } catch (err) {
          console.error('[PracticalsRecycleBin] Purge error:', err);
          showToast('error', `Purge failed: ${err.message}`);
        } finally {
          setPurgingId(null);
          setActionProgress(null);
        }
      }
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Practicals Submission Recycle Bin"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto"
      style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}
    >
      <div className="bg-white dark:bg-slate-900 border border-violet-500/30 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] my-auto">

        {/* Header */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-violet-500/12 via-purple-500/8 to-violet-500/12 flex items-center justify-between flex-shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-black shadow-sm flex-shrink-0">
              <Archive size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                  Practicals Submission Recycle Bin
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[9px] font-mono font-black uppercase tracking-wider flex-shrink-0">
                  {items.length} Items
                </span>
                {restorableCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-mono font-black uppercase tracking-wider flex-shrink-0">
                    {restorableCount} Restorable
                  </span>
                )}
              </div>
              <p className="text-[9.5px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                Admin-deleted award submissions — teacher slot is now free to re-submit • 90-day retention
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-transform hover:scale-110 cursor-pointer shrink-0 ml-1"
            title="Close Recycle Bin"
          >
            <X size={15} strokeWidth={3} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search subject, class, teacher, session, doc ID…"
              className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <button
            type="button"
            onClick={fetchItems}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-[11px] font-black flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-300"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Notice Banner */}
        <div className="mx-3 mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 flex-shrink-0">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[10.5px] font-bold text-amber-800 dark:text-amber-300 leading-snug">
            <strong>Teacher Slot Freed:</strong> When a submission is moved here, the teacher's Firestore slot is cleared —
            they can immediately submit awards afresh. Restoring will only succeed if the teacher has NOT yet resubmitted (conflict-safe protection).
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`p-2 mx-3 mt-2 rounded-xl border text-[11px] font-black flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-300'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
              : <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Content Table */}
        <div className="p-2 sm:p-3 overflow-x-auto overflow-y-auto flex-1 text-xs">
          {loading ? (
            <ModernLoader moduleKey="practicals" text="Loading Practicals Recycle Bin…" subtext="Please wait." className="py-10" />
          ) : filteredItems.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm min-w-[720px] sm:min-w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/90 font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[9.5px]">
                  <tr>
                    <th className="py-2 px-2.5">Subject</th>
                    <th className="py-2 px-2.5">Class</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2">Session</th>
                    <th className="py-2 px-2 text-center">Students</th>
                    <th className="py-2 px-2.5">Teacher</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Deleted</th>
                    <th className="py-2 px-2">Expires</th>
                    <th className="py-2 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold text-slate-800 dark:text-slate-200">
                  {filteredItems.map((item) => {
                    const deletedDateStr = item.deletedAt
                      ? new Date(item.deletedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—';
                    const expMs = new Date(item.expiresAt || 0).getTime() - Date.now();
                    const daysLeft = Math.max(0, Math.ceil(expMs / (1000 * 60 * 60 * 24)));
                    const isExpanded = expandedId === item.id;
                    const isRestoring = restoringId === item.id;
                    const isPurging = purgingId === item.id;

                    return (
                      <React.Fragment key={item.id}>
                        <tr className={`hover:bg-violet-500/5 transition-colors text-[11px] leading-tight ${!item.restorable ? 'opacity-60' : ''}`}>
                          <td className="py-1.5 px-2.5 font-black text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-1">
                              <BookOpen size={10} className="text-violet-500 flex-shrink-0" />
                              <span>{item.subject || '—'}</span>
                            </div>
                            {item.subjectCode && (
                              <div className="text-[9px] text-slate-400 font-mono ml-3.5">{item.subjectCode}</div>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 font-black">{item.className || '—'}</td>
                          <td className="py-1.5 px-2">
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[9px] font-black border border-purple-300/40 whitespace-nowrap">
                              {item.practicalType || 'Internal'}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 font-mono text-slate-600 dark:text-slate-400 text-[10px]">{item.yearSuffix || '—'}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-black border border-slate-300/40">
                              <Users size={9} />{item.recordsCount || 0}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5">
                            <div className="font-black text-slate-900 dark:text-slate-100 truncate max-w-[110px]" title={item.submittedBy}>
                              {item.submittedBy || '—'}
                            </div>
                            {item.submittedByEmail && (
                              <div className="text-[9px] text-slate-400 font-bold truncate max-w-[110px]">{item.submittedByEmail}</div>
                            )}
                          </td>
                          <td className="py-1.5 px-2"><StatusBadge item={item} /></td>
                          <td className="py-1.5 px-2 text-slate-500 dark:text-slate-400 text-[10px]">
                            <div>{deletedDateStr}</div>
                            <div className="text-[9px] text-slate-400 font-bold">By: {item.deletedBy || 'Admin'}</div>
                          </td>
                          <td className="py-1.5 px-2">
                            {item.expiresAt ? (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border ${
                                daysLeft <= 7 ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/30'
                                : daysLeft <= 30 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30'
                              }`}>
                                <Clock size={9} />{daysLeft}d
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
                                title="View original document ID"
                              >
                                <ChevronDown size={11} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {item.restorable && (
                                <button
                                  type="button"
                                  disabled={isRestoring || isPurging}
                                  onClick={() => handleRestore(item)}
                                  className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Restore submission back to active database"
                                >
                                  {isRestoring ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                                  <span>Restore</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isRestoring || isPurging}
                                onClick={() => handlePurge(item)}
                                className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                                title="Permanently purge from recycle bin"
                              >
                                {isPurging ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="bg-violet-500/5 dark:bg-violet-950/20">
                            <td colSpan={10} className="px-3 py-2">
                              <div className="flex flex-wrap gap-3 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                <span>
                                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Original Doc ID: </span>
                                  <code className="font-mono text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/40 px-1.5 py-0.5 rounded select-all">{item.originalDocId || '—'}</code>
                                </span>
                                <span>
                                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Bin Doc ID: </span>
                                  <code className="font-mono text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all text-[9px]">{item.id || '—'}</code>
                                </span>
                                {item.wasRestored && (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    Restored on {item.restoredAt ? new Date(item.restoredAt).toLocaleString('en-IN') : '—'} by {item.restoredBy || 'Admin'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-1.5">
              <Archive size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
              <div className="font-bold text-xs text-slate-700 dark:text-slate-300">
                {searchTerm ? 'No matching submissions found' : 'Practicals Recycle Bin is Empty'}
              </div>
              <p className="text-[11px] max-w-xs mx-auto text-slate-400">
                {searchTerm ? 'Try a different search term.' : 'No deleted award submissions are archived. When an admin soft-deletes a submission, it appears here.'}
              </p>
            </div>
          )}
        </div>

        {/* Confirm Dialog */}
        {confirmConfig && (
          <ConfirmDialogModal
            isOpen={confirmConfig.isOpen}
            type={confirmConfig.type || 'danger'}
            title={confirmConfig.title}
            message={confirmConfig.message}
            consequence={confirmConfig.consequence}
            confirmText={confirmConfig.confirmText}
            cancelText={confirmConfig.cancelText || 'Cancel'}
            onConfirm={confirmConfig.onConfirm}
            onClose={() => setConfirmConfig(null)}
          />
        )}

        {/* Action Progress Overlay */}
        {actionProgress && (
          <div
            role="status"
            aria-live="polite"
            aria-busy={!actionProgress.done}
            className="fixed inset-0 z-[100010] flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn"
          >
            <div className="bg-white dark:bg-slate-900 border-2 border-rose-400 dark:border-rose-500/60 rounded-2xl sm:rounded-3xl p-4 sm:p-7 max-w-md w-full shadow-2xl text-center space-y-4 relative overflow-y-auto max-h-[calc(100dvh-1.5rem)]">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-xl shadow-rose-900/40">
                {actionProgress.done
                  ? <CheckCircle2 size={34} className="animate-scaleIn text-emerald-300" />
                  : <Flame size={34} className="animate-pulse text-amber-300" />}
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-xl font-black text-slate-950 dark:text-white tracking-tight">{actionProgress.title}</h3>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{actionProgress.subtitle}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800 dark:text-slate-100">Progress</span>
                  <span className="text-rose-700 dark:text-rose-300 font-mono font-black">{actionProgress.percent}%</span>
                </div>
                <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${actionProgress.percent}%` }}
                  />
                </div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-950/70 rounded-2xl p-3 border border-slate-300 dark:border-slate-700 text-left space-y-2 text-xs">
                {actionProgress.steps.map((stepText, idx) => {
                  const stepNum = idx + 1;
                  const isCurrent = actionProgress.step === stepNum && !actionProgress.done;
                  const isPassed = actionProgress.step > stepNum || actionProgress.done;
                  return (
                    <div key={idx} className={`flex items-center gap-2.5 transition-all ${isPassed ? 'text-emerald-400 font-bold' : isCurrent ? 'text-rose-700 dark:text-rose-300 font-extrabold' : 'text-slate-600 dark:text-slate-300 font-medium'}`}>
                      {isPassed ? <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-400" />
                        : isCurrent ? <Loader2 size={15} className="flex-shrink-0 animate-spin text-rose-400" />
                        : <div className="w-3.5 h-3.5 rounded-full border border-slate-500 flex-shrink-0" />}
                      <span>{stepText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}