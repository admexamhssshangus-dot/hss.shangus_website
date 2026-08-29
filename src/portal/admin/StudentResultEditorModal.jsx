// =================================================================
// HSS SHANGUS — Student JKBOSE Exam Result & TC Details Editor Modal
// Interactive modal with Guardrails, Division Auto-calculator,
// Re-appear Subject Chips, and Instant Firestore / Cache Sync.
// =================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Award,
  CheckCircle,
  AlertCircle,
  Save,
  Calendar,
  Hash,
  BookOpen,
  User,
  GraduationCap,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { updateCachedItem } from '../../services/dbCache';
import {
  JKBOSE_SUBJECT_CODES,
  calculateDivision,
  normalizeResultStatus,
  extractStudentResultMarks,
  extractStudentAdmissionNumber,
  extractStudentAdmissionDate,
  extractStudentCertificateNumber
} from '../../utils/jkboseResultManager';

export default function StudentResultEditorModal({
  isOpen,
  onClose,
  student,
  onSaveSuccess,
  showToast
}) {
  const raw = useMemo(() => (student?.raw || student || {}), [student]);

  // Form State
  const [examMode, setExamMode] = useState('');
  const [examRollNo, setExamRollNo] = useState('');
  const [resultStatus, setResultStatus] = useState('Awaiting Result');
  const [marksObtained, setMarksObtained] = useState('');
  const [maxMarks, setMaxMarks] = useState('500');
  const [division, setDivision] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [customReappText, setCustomReappText] = useState('');
  const [withdrawalDate, setWithdrawalDate] = useState('');
  const [ccDcNo, setCcDcNo] = useState('');
  const [admNo, setAdmNo] = useState('');
  const [admDate, setAdmDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when student changes
  useEffect(() => {
    if (!student) return;
    const r = raw;
    const resultInfo = extractStudentResultMarks(r);
    setExamMode(resultInfo.examMode);
    setExamRollNo(resultInfo.examRoll);

    const initialStatus = resultInfo.resultStatus;
    setResultStatus(initialStatus);

    const rawMarks = String(r['Marks/Reapp (Current)'] || r.currMarksReapp || '');
    const numMatch = rawMarks.match(/(\d+)(?:\s*\/\s*(\d+))?/);
    if (numMatch) {
      setMarksObtained(numMatch[1]);
      setMaxMarks(numMatch[2] || '500');
    } else {
      setMarksObtained('');
      setMaxMarks('500');
    }

    setDivision(resultInfo.division);

    // Reapp subjects
    if (initialStatus === 'Reap' && rawMarks && !numMatch) {
      setCustomReappText(rawMarks);
      const codes = rawMarks.split(/[\s,]+/).filter(Boolean);
      setSelectedSubjects(codes);
    } else {
      setSelectedSubjects([]);
      setCustomReappText('');
    }

    setWithdrawalDate(r['Date of withdrawl'] || r.withdrawalDate || new Date().toISOString().slice(0, 10));
    setCcDcNo(extractStudentCertificateNumber(r));
    setAdmNo(extractStudentAdmissionNumber(r));
    setAdmDate(extractStudentAdmissionDate(r));
    setRemarks(r['Remarks'] || '');
  }, [student, raw]);

  // Live division auto-calculation when marks change
  useEffect(() => {
    if (resultStatus === 'Passed' && marksObtained) {
      const { division: autoDiv } = calculateDivision(marksObtained, maxMarks);
      setDivision(autoDiv);
    } else if (resultStatus === 'Reap') {
      setDivision('Re-appear');
    } else if (resultStatus === 'Failed') {
      setDivision('Failed');
    } else if (resultStatus === 'Discharged') {
      setDivision('Discharged');
    }
  }, [marksObtained, maxMarks, resultStatus]);

  // Toggle subject chip for Re-appear
  const toggleSubjectChip = (code) => {
    let next;
    if (selectedSubjects.includes(code)) {
      next = selectedSubjects.filter(c => c !== code);
    } else {
      next = [...selectedSubjects, code];
    }
    setSelectedSubjects(next);
    setCustomReappText(next.join(' '));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!student) return;

    const formNo = String(student.formNo || raw['Form No.'] || raw.formNo || '').trim();
    const regNo = String(student.regNo || raw['Board Reg. No.'] || raw.regNo || '').trim();
    const docId = formNo || student.id || regNo;

    if (!docId) {
      if (showToast) showToast('Missing Student Identifier (Form No / Reg No) for record update.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      let finalMarksReapp = '';
      if (resultStatus === 'Passed') {
        finalMarksReapp = marksObtained ? `${marksObtained} / ${maxMarks || 500}` : '';
      } else if (resultStatus === 'Reap') {
        finalMarksReapp = customReappText || selectedSubjects.join(' ') || 'Re-appear';
      } else {
        finalMarksReapp = resultStatus;
      }

      const patch = {
        'Exam Mode (Current)': examMode,
        'Exam R.No. (Current)': examRollNo,
        'Result (Current)': resultStatus,
        'Marks/Reapp (Current)': finalMarksReapp,
        'Div/Distinc (Current)': division,
        currExamMode: examMode,
        currExamRoll: examRollNo,
        currResult: resultStatus,
        currMarksReapp: finalMarksReapp,
        currDiv: division,
        'Date of withdrawl': withdrawalDate,
        'Date of withdrawl/result': withdrawalDate,
        withdrawalDate,
        resultDate: withdrawalDate,
        'No. & Date of CC/DC Issued (This Institution)': ccDcNo,
        ccDcNo,
        'Admission Number': admNo,
        'Admission No.': admNo,
        'Adm. No.': admNo,
        admissionNo: admNo,
        admNo: admNo,
        'Date of Admission': admDate,
        'Admission Date': admDate,
        'Adm. Date': admDate,
        admissionDate: admDate,
        admDate: admDate,
        'Remarks': remarks,
        updatedAt: serverTimestamp()
      };

      const collName = raw._srcCollection || (student.sourceType === 'past' ? 'masterRegisters' : 'admissions');
      const parentDocId = raw._parentDocId || student._parentDocId || '';

      if (collName === 'masterRegisters' && parentDocId) {
        // Archived rosters are packed inside a parent chunk. Update the item in
        // that chunk instead of creating a redundant flat master-register doc.
        const parentRef = doc(db, 'masterRegisters', String(parentDocId));
        const parentSnap = await getDoc(parentRef);
        if (!parentSnap.exists()) throw new Error(`Master-register chunk ${parentDocId} was not found.`);
        const parentData = parentSnap.data();
        const arrayKey = ['items', 'students', 'records', 'data'].find(key => Array.isArray(parentData[key]));
        if (!arrayKey) throw new Error(`Master-register chunk ${parentDocId} has no student records array.`);

        let didMatch = false;
        const normalized = (value) => String(value || '').trim().toLowerCase();
        const updatedRecords = parentData[arrayKey].map((record) => {
          const recordForm = normalized(record.formNo || record['Form No.'] || record['Form Number']);
          const recordReg = normalized(record.regNo || record.boardRegNo || record['Board Reg. No.'] || record['Board Registration Number']);
          const recordName = normalized(record.studentName || record.name || record["Student's Name"] || record["Student's Name (as per school records)"]);
          const matches = (formNo && recordForm === normalized(formNo)) ||
            (regNo && recordReg === normalized(regNo)) ||
            (studentName && recordName === normalized(studentName));
          if (!matches) return record;
          didMatch = true;
          const itemPatch = { ...patch };
          delete itemPatch.updatedAt;
          return { ...record, ...itemPatch };
        });
        if (!didMatch) throw new Error('Student was not found inside the source master-register chunk.');
        await setDoc(parentRef, { [arrayKey]: updatedRecords, updatedAt: serverTimestamp() }, { merge: true });
        updateCachedItem('masterRegisters', String(parentDocId), { [arrayKey]: updatedRecords });
      } else {
        const studentDocRef = doc(db, collName, String(docId));
        await setDoc(studentDocRef, patch, { merge: true });
        updateCachedItem(collName, String(docId), patch);
      }

      if (collName !== 'admissions' && formNo) {
        try {
          const admDocRef = doc(db, 'admissions', String(formNo));
          const admSnap = await getDoc(admDocRef);
          if (admSnap.exists()) {
            await setDoc(admDocRef, patch, { merge: true });
            updateCachedItem('admissions', String(formNo), patch);
          }
        } catch (_) {}
      }

      if (showToast) showToast(`✅ Exam Result & TC records updated for ${student.name || docId}!`, 'success');
      if (onSaveSuccess) onSaveSuccess({ ...student, ...patch, raw: { ...raw, ...patch } });
      onClose();
    } catch (err) {
      console.error('Failed to update student exam result:', err);
      if (showToast) showToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !student) return null;

  const studentName = student.name || raw["Student's Name"] || '—';
  const regNo = student.regNo || raw["Board Reg. No."] || raw.regNo || '—';
  const formNo = student.formNo || raw["Form No."] || raw.formNo || '—';
  const className = student.selectedClass || raw["Class"] || '12th';
  const stream = student.selectedStream || raw["Stream"] || '—';

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[94vh] sm:max-h-[92vh] overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <Award size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">Edit JKBOSE Exam Result & TC Details</h3>
              <p className="text-[11px] text-slate-300">
                {studentName} &bull; Form #{formNo} &bull; Reg #{regNo} &bull; Class {className} ({stream})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Section 1: Examination Mode & Roll Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Exam Mode (separate from cohort session)
              </label>
              <input
                type="text"
                value={examMode}
                onChange={(e) => setExamMode(e.target.value)}
                placeholder="e.g. Annual Regular 2025 (Oct.-Nov.)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-teal-500 outline-none text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                JKBOSE Exam Roll No.
              </label>
              <input
                type="text"
                value={examRollNo}
                onChange={(e) => setExamRollNo(e.target.value)}
                placeholder="e.g. 301003053"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold font-mono focus:ring-2 focus:ring-teal-500 outline-none text-xs"
              />
            </div>
          </div>

          {/* Section 2: Result Status Selector (Passed / Reap / Failed) */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Result Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'Awaiting Result', label: '⏳ Awaiting Result', color: 'border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
                { id: 'Passed', label: '✅ Passed / Qualified', color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
                { id: 'Reap', label: '⚠️ Re-appear', color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
                { id: 'Failed', label: '❌ Did Not Qualify', color: 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
                { id: 'Discharged', label: '📜 Discharged (Mid-Session)', color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResultStatus(opt.id)}
                  className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                    resultStatus === opt.id
                      ? `${opt.color} shadow-xs scale-[1.02] ring-2 ring-teal-500`
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[11px] truncate">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Dynamic Guardrails Based on Result */}
          {resultStatus === 'Passed' && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <Sparkles size={15} />
                <span>Passed Student Examination Marks & Division</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Marks Obtained
                  </label>
                  <input
                    type="number"
                    value={marksObtained}
                    onChange={(e) => setMarksObtained(e.target.value)}
                    placeholder="e.g. 488"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-slate-100 font-bold text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Maximum Marks
                  </label>
                  <input
                    type="number"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-slate-100 font-bold text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Division / Distinction
                  </label>
                  <input
                    type="text"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    placeholder="e.g. Distinction"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs outline-none"
                  />
                </div>
              </div>

              {marksObtained && (
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle size={13} />
                  <span>
                    Securing <strong>{marksObtained} / {maxMarks || 500}</strong> marks ({calculateDivision(marksObtained, maxMarks).pctStr}) &bull; Classified as <strong>{division}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {resultStatus === 'Reap' && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-amber-800 dark:text-amber-300 font-bold text-xs">
                  Select Re-appear Subjects:
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {selectedSubjects.length} selected
                </span>
              </div>

              {/* Subject Code Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                {JKBOSE_SUBJECT_CODES.map(sub => {
                  const isSel = selectedSubjects.includes(sub.code);
                  return (
                    <button
                      key={sub.code}
                      type="button"
                      onClick={() => toggleSubjectChip(sub.code)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-100'
                      }`}
                    >
                      {sub.code} - {sub.name}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Re-appear Subject String (Space-separated):
                </label>
                <input
                  type="text"
                  value={customReappText}
                  onChange={(e) => {
                    setCustomReappText(e.target.value);
                    setSelectedSubjects(e.target.value.split(/[\s,]+/).filter(Boolean));
                  }}
                  placeholder="e.g. PH CH BI"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-slate-100 font-bold font-mono text-xs outline-none"
                />
              </div>
            </div>
          )}

          {/* Section 4: Admission Number & Date of Admission */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Hash size={13} />
                Admission Number
              </label>
              <input
                type="text"
                value={admNo}
                onChange={(e) => setAdmNo(e.target.value)}
                placeholder="e.g. 1101"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-teal-500 outline-none text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={13} />
                Date of Admission
              </label>
              <input
                type="text"
                value={admDate}
                onChange={(e) => setAdmDate(e.target.value)}
                placeholder="e.g. 01-07-2024"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-teal-500 outline-none text-xs"
              />
            </div>
          </div>

          {/* Section 5: Withdrawal Date & CC/DC Certificate No */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={13} />
                Withdrawal or Result Date
              </label>
              <input
                type="text"
                value={withdrawalDate}
                onChange={(e) => setWithdrawalDate(e.target.value)}
                placeholder="e.g. 14-01-2026 or 2026-01-14"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-teal-500 outline-none text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Hash size={13} />
                No. & Date of TC/DC Issued
              </label>
              <input
                type="text"
                value={ccDcNo}
                onChange={(e) => setCcDcNo(e.target.value)}
                placeholder="e.g. 1276 dated 14-01-2026"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-teal-500 outline-none text-xs"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Conduct satisfactory, provisional result verified."
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none text-xs"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Firebase...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Save & Sync to Student Record</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>,
    document.body
  );
}
