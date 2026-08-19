import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, CheckCircle2, ShieldAlert, CheckSquare, Square, Search, RefreshCw, Archive, RotateCcw } from 'lucide-react';
import { moveToRecycleBin } from '../../services/recycleBinService';
import { extractRegNoClean, getStudentName, getFatherName } from './AdvancedReports';
import { logAdminActivity } from '../../services/adminActivityLogger';

export default function DeleteApplicationModal({
  isOpen,
  onClose,
  student,
  masterRecords = [],
  currentAdmissions = [],
  userEmail = 'Admin',
  onDeleteSuccess
}) {
  const [step, setStep] = useState(1);
  const [deleteScope, setDeleteScope] = useState('admissions');
  const [matchedRecords, setMatchedRecords] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [archiveStep, setArchiveStep] = useState('');
  const [successToast, setSuccessToast] = useState(null);

  useEffect(() => {
    if (isOpen && student) {
      setStep(1);
      setDeleteScope('admissions');
      setMatchedRecords([]);
      setSelectedDocIds(new Set());
      setDeleting(false);
      setArchiveStep('');
      setSuccessToast(null);
    }
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const studentName = getStudentName(student) || 'Student';
  const formNo = student['Form Number'] || student['Form No.'] || student.formNo || '—';
  const regNoClean = extractRegNoClean(student);
  const fatherName = getFatherName(student).toLowerCase();

  const handleNextStep = () => {
    if (deleteScope === 'admissions') {
      // Direct to final confirm for admissions only
      setStep(3);
    } else {
      // Search master registers & admissions for linked historical records
      const matches = [];
      const seenIds = new Set();

      // Always include the target student record
      const targetId = student.id || student.docId || formNo;
      matches.push({ ...student, _sourceCollection: student._source || (student._isCurrentScope ? 'admissions' : 'masterRegisters') });
      seenIds.add(targetId);

      const checkMatch = (st, sourceColl) => {
        if (!st) return;
        const stId = st.id || st.docId || st.formNo;
        if (seenIds.has(stId)) return;

        const stRegClean = extractRegNoClean(st);
        const stName = getStudentName(st).toLowerCase();
        const stFather = getFatherName(st).toLowerCase();
        const stForm = String(st['Form Number'] || st['Form No.'] || st.formNo || '').trim();

        const isRegMatch = regNoClean && stRegClean && regNoClean === stRegClean;
        const isFormMatch = formNo && formNo !== '—' && stForm && formNo.toLowerCase() === stForm.toLowerCase();
        const isNameMatch = studentName.toLowerCase() === stName && fatherName && stFather && fatherName === stFather;

        if (isRegMatch || isFormMatch || isNameMatch) {
          seenIds.add(stId);
          matches.push({ ...st, _sourceCollection: sourceColl });
        }
      };

      currentAdmissions.forEach(st => checkMatch(st, 'admissions'));
      masterRecords.forEach(st => checkMatch(st, 'masterRegisters'));

      setMatchedRecords(matches);
      // Default select all matched records
      setSelectedDocIds(new Set(matches.map(m => m.id || m.docId || m.formNo)));
      setStep(2);
    }
  };

  const toggleSelectRecord = (id) => {
    const next = new Set(selectedDocIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDocIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === matchedRecords.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(matchedRecords.map(m => m.id || m.docId || m.formNo)));
    }
  };

  const handleExecuteDeleteWithProgress = async () => {
    try {
      setDeleting(true);
      setArchiveStep('Archiving to Recycle Bin...');

      const recordsToDelete = deleteScope === 'admissions'
        ? [{ ...student, _sourceCollection: student._source || 'admissions' }]
        : matchedRecords.filter(m => selectedDocIds.has(m.id || m.docId || m.formNo));

      if (recordsToDelete.length === 0) {
        alert('Please select at least 1 record to delete.');
        setDeleting(false);
        setArchiveStep('');
        return;
      }

      // Run deletion with non-blocking timeout safety
      await Promise.race([
        Promise.all(recordsToDelete.map(rec => {
          const sourceColl = rec._sourceCollection || (rec._isCurrentScope ? 'admissions' : 'masterRegisters');
          return moveToRecycleBin(rec, sourceColl, userEmail);
        })),
        new Promise(resolve => setTimeout(resolve, 3500))
      ]);

      setArchiveStep('Logging activity...');
      logAdminActivity({
        actionType: 'delete',
        actionTitle: 'Application Archived to Recycle Bin',
        details: `Moved ${recordsToDelete.length} student record(s) for "${studentName}" (Form #${formNo}) to 90-day Recycle Bin.`,
        reasonCategory: 'Record Revocation / Soft Delete',
        metadata: { formNo, studentName, count: recordsToDelete.length }
      }).catch(() => {});

      setArchiveStep('Done ✅');

      if (onDeleteSuccess) {
        onDeleteSuccess(recordsToDelete);
      }

      setTimeout(() => {
        setArchiveStep('');
        setDeleting(false);
        onClose();
      }, 400);
    } catch (err) {
      console.error('Delete execution error:', err);
      setArchiveStep('');
      setDeleting(false);
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      {deleting && (
        <div className="absolute inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-3xl">
          <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/10 border border-white/20 shadow-2xl backdrop-blur-md">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-rose-500/30 rounded-full" />
              <div className="absolute w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute w-8 h-8 border-4 border-amber-400/50 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-black text-base tracking-wide">{archiveStep || 'Archiving...'}</p>
              <p className="text-white/60 text-xs font-semibold">Please wait — do not close this window</p>
            </div>
            <div className="flex gap-1.5 mt-1">
              {['Archiving to Recycle Bin...', 'Logging activity...', 'Done ✅'].map((step, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-10 rounded-full transition-all duration-500 ${
                    archiveStep === step ? 'bg-rose-500 scale-x-110' :
                    ['Archiving to Recycle Bin...', 'Logging activity...', 'Done ✅'].indexOf(archiveStep) > i ? 'bg-emerald-400' :
                    'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Delete & Archive Application
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Student: <span className="font-bold text-rose-600 dark:text-rose-400">{studentName}</span> (Form #{formNo})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-medium text-slate-700 dark:text-slate-300">
          {successToast && (
            <div className="p-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 text-emerald-900 dark:text-emerald-200 font-black flex items-center gap-2 animate-bounce">
              <CheckCircle2 size={16} />
              <span>{successToast}</span>
            </div>
          )}

          {/* STAGE 1: Choice between Admissions Only vs Admissions + Master Registers */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-900 dark:text-amber-200 leading-relaxed font-semibold">
                  Specify the scope of deletion. Deleted records will be safely archived in the <b>90-Day Recycle Bin</b>, where you can restore them anytime.
                </p>
              </div>

              <div className="space-y-2.5">
                <label
                  onClick={() => setDeleteScope('admissions')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    deleteScope === 'admissions'
                      ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteScope === 'admissions'}
                    onChange={() => setDeleteScope('admissions')}
                    className="mt-1 accent-rose-600"
                  />
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                      Delete from Active Admissions (2025–26) Only
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 font-medium">
                      Removes only the active 2025–26 intake application. Any historical master register entries will remain completely intact.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setDeleteScope('all')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    deleteScope === 'all'
                      ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteScope === 'all'}
                    onChange={() => setDeleteScope('all')}
                    className="mt-1 accent-rose-600"
                  />
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>Delete Admissions AND Linked Master Register Entries</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                        Full Purge
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 font-medium">
                      Searches database for all student records matching Board Registration Number ({regNoClean || 'N/A'}) or Name to purge linked records across past sessions.
                    </div>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>{deleteScope === 'all' ? 'Next: Review Linked Records ➔' : 'Proceed to Confirmation ➔'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: Master Registers Matching & Selection Checklist */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Search size={15} className="text-rose-600" />
                    <span>Select Applications to Archive</span>
                  </h4>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Found {matchedRecords.length} linked record(s) matching student profile.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedDocIds.size === matchedRecords.length ? <CheckSquare size={13} className="text-rose-600" /> : <Square size={13} />}
                  <span>{selectedDocIds.size === matchedRecords.length ? 'Deselect All' : 'Select All'}</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
                {matchedRecords.map((rec) => {
                  const recId = rec.id || rec.docId || rec.formNo;
                  const isSelected = selectedDocIds.has(recId);
                  const sourceStr = rec._sourceCollection === 'masterRegisters' ? 'Master Registers' : 'Active Admissions';
                  const sessStr = rec.Session || rec.session || '2025-26';
                  const clsStr = rec.Class || rec.class || '11th';
                  const fNoStr = rec['Form Number'] || rec['Form No.'] || rec.formNo || '—';

                  return (
                    <div
                      key={recId}
                      onClick={() => toggleSelectRecord(recId)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-rose-50/60 dark:bg-rose-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRecord(recId)}
                          className="accent-rose-600 w-4 h-4 rounded cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{getStudentName(rec) || 'Student'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              rec._sourceCollection === 'masterRegisters'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {sourceStr}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            Form #{fNoStr} • Class {clsStr} • Session {sessStr} • Reg: {rec['Board Registration Number'] || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ◀ Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedDocIds.size === 0}
                    onClick={() => setStep(3)}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Confirm ({selectedDocIds.size}) ➔</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3: Final Confirmation Summary */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-center space-y-2">
                <ShieldAlert size={32} className="text-rose-600 dark:text-rose-400 mx-auto animate-bounce" />
                <h4 className="font-black text-base text-rose-900 dark:text-rose-200">
                  Final Confirmation: Move to Recycle Bin
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-300 font-medium max-w-md mx-auto leading-relaxed">
                  You are about to archive <b>{deleteScope === 'admissions' ? 1 : selectedDocIds.size}</b> student record(s) for <b>{studentName}</b>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Safety Guarantee:</div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Archive size={14} />
                  <span>Records will be preserved in 90-Day Recycle Bin for 3 Months.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <RotateCcw size={12} />
                  <span>SuperAdmin & Admins can restore them with 1-click anytime before expiry.</span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(deleteScope === 'all' ? 2 : 1)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ◀ Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleExecuteDeleteWithProgress}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-black shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Archiving Records...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} />
                        <span>🗑️ Confirm &amp; Move to Recycle Bin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
