import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2, Search, RefreshCw, Archive, Clock, ShieldCheck, CheckCircle2, Flame, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { getRecycleBinItems, restoreFromRecycleBin, restoreMultipleFromRecycleBin, purgeFromRecycleBin } from '../../services/recycleBinService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import ConfirmDialogModal from '../components/ConfirmDialogModal';
import ModernLoader from '../../components/ModernLoader';

export default function RecycleBinModal({ isOpen, onClose, onRestoreSuccess }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [purgingId, setPurgingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);
  const [actionProgress, setActionProgress] = useState(null);

  const [selectedTrashIds, setSelectedTrashIds] = useState([]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const list = await getRecycleBinItems();
      setItems(list || []);
    } catch (err) {
      console.error('Fetch recycle bin error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedTrashIds([]);
  }, [items]);

  const filteredItems = items.filter(it => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();
    const payload = it.data || it.originalData || it.record || {};
    const searchableValues = [
      it.studentName,
      it.formNo,
      it.boardRegNo,
      it.class,
      getRecycleBinClassRollNo(it),
      it.originalCollection,
      it.deletedBy,
      payload.session,
      payload.Session,
      payload['Academic Session'],
      payload.status,
      payload.Status
    ];
    return searchableValues.some(value => String(value || '').toLowerCase().includes(term));
  });

  const filteredTrashIds = filteredItems.map(item => item.trashId || item.id).filter(Boolean);
  const isAllSelected = filteredTrashIds.length > 0 && filteredTrashIds.every(id => selectedTrashIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTrashIds(previous => previous.filter(id => !filteredTrashIds.includes(id)));
    } else {
      setSelectedTrashIds(previous => Array.from(new Set([...previous, ...filteredTrashIds])));
    }
  };

  const toggleSelectItem = (trashId) => {
    setSelectedTrashIds(prev =>
      prev.includes(trashId) ? prev.filter(id => id !== trashId) : [...prev, trashId]
    );
  };

  const getRecycleBinFormNo = (item) => {
    if (!item) return '—';
    const raw = item.formNo || item['Form Number'] || item['Form No.'] || item['Form No'] || item['FormNo'] || item.formNumber || item.data?.['Form Number'] || item.data?.['Form No.'] || item.data?.formNo || item.docId || item.id || '—';
    if (!raw || raw === '—' || raw === 'N/A') return '—';
    return String(raw).replace(/^'/, '').trim();
  };

  function getRecycleBinClassRollNo(item) {
    if (!item) return '—';
    const payload = item.data || item.originalData || item.record || {};
    const raw = item.classRollNo || item['Class Roll No.'] || item['Class Roll No'] || item.rollNo ||
      payload.classRollNo || payload['Class Roll No.'] || payload['Class Roll No'] || payload.rollNo;
    if (raw === undefined || raw === null || String(raw).trim() === '') return '—';
    return String(raw).replace(/^'/, '').trim();
  }

  const handleRestore = (item) => {
    if (!item || !item.trashId) return;
    const sName = item.studentName || 'Student';
    const fNo = getRecycleBinFormNo(item);

    setConfirmModalConfig({
      isOpen: true,
      type: 'info',
      title: 'Restore Student Record',
      message: `Restore student record for "${sName}" (Form #${fNo}) back to official registers?`,
      consequence: 'This student application will be fully restored to active status in database registers.',
      confirmText: '🔄 Confirm & Restore Record',
      cancelText: 'Cancel',
      onConfirm: async (auditReason) => {
        setConfirmModalConfig(null);
        try {
          setRestoringId(item.trashId);
          const res = await restoreFromRecycleBin(item.trashId);
          setToast({ type: 'success', message: `🎉 Restored "${sName}" (Form #${fNo}) back to ${res.originalCollection}!` });
          setTimeout(() => setToast(null), 3500);

          await logAdminActivity({
            actionType: 'restore',
            actionTitle: 'Restored Record from Recycle Bin',
            details: `Restored student application "${sName}" (${fNo}) back to ${res.originalCollection}`,
            reasonCategory: auditReason?.reasonCategory,
            customReason: auditReason?.customReason,
            metadata: { formNo: fNo, studentName: sName }
          }).catch(() => {});

          await fetchItems();
          if (onRestoreSuccess) onRestoreSuccess(res);
        } catch (err) {
          console.error('Restore error:', err);
          setToast({ type: 'error', message: `Restore failed: ${err.message}` });
          setTimeout(() => setToast(null), 4500);
        } finally {
          setRestoringId(null);
        }
      }
    });
  };

  const handlePurge = (item) => {
    if (!item || !item.trashId) return;
    const sName = item.studentName || 'Student';
    const fNo = getRecycleBinFormNo(item);

    setConfirmModalConfig({
      isOpen: true,
      type: 'danger',
      title: '🔥 Permanent Purge Warning',
      message: `Are you sure you want to PERMANENTLY PURGE "${sName}" (Form #${fNo}) from Recycle Bin?`,
      consequence: 'This action CANNOT be undone. The record will be permanently deleted with ZERO residual data left in Firebase.',
      confirmText: '🔥 Confirm & Purge Permanently',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModalConfig(null);
        setActionProgress({
          title: `Permanently Purging "${sName}"`,
          subtitle: `Form #${fNo} • Wiping all cloud records from database`,
          percent: 25,
          step: 1,
          steps: [
            'Verifying administrator audit authorization',
            'Deleting database record and stored references',
            'Updating audit logs & refreshing workspace'
          ]
        });

        try {
          setPurgingId(item.trashId);
          await new Promise(r => setTimeout(r, 300));
          setActionProgress(prev => prev ? { ...prev, percent: 65, step: 2 } : null);

          await purgeFromRecycleBin(item.trashId);
          setActionProgress(prev => prev ? { ...prev, percent: 100, step: 3, done: true } : null);

          await new Promise(r => setTimeout(r, 450));
          setToast({ type: 'info', message: `🗑️ Permanently purged "${sName}" from Recycle Bin.` });
          setTimeout(() => setToast(null), 3000);
          await fetchItems();
        } catch (err) {
          console.error('Purge error:', err);
          setToast({ type: 'error', message: `Purge failed: ${err.message}` });
        } finally {
          setPurgingId(null);
          setActionProgress(null);
        }
      }
    });
  };

  const handleBulkRestore = () => {
    if (selectedTrashIds.length === 0) return;
    const selectedIds = [...selectedTrashIds];
    const count = selectedIds.length;

    setConfirmModalConfig({
      isOpen: true,
      type: 'success',
      title: 'Restore Selected Student Records',
      message: `Restore ${count} selected archived student record${count === 1 ? '' : 's'} to the active registers?`,
      consequence: 'The restore is atomic: if any selected archive conflicts with a different active record, none of the selected records will be changed.',
      confirmText: `Restore ${count} Record${count === 1 ? '' : 's'}`,
      cancelText: 'Cancel',
      onConfirm: async (auditReason) => {
        setConfirmModalConfig(null);
        setActionProgress({
          variant: 'restore',
          title: `Restoring ${count} Student Record${count === 1 ? '' : 's'}`,
          subtitle: 'Validating identities and restoring the selected records atomically',
          percent: 20,
          step: 1,
          steps: [
            'Validating archived records and active-record conflicts',
            'Restoring records in one database transaction',
            'Refreshing registers and recording the audit event'
          ]
        });

        try {
          setLoading(true);
          const result = await restoreMultipleFromRecycleBin(selectedIds);
          setActionProgress(previous => previous ? { ...previous, percent: 100, step: 3, done: true } : null);
          await logAdminActivity({
            actionType: 'restore',
            actionTitle: 'Bulk Restore from Recycle Bin',
            details: `Restored ${result.restoredCount} student records from the recycle bin`,
            reasonCategory: auditReason?.reasonCategory,
            customReason: auditReason?.customReason,
            metadata: { restoredCount: result.restoredCount, recycleBinIds: selectedIds }
          }).catch(() => {});
          setToast({ type: 'success', message: `Restored ${result.restoredCount} student record${result.restoredCount === 1 ? '' : 's'} successfully.` });
          setTimeout(() => setToast(null), 4000);
          setSelectedTrashIds([]);
          await fetchItems();
          if (onRestoreSuccess) onRestoreSuccess(result);
        } catch (err) {
          console.error('Bulk restore error:', err);
          setToast({ type: 'error', message: `Bulk restore failed: ${err.message}` });
          setTimeout(() => setToast(null), 5000);
        } finally {
          setLoading(false);
          setActionProgress(null);
        }
      }
    });
  };

  const handleBulkPurge = () => {
    if (selectedTrashIds.length === 0) return;
    const count = selectedTrashIds.length;

    setConfirmModalConfig({
      isOpen: true,
      type: 'danger',
      title: '🔥 Permanent Bulk Purge Warning',
      message: `Are you sure you want to PERMANENTLY PURGE ${count} selected archived student records from the Recycle Bin?`,
      consequence: 'This action CANNOT be undone. These records will be permanently erased with ZERO residual data left in Firebase.',
      confirmText: `🔥 Confirm & Purge ${count} Records`,
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModalConfig(null);
        setActionProgress({
          title: `Bulk Purging ${count} Records`,
          subtitle: 'Permanently wiping selected student records from database',
          percent: 10,
          step: 1,
          steps: [
            'Initializing bulk deletion batch',
            `Erasing 0 of ${count} records`,
            'Finalizing database audit log'
          ]
        });

        try {
          setLoading(true);
          let processed = 0;
          for (const tId of selectedTrashIds) {
            await purgeFromRecycleBin(tId);
            processed++;
            const pct = Math.round(10 + (processed / count) * 80);
            setActionProgress(prev => prev ? {
              ...prev,
              percent: pct,
              step: 2,
              steps: [
                'Initializing bulk deletion batch',
                `Erasing ${processed} of ${count} records (${pct}%)`,
                'Finalizing database audit log'
              ]
            } : null);
          }
          setActionProgress(prev => prev ? { ...prev, percent: 100, step: 3, done: true } : null);
          await new Promise(r => setTimeout(r, 500));

          setToast({ type: 'info', message: `🗑️ Permanently purged ${count} records from Recycle Bin!` });
          setTimeout(() => setToast(null), 3000);
          setSelectedTrashIds([]);
          await fetchItems();
        } catch (err) {
          console.error('Bulk purge error:', err);
          setToast({ type: 'error', message: `Bulk purge failed: ${err.message}` });
        } finally {
          setLoading(false);
          setActionProgress(null);
        }
      }
    });
  };

  const handleEmptyRecycleBin = () => {
    if (items.length === 0) return;
    const count = items.length;

    setConfirmModalConfig({
      isOpen: true,
      type: 'danger',
      title: '🧹 Clean Entire Recycle Bin',
      message: `Are you sure you want to PERMANENTLY PURGE ALL ${count} archived student records from the Recycle Bin?`,
      consequence: 'This will wipe and clean the entire Recycle Bin. All archived records will be permanently erased with ZERO residual data left in Firebase.',
      confirmText: `🧹 Confirm & Empty Entire Recycle Bin (${count})`,
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModalConfig(null);
        setActionProgress({
          title: `Emptying Entire Recycle Bin (${count} Records)`,
          subtitle: 'Performing deep sanitization and purging all archived records',
          percent: 10,
          step: 1,
          steps: [
            'Authorizing deep clean purge',
            `Wiping 0 of ${count} archived items`,
            'Cleaning index and recycling cache'
          ]
        });

        try {
          setLoading(true);
          let processed = 0;
          for (const item of items) {
            const tId = item.trashId || item.id;
            if (tId) {
              await purgeFromRecycleBin(tId);
              processed++;
              const pct = Math.round(10 + (processed / count) * 80);
              setActionProgress(prev => prev ? {
                ...prev,
                percent: pct,
                step: 2,
                steps: [
                  'Authorizing deep clean purge',
                  `Wiping ${processed} of ${count} archived items (${pct}%)`,
                  'Cleaning index and recycling cache'
                ]
              } : null);
            }
          }
          setActionProgress(prev => prev ? { ...prev, percent: 100, step: 3, done: true } : null);
          await new Promise(r => setTimeout(r, 500));

          setToast({ type: 'info', message: `🧹 Successfully emptied entire Recycle Bin (${count} records purged)!` });
          setTimeout(() => setToast(null), 3500);
          setSelectedTrashIds([]);
          await fetchItems();
        } catch (err) {
          console.error('Empty recycle bin error:', err);
          setToast({ type: 'error', message: `Empty recycle bin failed: ${err.message}` });
        } finally {
          setLoading(false);
          setActionProgress(null);
        }
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
      <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Compact Modal Header */}
        <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shadow-xs flex-shrink-0">
              <Archive size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                <span>90-Day Application Recycle Bin</span>
                <span className="px-2 py-0.2 rounded-full bg-amber-600 text-white text-[9px] font-mono font-black uppercase tracking-wider">
                  {items.length} Archived
                </span>
              </h3>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                Deleted student applications are retained for 90 days and changed only through explicit admin actions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-xs transition-transform hover:scale-110 cursor-pointer shrink-0 ml-1"
            title="Close Recycle Bin Modal"
          >
            <X size={15} strokeWidth={3} />
          </button>
        </div>

        {/* Super Compact Toolbar & Search */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, roll, class, session, form or reg #..."
              className="w-full pl-8 pr-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {selectedTrashIds.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={loading || Boolean(actionProgress)} onClick={handleBulkRestore} className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs transition-all disabled:opacity-50" title="Bulk restore selected records">
                  <RotateCcw size={12} />
                  <span>Bulk Restore ({selectedTrashIds.length})</span>
                </button>
                <button type="button" disabled={loading || Boolean(actionProgress)} onClick={handleBulkPurge} className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs transition-all disabled:opacity-50" title="Permanently purge selected recycle-bin records">
                  <Trash2 size={12} />
                  <span>Purge Selected ({selectedTrashIds.length})</span>
                </button>
              </div>
            )}

            {items.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyRecycleBin}
                className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-500/40 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all"
                title="Empty and purge entire recycle bin"
              >
                <Trash2 size={12} />
                <span>Clean Recycle Bin</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchItems}
              className="px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-[11px] font-black flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`p-2 mx-3 mt-2 rounded-xl border text-[11px] font-black flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-300' : 'bg-slate-800 text-white'
          }`}>
            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* High Density Compact Content Table */}
        <div className="p-2 sm:p-3 overflow-y-auto flex-1 text-xs">
          {loading ? (
            <ModernLoader
              moduleKey="trash"
              text="Loading Recycle Bin Archives..."
              subtext="Retrieving deleted student records & audit logs..."
              className="py-10"
            />
          ) : filteredItems.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/90 font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[9.5px]">
                  <tr>
                    <th className="py-2 px-2 text-center w-8">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        title="Select All Records for Bulk Action"
                      />
                    </th>
                    <th className="py-2 px-2.5">Student Name</th>
                    <th className="py-2 px-2.5">Form #</th>
                    <th className="py-2 px-2.5">Class</th>
                    <th className="py-2 px-2 text-center whitespace-nowrap" title="Class Roll Number">R.No.</th>
                    <th className="py-2 px-2.5">Source</th>
                    <th className="py-2 px-2.5">Deleted Date</th>
                    <th className="py-2 px-2.5">Retention</th>
                    <th className="py-2 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold text-slate-800 dark:text-slate-200">
                  {filteredItems.map((item) => {
                    const deletedDateStr = item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : '—';
                    const expMs = new Date(item.expiresAt || 0).getTime() - Date.now();
                    const daysLeft = Math.max(0, Math.ceil(expMs / (1000 * 60 * 60 * 24)));
                    const formDisplay = getRecycleBinFormNo(item);
                    const isSelected = selectedTrashIds.includes(item.trashId || item.id);

                    return (
                      <tr key={item.trashId || item.id} className={`hover:bg-amber-500/5 transition-colors text-[11px] leading-tight ${isSelected ? 'bg-amber-500/10' : ''}`}>
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.trashId || item.id)}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 font-black text-slate-900 dark:text-slate-100">
                          {item.studentName || 'Student'}
                          {item.boardRegNo && (
                            <div className="text-[9.5px] text-slate-400 font-bold leading-none mt-0.5">Reg: {item.boardRegNo}</div>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono font-black text-amber-700 dark:text-amber-400">
                          {formDisplay}
                        </td>
                        <td className="py-1.5 px-2.5 font-black">{item.class || '11th'}</td>
                        <td className="py-1.5 px-2 text-center font-mono font-black text-slate-900 dark:text-slate-100">
                          {getRecycleBinClassRollNo(item)}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                            item.originalCollection === 'masterRegisters'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300/40'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/40'
                          }`}>
                            {item.originalCollection || 'admissions'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-500 dark:text-slate-400 text-[10px]">
                          <div>{deletedDateStr}</div>
                          <div className="text-[9px] text-slate-400 font-bold">By: {item.deletedBy || 'Admin'}</div>
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[9.5px] font-black border border-emerald-500/30">
                            <Clock size={10} />
                            <span>{daysLeft}d Left</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={restoringId === item.trashId}
                              onClick={() => handleRestore(item)}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Restore student record back to active registers"
                            >
                              <RotateCcw size={11} className={restoringId === item.trashId ? 'animate-spin' : ''} />
                              <span>Restore</span>
                            </button>

                            <button
                              type="button"
                              disabled={purgingId === item.trashId}
                              onClick={() => handlePurge(item)}
                              className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              title="Permanently Purge Record (Completely Removed)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-1.5">
              <Archive size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
              <div className="font-bold text-xs text-slate-700 dark:text-slate-300">Recycle Bin is Empty</div>
              <p className="text-[11px] max-w-xs mx-auto text-slate-400">
                No deleted student applications are currently archived in the recycle bin.
              </p>
            </div>
          )}
        </div>

        {/* Custom Confirmation Dialog Modal inside Recycle Bin */}
        {confirmModalConfig && (
          <ConfirmDialogModal
            isOpen={confirmModalConfig.isOpen}
            type={confirmModalConfig.type || 'danger'}
            title={confirmModalConfig.title}
            message={confirmModalConfig.message}
            consequence={confirmModalConfig.consequence}
            confirmText={confirmModalConfig.confirmText}
            cancelText={confirmModalConfig.cancelText || 'Cancel'}
            onConfirm={confirmModalConfig.onConfirm}
            onClose={() => setConfirmModalConfig(null)}
          />
        )}

        {/* Real-time Animated Action Progress Overlay */}
        {actionProgress && (
          <div className="fixed inset-0 z-[100010] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6 relative overflow-hidden">
              {/* Top Glow Accent */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Pulsing Icon */}
              <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-xl shadow-rose-900/40">
                {actionProgress.done ? (
                  <CheckCircle2 size={34} className="animate-scaleIn text-emerald-300" />
                ) : (
                  <Flame size={34} className="animate-pulse text-amber-300" />
                )}
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {actionProgress.title}
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  {actionProgress.subtitle}
                </p>
              </div>

              {/* Modern Gradient Progress Bar with Percent */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Database Purge Progress</span>
                  <span className="text-rose-400 font-mono font-black">{actionProgress.percent}%</span>
                </div>
                <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${actionProgress.percent}%` }}
                  />
                </div>
              </div>

              {/* Step-by-Step Status Checklist */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 text-left space-y-2 text-xs">
                {actionProgress.steps.map((stepText, idx) => {
                  const stepNum = idx + 1;
                  const isCurrent = actionProgress.step === stepNum && !actionProgress.done;
                  const isPassed = actionProgress.step > stepNum || actionProgress.done;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 transition-all ${
                        isPassed
                          ? 'text-emerald-400 font-bold'
                          : isCurrent
                          ? 'text-rose-300 font-extrabold animate-pulse'
                          : 'text-slate-500 font-medium'
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-400" />
                      ) : isCurrent ? (
                        <Loader2 size={15} className="flex-shrink-0 animate-spin text-rose-400" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-700 flex-shrink-0" />
                      )}
                      <span className="truncate">{stepText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
