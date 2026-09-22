import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Check, AlertTriangle, ShieldCheck, Save, RefreshCw, User, Award,
  CheckCircle2, XCircle, Clock, FileText, ChevronRight, Hash, Sparkles,
  Info, History, Edit3
} from 'lucide-react';
import { db, auth } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { invalidateCollectionCache } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { formatPracticalDocId } from '../../utils/practicalsSettingsManager';
import { showToast } from '../../components/common/GlobalToast';
import { isStudentEnrolledInSubject, invalidatePracticalsCache } from './AdminPracticals';
import { sanitizeForFirestore } from '../../utils/firestoreSanitizer';

const REASON_PRESETS = [
  'Re-evaluation result',
  'Teacher clerical correction',
  'Grievance redressal',
  'Late award submission entry',
  'Student enrollment correction',
  'Principal approved moderation'
];

export default function AdminGazetteRecordEditModal({
  isOpen,
  onClose,
  candidate,
  selectedClass,
  selectedSession,
  selectedEvalType,
  subjectsList = [],
  practicalsDocs = [],
  onSaved
}) {
  const [marksState, setMarksState] = useState({});
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const adminEmail = auth.currentUser?.email || 'Admin';

  // Initialize marks state when modal opens
  useEffect(() => {
    if (!isOpen || !candidate) return;

    const initialMarks = {};
    subjectsList.forEach(subj => {
      const code = subj.code;
      const m = candidate.subjectMarks?.[code];
      const isEnrolled = isStudentEnrolledInSubject(candidate.student, code, selectedClass);

      initialMarks[code] = {
        code,
        name: subj.name,
        maxMarks: subj.maxMarks || 50,
        minMarks: subj.minMarks || 18,
        isEnrolled,
        val: m?.isAbsent ? 'AB' : (m?.obtained !== null && m?.obtained !== undefined ? String(m.obtained) : ''),
        originalVal: m?.isAbsent ? 'AB' : (m?.obtained !== null && m?.obtained !== undefined ? String(m.obtained) : ''),
        updatedByAdmin: m?.updatedByAdmin || false,
        updatedBy: m?.updatedBy || '',
        updatedAt: m?.updatedAt || '',
        editReason: m?.editReason || '',
        docId: m?.docId || ''
      };
    });

    setMarksState(initialMarks);
    setEditReason('');
    setErrorMsg('');
  }, [isOpen, candidate, subjectsList, selectedClass]);

  // Handle Mark Change for a Subject
  const handleMarkChange = (code, rawVal) => {
    const clean = String(rawVal).toUpperCase().trim();
    setMarksState(prev => {
      const current = prev[code];
      if (!current) return prev;
      return {
        ...prev,
        [code]: {
          ...current,
          val: clean
        }
      };
    });
    if (!editReason.trim()) {
      setEditReason('Administrative mark correction');
    }
  };

  // Toggle Absent
  const handleToggleAbsent = (code) => {
    setMarksState(prev => {
      const current = prev[code];
      if (!current) return prev;
      const isCurrentlyAb = current.val === 'AB';
      return {
        ...prev,
        [code]: {
          ...current,
          val: isCurrentlyAb ? '' : 'AB'
        }
      };
    });
    if (!editReason.trim()) {
      setEditReason('Candidate attendance/absentee status correction');
    }
  };

  // Revert mark to original
  const handleResetSubject = (code) => {
    setMarksState(prev => {
      const current = prev[code];
      if (!current) return prev;
      return {
        ...prev,
        [code]: {
          ...current,
          val: current.originalVal
        }
      };
    });
  };

  // Compute live assessment summary
  const assessmentSummary = useMemo(() => {
    let totalObt = 0;
    let totalMax = 0;
    let evalCount = 0;
    let failedCount = 0;
    let absentCount = 0;
    const failedCodes = [];

    Object.values(marksState).forEach(sub => {
      const v = String(sub.val).trim().toUpperCase();
      if (!v) return;

      if (v === 'AB' || v === 'A' || v === 'ABSENT') {
        absentCount++;
        evalCount++;
        totalMax += sub.maxMarks;
        failedCount++;
        failedCodes.push(sub.code);
      } else {
        const num = Number(v);
        if (Number.isFinite(num) && num >= 0) {
          evalCount++;
          totalObt += num;
          totalMax += sub.maxMarks;
          if (num < sub.minMarks) {
            failedCount++;
            failedCodes.push(sub.code);
          }
        }
      }
    });

    const pct = totalMax > 0 ? ((totalObt / totalMax) * 100).toFixed(1) : '0.0';
    let result = 'PENDING';
    if (evalCount > 0) {
      if (failedCount === 0) {
        result = 'PASS';
      } else if (absentCount === evalCount) {
        result = 'ABSENT';
      } else {
        result = `REAP (${failedCodes.join(', ')})`;
      }
    }

    return { totalObt, totalMax, pct, result, evalCount, failedCount };
  }, [marksState]);

  // Has any mark actually changed?
  const hasChanges = useMemo(() => {
    return Object.values(marksState).some(sub => sub.val !== sub.originalVal);
  }, [marksState]);

  // Save changes to Firestore
  const handleSave = async () => {
    if (!hasChanges) {
      showToast('No mark changes detected.', 'info');
      onClose();
      return;
    }

    const effectiveReason = editReason.trim() || 'Administrative mark correction';

    setIsSaving(true);
    setErrorMsg('');

    try {
      const nowIso = new Date().toISOString();
      const changedSubjects = Object.values(marksState).filter(sub => sub.val !== sub.originalVal);

      const rollVal = String(candidate.rollNo || candidate.student?.classRollNo || candidate.student?.rollNo || '').trim();
      const rawReg = String(candidate.regNo || candidate.student?.boardRegNo || candidate.student?.regNo || '').trim();
      const regVal = rawReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const nameVal = String(candidate.name || candidate.student?.studentName || candidate.student?.name || '').trim();
      const parentVal = String(candidate.fatherName || candidate.student?.parentName || candidate.student?.fatherName || '').trim();
      const examVal = String(candidate.student?.examRollNo || candidate.student?.['Exam R.No. (Current)'] || '').trim().toUpperCase();

      const normSession = String(selectedSession || '2025-26').trim();

      for (const sub of changedSubjects) {
        // 1. Identify canonical approved document in practicalsData (STRICTLY exclude pending, history, or bin)
        const cleanSubDocId = String(sub.docId || '').replace(/^pending_/, '');

        const targetEvalNorm = String(selectedEvalType || 'Pre-Board Test').toLowerCase().trim();

        const matchedDoc = practicalsDocs.find(d => {
          const dId = String(d.id || d.docId || '');
          if (dId.startsWith('pending_') || dId.startsWith('history_') || dId.startsWith('bin_')) return false;
          if (cleanSubDocId && dId === cleanSubDocId) return true;
          const sCode = (d.subjectCode || '').toUpperCase().trim();
          const sName = (d.subjectName || d.subject || '').toUpperCase().trim();
          const dClass = String(d.className || d.class || '').replace(/class/i, '').trim().toLowerCase();
          const sClass = String(selectedClass || '').replace(/class/i, '').trim().toLowerCase();
          const classMatches = dClass === sClass || dClass.includes(sClass) || sClass.includes(dClass);
          const subjectMatches = sCode === sub.code || sName === sub.name.toUpperCase();

          const dEval = String(d.practicalType || d.evaluationType || '').toLowerCase().trim();
          const evalMatches = !targetEvalNorm || dEval.includes(targetEvalNorm) || targetEvalNorm.includes(dEval) ||
            (targetEvalNorm.includes('preboard') && dEval.includes('preboard')) ||
            (targetEvalNorm.includes('internal') && dEval.includes('internal'));

          return classMatches && subjectMatches && evalMatches;
        });

        const targetDocId = (matchedDoc && matchedDoc.id) || cleanSubDocId || formatPracticalDocId(selectedClass, sub.name, selectedEvalType || 'Pre-Board Test', normSession);

        // Fetch latest version of document from Firestore
        const docRef = doc(db, 'practicalsData', targetDocId);
        const docSnap = await getDoc(docRef);

        let docData = docSnap.exists() ? docSnap.data() : (matchedDoc || {});
        let records = Array.isArray(docData.records) ? [...docData.records] : [];

        // Check if there is an existing pending doc (e.g. pending_12th_Chemistry_Pre-Board Test_2025-26)
        const pendingDocId = `pending_${targetDocId}`;
        const sourcePendingDoc = practicalsDocs.find(d => {
          const dId = String(d.id || d.docId || '');
          return dId === pendingDocId || (sub.docId && (dId === sub.docId || dId === `pending_${sub.docId}`));
        });

        // CRITICAL FIX: If the canonical approved doc doesn't have records yet or has fewer records,
        // seed all candidate records from the pending document so no students are dropped!
        if (records.length === 0 && sourcePendingDoc && Array.isArray(sourcePendingDoc.records) && sourcePendingDoc.records.length > 0) {
          records = [...sourcePendingDoc.records];
          docData = { ...sourcePendingDoc, ...docData };
        }

        // Check if student record exists in records array using comprehensive multi-factor matching
        const recIndex = records.findIndex(r => {
          if (!r) return false;
          const rReg = String(r.boardRegNo || r.boardRollNo || r.regNo || r['Board Reg. No.'] || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (regVal && regVal !== '—' && regVal.length >= 8 && rReg && rReg.length >= 8 && rReg === regVal) return true;

          const rExam = String(r.examRollNo || '').trim().toUpperCase();
          if (examVal && examVal !== '—' && examVal.length >= 6 && rExam && rExam === examVal) return true;

          const rRoll = String(r.rollNo || r.classRollNo || '').trim();
          if (rollVal && rollVal !== '—' && rRoll && rRoll === rollVal) return true;

          const rName = String(r.name || r.studentName || '').toLowerCase().trim();
          const rFather = String(r.parentName || r.parentage || r.fatherName || '').toLowerCase().trim();
          if (nameVal && rName && nameVal.toLowerCase().trim() === rName) {
            if (!parentVal || !rFather || parentVal.toLowerCase().trim() === rFather || parentVal.toLowerCase().includes(rFather) || rFather.includes(parentVal.toLowerCase())) {
              return true;
            }
          }
          return false;
        });

        const rawMarkVal = sub.val.trim().toUpperCase();
        const isAbsent = rawMarkVal === 'AB' || rawMarkVal === 'A' || rawMarkVal === 'ABSENT';
        const numVal = isAbsent ? null : (rawMarkVal !== '' && !isNaN(Number(rawMarkVal)) ? Number(rawMarkVal) : null);

        const updatedStudentEntry = {
          rollNo: rollVal !== '—' ? rollVal : (records[recIndex]?.rollNo || ''),
          classRollNo: rollVal !== '—' ? rollVal : (records[recIndex]?.classRollNo || ''),
          boardRollNo: regVal !== '—' ? regVal : (records[recIndex]?.boardRollNo || ''),
          boardRegNo: regVal !== '—' ? regVal : (records[recIndex]?.boardRegNo || ''),
          regNo: regVal !== '—' ? regVal : (records[recIndex]?.regNo || ''),
          examRollNo: examVal !== '—' ? examVal : (records[recIndex]?.examRollNo || ''),
          name: nameVal || records[recIndex]?.name || '',
          studentName: nameVal || records[recIndex]?.studentName || '',
          parentName: parentVal || records[recIndex]?.parentName || '',
          practicalMarks: isAbsent ? 'AB' : (numVal !== null ? String(numVal) : rawMarkVal),
          totalMarks: isAbsent ? 'AB' : (numVal !== null ? numVal : rawMarkVal),
          // Explicit Admin Audit Stamp
          updatedByAdmin: true,
          updatedBy: adminEmail,
          updatedAt: nowIso,
          editReason: effectiveReason
        };

        if (recIndex >= 0) {
          records[recIndex] = {
            ...records[recIndex],
            ...updatedStudentEntry
          };
        } else {
          records.push(updatedStudentEntry);
        }

        // Save updated document back to practicalsData with admin audit stamp (preserving original practicalType)
        const preservedPracticalType = docData.practicalType || selectedEvalType || 'Pre-Board Test';
        await setDoc(docRef, sanitizeForFirestore({
          ...docData,
          className: selectedClass,
          class: selectedClass,
          subjectName: sub.name,
          subjectCode: sub.code,
          practicalType: preservedPracticalType,
          yearSuffix: normSession,
          session: normSession,
          maxMarks: sub.maxMarks,
          status: 'approved',
          isPendingApproval: false,
          records,
          // Document level admin audit
          updatedByAdmin: true,
          updatedBy: adminEmail,
          updatedAt: nowIso,
          lastEditedBy: `Admin (${adminEmail}) - Direct Gazette Edit`,
          lastEditReason: effectiveReason
        }), { merge: true });

        // Also sync to corresponding pending document so pending submission inspect view stays consistent
        if (sourcePendingDoc) {
          try {
            const pendingRef = doc(db, 'practicalsData', sourcePendingDoc.id || pendingDocId);
            let pendingRecords = Array.isArray(sourcePendingDoc.records) ? [...sourcePendingDoc.records] : [...records];
            const pIdx = pendingRecords.findIndex(r => {
              if (!r) return false;
              const rReg = String(r.boardRegNo || r.boardRollNo || r.regNo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              if (regVal && regVal !== '—' && regVal.length >= 8 && rReg && rReg.length >= 8 && rReg === regVal) return true;
              const rRoll = String(r.rollNo || r.classRollNo || '').trim();
              if (rollVal && rollVal !== '—' && rRoll && rRoll === rollVal) return true;
              const rName = String(r.name || r.studentName || '').toLowerCase().trim();
              if (nameVal && rName && nameVal.toLowerCase().trim() === rName) return true;
              return false;
            });

            if (pIdx >= 0) {
              pendingRecords[pIdx] = { ...pendingRecords[pIdx], ...updatedStudentEntry };
            } else {
              pendingRecords.push(updatedStudentEntry);
            }

            await setDoc(pendingRef, sanitizeForFirestore({
              ...sourcePendingDoc,
              records: pendingRecords,
              updatedByAdmin: true,
              updatedBy: adminEmail,
              updatedAt: nowIso,
              lastEditedBy: `Admin (${adminEmail}) - Direct Gazette Edit`,
              lastEditReason: effectiveReason
            }), { merge: true });
          } catch (pendingSyncErr) {
            console.warn('Pending document sync error (non-fatal):', pendingSyncErr);
          }
        }
      }

      // Invalidate both collection and in-memory practicals caches so all admin and teacher modules refresh instantly
      invalidateCollectionCache('practicalsData');
      invalidatePracticalsCache();

      // Log admin activity audit
      await logAdminActivity({
        actionType: 'gazette_direct_edit',
        actionTitle: `Admin Gazette Override: ${candidate.name} (Roll #${candidate.rollNo})`,
        details: `Updated marks for ${changedSubjects.length} subject(s) [${changedSubjects.map(s => s.code).join(', ')}] for candidate ${candidate.name}. Reason: ${editReason.trim()}`,
        reasonCategory: 'Examination Award Correction',
        metadata: {
          candidateName: candidate.name,
          rollNo: candidate.rollNo,
          regNo: candidate.regNo,
          class: selectedClass,
          session: selectedSession,
          evalType: selectedEvalType,
          changedSubjects: changedSubjects.map(s => ({ code: s.code, old: s.originalVal, new: s.val })),
          editReason: editReason.trim(),
          updatedBy: adminEmail
        }
      });

      // Dispatch global results update event
      window.dispatchEvent(new CustomEvent('hss-results-updated'));

      showToast(`Marks updated with Admin Audit Stamp for ${candidate.name}!`, 'success');
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save admin marks:', err);
      setErrorMsg(`Failed to save marks: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-[97vw] 2xl:max-w-[1520px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[96vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-indigo-900/50 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-black shadow-inner flex-shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white m-0 truncate">
                  Admin Candidate Gazette Editor
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                  <ShieldCheck size={9} /> Verified Admin Mode
                </span>
              </div>
              <p className="text-[11px] text-indigo-200/80 m-0 truncate">
                Direct marks & awards override with authentic Firestore audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Candidate Profile Strip */}
        <div className="px-3 sm:px-5 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-center border border-indigo-200 dark:border-indigo-800 text-xs">
              {candidate.name?.slice(0, 2).toUpperCase() || 'ST'}
            </div>
            <div>
              <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                {candidate.name}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-[10.5px]">
                Parentage: {candidate.fatherName || '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
              Roll No: <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{candidate.rollNo || '—'}</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
              Reg No: <span className="font-mono font-black text-slate-800 dark:text-slate-200">{candidate.regNo || '—'}</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 font-bold text-indigo-700 dark:text-indigo-300">
              {selectedClass} • {candidate.stream || 'General'}
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-2.5 sm:p-4 overflow-y-auto space-y-3 flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="flex-shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Subject Marks Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 m-0">
                <Award size={13} className="text-indigo-500" /> Subject Evaluation Marks
              </h4>
              <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                Enter numbers (0–Max), <code className="font-black text-rose-600 dark:text-rose-400">AB</code> for Absent, or leave blank
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {Object.values(marksState).map(sub => {
                const isModified = sub.val !== sub.originalVal;
                const isAb = sub.val === 'AB';
                const numVal = Number(sub.val);
                const isValidNum = !isAb && Number.isFinite(numVal) && numVal >= 0;
                const isPass = isValidNum && numVal >= sub.minMarks;
                const isFail = (isValidNum && numVal < sub.minMarks) || isAb;

                return (
                  <div
                    key={sub.code}
                    className={`p-2 rounded-lg border transition-all ${
                      isModified
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700 shadow-xs ring-1 ring-amber-400/30'
                        : sub.isEnrolled
                        ? 'bg-white dark:bg-slate-900 border-indigo-200/80 dark:border-indigo-900/70 shadow-2xs'
                        : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Top Row: Code + Name + Badge */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="min-w-0 flex items-center gap-1.5 truncate">
                        <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                          {sub.code}
                        </span>
                        <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-100 truncate" title={sub.name}>
                          {sub.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {sub.isEnrolled ? (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800">
                            Enrolled
                          </span>
                        ) : (
                          <span className="px-1 py-0.2 rounded text-[8.5px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                            Elective
                          </span>
                        )}

                        {sub.updatedByAdmin && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5" title={`Admin Mod: ${sub.updatedBy} (${sub.editReason || 'Override'})`}>
                            <ShieldCheck size={8} /> Mod
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Subline: Max / Pass */}
                    <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 mb-1.5 px-0.5">
                      <span>Max: <strong>{sub.maxMarks}M</strong></span>
                      <span>Pass: <strong>{sub.minMarks}M</strong></span>
                    </div>

                    {/* Controls Row: Input + AB + Reset + Result Badge */}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={sub.val}
                        onChange={(e) => handleMarkChange(sub.code, e.target.value)}
                        placeholder="—"
                        maxLength={4}
                        className={`w-14 sm:w-16 h-7 px-1 text-center font-mono font-black text-xs rounded border focus:outline-none focus:ring-1.5 transition-all ${
                          isAb
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 focus:ring-rose-400'
                            : isPass
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 focus:ring-emerald-400'
                            : isFail
                            ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 focus:ring-amber-400'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:ring-indigo-400'
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() => handleToggleAbsent(sub.code)}
                        className={`h-7 px-1.5 rounded font-black text-[10px] border transition-colors ${
                          isAb
                            ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                        title="Toggle Absent (AB)"
                      >
                        AB
                      </button>

                      {isModified && (
                        <button
                          type="button"
                          onClick={() => handleResetSubject(sub.code)}
                          className="h-7 px-1.5 rounded font-bold text-[9.5px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors"
                          title={`Reset to original (${sub.originalVal || 'Empty'})`}
                        >
                          Reset
                        </button>
                      )}

                      <div className="ml-auto flex-shrink-0">
                        {isPass && (
                          <span className="text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 size={11} /> Pass
                          </span>
                        )}
                        {isFail && (
                          <span className="text-[9.5px] font-black text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                            <XCircle size={11} /> {isAb ? 'Absent' : 'Reap'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Assessment Calculation Preview & Audit Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
            {/* Live Assessment Calculation Preview */}
            <div className="lg:col-span-5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Award size={12} className="text-indigo-500" /> Result Engine
                </span>
                <span className={`px-2 py-0.5 rounded text-[10.5px] font-black uppercase tracking-wider inline-block ${
                  assessmentSummary.result === 'PASS'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                    : assessmentSummary.result === 'ABSENT'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                }`}>
                  {assessmentSummary.result}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Total</span>
                  <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                    {assessmentSummary.totalObt} / {assessmentSummary.totalMax}
                  </span>
                </div>
                <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Percent</span>
                  <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                    {assessmentSummary.pct}%
                  </span>
                </div>
                <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Evaluated</span>
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    {assessmentSummary.evalCount} Subs
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Trail & Reason Input */}
            <div className="lg:col-span-7 p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-900 dark:text-white flex items-center gap-1 m-0">
                  <ShieldCheck size={12} className="text-amber-600 dark:text-amber-400" />
                  Audit Reason & Note <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
                  Admin: <strong className="text-indigo-600 dark:text-indigo-400">{adminEmail}</strong>
                </span>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1 flex-wrap">
                {REASON_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEditReason(preset)}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition-colors ${
                      editReason === preset
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g., Re-evaluation result update as per office memo #42..."
                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-3 sm:px-5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>

            {!hasChanges ? (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Change any subject mark or toggle AB to enable commit.
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                <Sparkles size={11} className="text-amber-600" />
                {Object.values(marksState).filter(s => s.val !== s.originalVal).length} mark(s) modified
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              title={!hasChanges ? 'Make changes to at least one subject mark to enable saving' : 'Save verified marks with admin audit trail'}
              className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm transition-all ${
                isSaving || !hasChanges
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300/50 dark:border-slate-700/50'
                  : 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg active:scale-95'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={13} /> Commit Admin Overrides
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
