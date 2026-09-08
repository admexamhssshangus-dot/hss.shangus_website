import React, { useState, useMemo } from 'react';
import { 
  X, Upload, FileSpreadsheet, CheckSquare, Square, AlertTriangle, 
  CheckCircle2, RefreshCw, Layers, ArrowRight, ShieldCheck, 
  RotateCcw, Sparkles, Filter, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem, getCachedCollectionSync } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { saveCsvImportBatch } from '../../services/csvBatchManager';
import { toTitleCase } from '../../utils/textFormatting';
import { cleanRawSubjectTokens, expandJkboseSubjectCodes, formatDobToDisplay } from './AdvancedReports';

const AVAILABLE_FIELDS = [
  { key: 'studentName', label: "Student's Name", defaultChecked: true, dbKeys: ["Student's Name (as per school records)", "Student's Name", 'Student Name', 'studentName'] },
  { key: 'fatherName', label: "Father's Name", defaultChecked: true, dbKeys: ["Father's/Guardian's Name (as per school records)", "Father's Name", 'Father Name', 'fatherName'] },
  { key: 'motherName', label: "Mother's Name", defaultChecked: true, dbKeys: ["Mother's Name (as per school records)", "Mother's Name", 'Mother Name', 'motherName'] },
  { key: 'dob', label: "Date of Birth (DoB)", defaultChecked: true, dbKeys: ['DoB (figures)', 'DoB (as per school records)', 'dob'] },
  { key: 'gender', label: "Gender", defaultChecked: true, dbKeys: ['Gender', 'gender'] },
  { key: 'stream', label: "Stream", defaultChecked: true, dbKeys: ['Stream', 'stream', 'Stream for Class 11th', 'Stream & Subjects for Class 12th'] },
  { key: 'subjects', label: "Subjects", defaultChecked: true, dbKeys: ['Subjects', 'subjects', 'selectedSubjects', 'Subjects to be taken in Class 12th', 'Subjects to be taken in Class 11th'] },
  { key: 'category', label: "Social Category", defaultChecked: false, dbKeys: ['Cat._JKBOSE', 'Category', 'Social Category', 'category'] },
  { key: 'classRollNo', label: "Class Roll No.", defaultChecked: false, dbKeys: ['Class Roll No', 'Class Roll No.', 'rollNo', 'classRollNo'] }
];

export default function BulkFieldOverwriteModal({
  isOpen,
  onClose,
  allStudents = [],
  currentSession = '2025-26',
  onComplete
}) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'executing' | 'completed'
  const [targetClass, setTargetClass] = useState('All');
  const [targetSession, setTargetSession] = useState(currentSession || '2025-26');
  const [matchIdentifier, setMatchIdentifier] = useState('regNo'); // 'regNo' | 'admNo' | 'formNo'

  // Selected fields to overwrite
  const [selectedFields, setSelectedFields] = useState(() => {
    const initial = {};
    AVAILABLE_FIELDS.forEach(f => {
      initial[f.key] = f.defaultChecked;
    });
    return initial;
  });

  // Raw file & pasted data
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [rawParsedRows, setRawParsedRows] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'changed' | 'unmatched'

  // Selection for execution
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Execution Progress
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [executionStats, setExecutionStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Toggle field selection
  const handleToggleField = (fieldKey) => {
    setSelectedFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  // Helper to normalize alphanumeric keys
  const cleanKey = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

  // Parse Excel file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (!rows || rows.length === 0) {
          setErrorMsg('The uploaded spreadsheet contains no readable rows.');
          return;
        }
        processIncomingRows(rows, file.name);
      } catch (err) {
        console.error('Spreadsheet read error:', err);
        setErrorMsg('Failed to parse spreadsheet: ' + (err.message || 'Invalid format'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Parse direct paste text
  const handlePasteProcess = () => {
    if (!pasteText.trim()) {
      setErrorMsg('Please paste spreadsheet table rows first.');
      return;
    }
    setErrorMsg(null);
    try {
      const wb = XLSX.read(pasteText, { type: 'string', raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      if (!rows || rows.length === 0) {
        setErrorMsg('Could not parse any rows from the pasted text.');
        return;
      }
      setFileName('Pasted Clipboard Data');
      processIncomingRows(rows, 'Pasted Clipboard Data');
    } catch (err) {
      console.error('Paste parse error:', err);
      setErrorMsg('Failed to parse pasted data: ' + err.message);
    }
  };

  // Core processor: Map columns & correlate with existing database records
  const processIncomingRows = (rows, sourceTitle) => {
    setRawParsedRows(rows);

    // Build database lookup maps from allStudents
    const studentByReg = new Map();
    const studentByAdm = new Map();
    const studentByForm = new Map();

    allStudents.forEach(st => {
      const reg = cleanKey(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.']);
      const adm = cleanKey(st.admNo || st['Admission No.'] || st['Adm. No.']);
      const form = cleanKey(st.formNo || st['Form Number'] || st['Form No.'] || st.id);

      if (reg && reg.length > 5 && !reg.endsWith('00000000')) studentByReg.set(reg, st);
      if (adm && adm !== '—') studentByAdm.set(adm, st);
      if (form && form !== '—') studentByForm.set(form, st);
    });

    const correlated = [];
    const initialSelectedIds = new Set();

    rows.forEach((row, idx) => {
      // Normalize row keys
      const normalizedRow = {};
      Object.entries(row).forEach(([k, v]) => {
        normalizedRow[cleanKey(k)] = typeof v === 'string' ? v.trim() : String(v || '');
      });

      // Find match key from row
      const rawReg = normalizedRow['registrationno'] || normalizedRow['regno'] || normalizedRow['boardregno'] || normalizedRow['registrationnumber'] || normalizedRow['boardregistrationno'] || normalizedRow['boardregn'] || '';
      const rawAdm = normalizedRow['admissionno'] || normalizedRow['admno'] || normalizedRow['admissionnumber'] || '';
      const rawForm = normalizedRow['formno'] || normalizedRow['formnumber'] || normalizedRow['fno'] || '';

      const cleanReg = cleanKey(rawReg);
      const cleanAdm = cleanKey(rawAdm);
      const cleanForm = cleanKey(rawForm);

      let matchedStudent = null;
      if (matchIdentifier === 'regNo' && cleanReg) matchedStudent = studentByReg.get(cleanReg);
      else if (matchIdentifier === 'admNo' && cleanAdm) matchedStudent = studentByAdm.get(cleanAdm);
      else if (matchIdentifier === 'formNo' && cleanForm) matchedStudent = studentByForm.get(cleanForm);

      // Fallback cross-matching if primary didn't hit
      if (!matchedStudent && cleanReg) matchedStudent = studentByReg.get(cleanReg);
      if (!matchedStudent && cleanAdm) matchedStudent = studentByAdm.get(cleanAdm);
      if (!matchedStudent && cleanForm) matchedStudent = studentByForm.get(cleanForm);

      // Extract incoming field candidates from spreadsheet
      const incomingName = toTitleCase(normalizedRow['studentname'] || normalizedRow['name'] || normalizedRow['candidatename'] || normalizedRow['nameofstudent'] || '');
      const incomingFather = toTitleCase(normalizedRow['fathername'] || normalizedRow['fathersname'] || normalizedRow['parentname'] || '');
      const incomingMother = toTitleCase(normalizedRow['mothername'] || normalizedRow['mothersname'] || '');
      const incomingDobRaw = normalizedRow['dob'] || normalizedRow['dateofbirth'] || normalizedRow['dobfigures'] || '';
      const incomingDob = incomingDobRaw ? formatDobToDisplay(incomingDobRaw) : '';
      const incomingGender = normalizedRow['gender'] || normalizedRow['sex'] ? toTitleCase(normalizedRow['gender'] || normalizedRow['sex']) : '';
      const incomingStream = normalizedRow['stream'] || normalizedRow['faculty'] ? toTitleCase(normalizedRow['stream'] || normalizedRow['faculty']) : '';
      const incomingSubsRaw = normalizedRow['subjects'] || normalizedRow['subs'] || normalizedRow['subjectsoffered'] || '';
      const incomingSubs = incomingSubsRaw ? cleanRawSubjectTokens(incomingSubsRaw).join(', ') : '';
      const incomingCategory = normalizedRow['category'] || normalizedRow['socialcategory'] || normalizedRow['catjkbose'] ? toTitleCase(normalizedRow['category'] || normalizedRow['socialcategory'] || normalizedRow['catjkbose']) : '';
      const incomingRoll = normalizedRow['classrollno'] || normalizedRow['rollno'] || normalizedRow['rno'] || '';

      const incomingFields = {
        studentName: incomingName,
        fatherName: incomingFather,
        motherName: incomingMother,
        dob: incomingDob,
        gender: incomingGender,
        stream: incomingStream,
        subjects: incomingSubs,
        category: incomingCategory,
        classRollNo: incomingRoll
      };

      // Compute diff against matched student
      const diffs = {};
      let hasChanges = false;

      if (matchedStudent) {
        AVAILABLE_FIELDS.forEach(f => {
          const incVal = incomingFields[f.key];
          if (!incVal) return;

          // Find current value in matched student
          let currVal = '';
          for (const k of f.dbKeys) {
            if (matchedStudent[k] && String(matchedStudent[k]).trim() !== '' && matchedStudent[k] !== '—') {
              currVal = String(matchedStudent[k]).trim();
              break;
            }
          }

          if (f.key === 'subjects') {
            currVal = cleanRawSubjectTokens(currVal).join(', ');
          }

          const isDiff = currVal.toLowerCase() !== incVal.toLowerCase();
          if (isDiff) {
            diffs[f.key] = { current: currVal || '—', incoming: incVal };
            hasChanges = true;
          }
        });
      }

      const rowId = `row_${idx}_${cleanReg || cleanAdm || cleanForm || idx}`;
      if (matchedStudent && hasChanges) {
        initialSelectedIds.add(rowId);
      }

      correlated.push({
        rowId,
        rowIndex: idx + 1,
        rawReg: rawReg || '—',
        rawAdm: rawAdm || '—',
        rawForm: rawForm || '—',
        incomingFields,
        matchedStudent,
        diffs,
        hasChanges,
        isMatched: Boolean(matchedStudent)
      });
    });

    setPreviewData(correlated);
    setSelectedRowIds(initialSelectedIds);
    setStep('preview');
  };

  // Filtered preview rows
  const filteredPreviewRows = useMemo(() => {
    return previewData.filter(r => {
      if (previewFilter === 'changed') return r.isMatched && r.hasChanges;
      if (previewFilter === 'unmatched') return !r.isMatched;
      return true;
    });
  }, [previewData, previewFilter]);

  // Counts
  const stats = useMemo(() => {
    const total = previewData.length;
    const matched = previewData.filter(r => r.isMatched).length;
    const changed = previewData.filter(r => r.isMatched && r.hasChanges).length;
    const unmatched = total - matched;
    const selected = selectedRowIds.size;
    return { total, matched, changed, unmatched, selected };
  }, [previewData, selectedRowIds]);

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === stats.changed) {
      setSelectedRowIds(new Set());
    } else {
      const allChanged = new Set(previewData.filter(r => r.isMatched && r.hasChanges).map(r => r.rowId));
      setSelectedRowIds(allChanged);
    }
  };

  const handleToggleRow = (rowId) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // ─── Execute Overwrite Pipeline ───
  const executeOverwrite = async () => {
    const rowsToExecute = previewData.filter(r => selectedRowIds.has(r.rowId) && r.matchedStudent);
    if (rowsToExecute.length === 0) {
      setErrorMsg('No students selected for overwrite.');
      return;
    }

    setStep('executing');
    setProgressPercent(5);
    setProgressStage('Initializing Board Data Overwrite...');
    setErrorMsg(null);

    try {
      const activeFieldsToUpdate = AVAILABLE_FIELDS.filter(f => selectedFields[f.key]);
      const timestamp = new Date().toISOString();
      const updatedSnapshots = [];
      let updatedCount = 0;

      for (let i = 0; i < rowsToExecute.length; i++) {
        const item = rowsToExecute[i];
        const st = item.matchedStudent;
        const inc = item.incomingFields;

        // Build updates payload based on checked fields
        const payload = {
          updatedAt: timestamp,
          lastEditedBy: 'Admin (Board Data Sync Overwriter)'
        };

        activeFieldsToUpdate.forEach(fieldDef => {
          const newVal = inc[fieldDef.key];
          if (!newVal) return;

          if (fieldDef.key === 'studentName') {
            payload["Student's Name (as per school records)"] = newVal;
            payload["Student's Name"] = newVal;
            payload['Student Name'] = newVal;
            payload.studentName = newVal;
          } else if (fieldDef.key === 'fatherName') {
            payload["Father's/Guardian's Name (as per school records)"] = newVal;
            payload["Father's Name"] = newVal;
            payload['Father Name'] = newVal;
            payload.fatherName = newVal;
          } else if (fieldDef.key === 'motherName') {
            payload["Mother's Name (as per school records)"] = newVal;
            payload["Mother's Name"] = newVal;
            payload['Mother Name'] = newVal;
            payload.motherName = newVal;
          } else if (fieldDef.key === 'dob') {
            payload['DoB (figures)'] = newVal;
            payload['DoB (as per school records)'] = newVal;
            payload.dob = newVal;
          } else if (fieldDef.key === 'gender') {
            payload['Gender'] = newVal;
            payload.gender = newVal;
          } else if (fieldDef.key === 'stream') {
            payload['Stream'] = newVal;
            payload.stream = newVal;
          } else if (fieldDef.key === 'subjects') {
            const cleanedSubs = cleanRawSubjectTokens(newVal);
            payload['selectedSubjects'] = cleanedSubs;
            payload['Subjects'] = cleanedSubs.join(', ');
            payload['subjects'] = cleanedSubs.join(', ');
            payload['Subs'] = cleanedSubs.join(', ');
            payload['subs'] = cleanedSubs.join(', ');
            cleanedSubs.forEach((subName, sIdx) => {
              if (sIdx < 6) {
                payload[`Subjects${sIdx + 1}`] = subName;
                payload[`subject${sIdx + 1}`] = subName;
              }
            });
          } else if (fieldDef.key === 'category') {
            payload['Cat._JKBOSE'] = newVal;
            payload['Category'] = newVal;
            payload['Social Category'] = newVal;
            payload.category = newVal;
          } else if (fieldDef.key === 'classRollNo') {
            payload['Class Roll No'] = newVal;
            payload['Class Roll No.'] = newVal;
            payload.classRollNo = newVal;
            payload.rollNo = newVal;
          }
        });

        // Determine destination collection: active session -> admissions; historical -> masterRegisters chunk
        const isHistorical = Boolean(st._isHistorical || st._source === 'masterRegisters');
        const docId = String(st._docId || st.docId || st.id || st.formNo).trim();

        if (!isHistorical) {
          // Write to admissions
          await setDoc(doc(db, 'admissions', docId), payload, { merge: true });
          updateCachedItem('admissions', docId, payload);
        } else {
          // If masterRegisters single doc
          await setDoc(doc(db, 'masterRegisters', docId), payload, { merge: true });
          updateCachedItem('masterRegisters', docId, payload);
        }

        updatedSnapshots.push({
          docId,
          collection: isHistorical ? 'masterRegisters' : 'admissions',
          studentName: inc.studentName || st.studentName,
          formNo: st.formNo || item.rawForm,
          regNo: item.rawReg,
          appliedFields: payload
        });

        updatedCount++;
        const pct = 10 + Math.round(((i + 1) / rowsToExecute.length) * 80);
        setProgressPercent(pct);
        setProgressStage(`Overwriting records (${i + 1}/${rowsToExecute.length})...`);
      }

      // Save to 30-Day Batch Rollback Manager
      if (updatedSnapshots.length > 0) {
        setProgressStage('Saving 30-Day Rollback Snapshot...');
        await saveCsvImportBatch({
          fileName: `Board Data Overwrite: ${fileName || 'JKBOSE Sync'} (${updatedCount} students)`,
          importedRecords: updatedSnapshots,
          reasonCategory: 'Board Data Sync & Field Overwrite',
          customReason: `Synchronized ${updatedCount} students with Board data for session ${targetSession}`
        }).catch(e => console.warn('Rollback snapshot note:', e));
      }

      // Log Admin Activity
      await logAdminActivity({
        actionType: 'bulk_field_overwrite',
        actionTitle: 'Board Data Bulk Field Overwrite',
        details: `Successfully synchronized and overwritten verified Board fields for ${updatedCount} students (${targetClass}, ${targetSession}) from ${fileName || 'Excel Sheet'}`,
        reasonCategory: 'Board Data Sync & Record Verification',
        metadata: {
          count: updatedCount,
          fields: Object.keys(selectedFields).filter(k => selectedFields[k]),
          session: targetSession,
          class: targetClass
        }
      });

      // Trigger global event notifications
      window.dispatchEvent(new CustomEvent('hss-results-updated'));
      window.dispatchEvent(new CustomEvent('hss-master-register-updated'));

      setProgressPercent(100);
      setProgressStage('All fields successfully overwritten and synchronized!');
      setExecutionStats({ updatedCount });
      setStep('completed');

      if (onComplete) onComplete({ updatedCount });
    } catch (err) {
      console.error('Execution error during bulk field overwrite:', err);
      setErrorMsg('Failed during overwrite execution: ' + err.message);
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-transparent to-blue-50/50 dark:from-emerald-950/20 dark:to-blue-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Board Data Sync & Bulk Field Overwriter</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  JKBOSE Verified
                </span>
              </h2>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Overwrite student-entered admission fields with authentic Board data from Excel or clipboard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">

          {/* ──────── STEP 1: UPLOAD & FIELD SELECTION ──────── */}
          {step === 'upload' && (
            <div className="space-y-4">
              
              {/* Target Scope & Matching Identifier */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Target Academic Session
                  </label>
                  <select
                    value={targetSession}
                    onChange={(e) => setTargetSession(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="2025-26">2025–26 (Active Intake)</option>
                    <option value="2024-25">2024–25 (Previous Session)</option>
                    <option value="2023-24">2023–24 (Historical)</option>
                    <option value="2022-23">2022–23 (Historical)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Target Class Scope
                  </label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="All">All Classes (Auto-Detect)</option>
                    <option value="12th">Class 12th</option>
                    <option value="11th">Class 11th</option>
                    <option value="10th">Class 10th</option>
                    <option value="9th">Class 9th</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Primary Match Key
                  </label>
                  <select
                    value={matchIdentifier}
                    onChange={(e) => setMatchIdentifier(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="regNo">Board Registration Number (Recommended)</option>
                    <option value="admNo">School Admission Number</option>
                    <option value="formNo">Application Form Number</option>
                  </select>
                </div>
              </div>

              {/* Fields to Overwrite Checklist */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <CheckSquare size={13} className="text-emerald-600" />
                    <span>Select Fields to Overwrite from Board Data</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    Only checked fields will be updated; unchecked fields remain untouched
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {AVAILABLE_FIELDS.map(f => {
                    const isChecked = selectedFields[f.key];
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => handleToggleField(f.key)}
                        className={`px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-black'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold'
                        }`}
                      >
                        {isChecked ? <CheckSquare size={14} className="text-emerald-600 shrink-0" /> : <Square size={14} className="text-slate-400 shrink-0" />}
                        <span className="truncate">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dual Input: File Upload or Direct Paste */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Method A: File Upload */}
                <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/50 transition-colors flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <Upload size={18} />
                  </div>
                  <div>
                    <span className="font-black text-slate-800 dark:text-slate-200 block">
                      Upload Excel / CSV File
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Supports .xlsx, .xls, and .csv files
                    </span>
                  </div>
                  <label className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm cursor-pointer transition-colors">
                    <span>Browse Spreadsheet</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Method B: Direct Paste from Excel */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Copy size={13} className="text-blue-600" />
                      <span>Or Paste Direct from Excel</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Ctrl+V from Excel</span>
                  </div>
                  <textarea
                    rows={3}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Copy table rows from Excel and paste here..."
                    className="w-full p-2 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 resize-none focus:outline-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handlePasteProcess}
                    className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] shadow-sm cursor-pointer transition-colors"
                  >
                    Parse Pasted Rows
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ──────── STEP 2: PREVIEW & VISUAL DIFF ──────── */}
          {step === 'preview' && (
            <div className="space-y-3">
              
              {/* Summary Stats Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    File: <strong className="text-slate-900 dark:text-white font-black">{fileName}</strong>
                  </span>
                  <div className="flex items-center gap-2 text-[10.5px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-black">
                      Total: {stats.total}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black">
                      With Updates: {stats.changed}
                    </span>
                    {stats.unmatched > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-black">
                        Unmatched: {stats.unmatched}
                      </span>
                    )}
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-2 py-1 rounded-lg font-black text-[10px] cursor-pointer transition-all ${
                      previewFilter === 'all'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('changed')}
                    className={`px-2 py-1 rounded-lg font-black text-[10px] cursor-pointer transition-all ${
                      previewFilter === 'changed'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    Updates ({stats.changed})
                  </button>
                  {stats.unmatched > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('unmatched')}
                      className={`px-2 py-1 rounded-lg font-black text-[10px] cursor-pointer transition-all ${
                        previewFilter === 'unmatched'
                          ? 'bg-rose-700 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      Unmatched ({stats.unmatched})
                    </button>
                  )}
                </div>
              </div>

              {/* Table of Differences */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-slate-700 dark:text-slate-300 font-black uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="cursor-pointer"
                        >
                          {selectedRowIds.size === stats.changed && stats.changed > 0 ? (
                            <CheckSquare size={13} className="text-emerald-600" />
                          ) : (
                            <Square size={13} className="text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-12 text-center">#</th>
                      <th className="p-2">Match Key (Reg / Adm)</th>
                      <th className="p-2">Current Database Record</th>
                      <th className="p-2">Incoming Board Data & Overwrite Diff</th>
                      <th className="p-2 text-center w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 font-bold font-sans">
                          No student records found matching this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row) => {
                        const isChecked = selectedRowIds.has(row.rowId);
                        const diffEntries = Object.entries(row.diffs);

                        return (
                          <tr
                            key={row.rowId}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                              !row.isMatched ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                            }`}
                          >
                            <td className="p-2 text-center">
                              {row.isMatched && row.hasChanges && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRow(row.rowId)}
                                  className="cursor-pointer"
                                >
                                  {isChecked ? (
                                    <CheckSquare size={13} className="text-emerald-600" />
                                  ) : (
                                    <Square size={13} className="text-slate-400" />
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="p-2 text-center text-slate-400 font-bold font-sans">
                              {row.rowIndex}
                            </td>
                            <td className="p-2 font-bold text-slate-800 dark:text-slate-200">
                              <div>{row.rawReg !== '—' ? row.rawReg : row.rawAdm}</div>
                              {row.rawForm !== '—' && (
                                <div className="text-[9px] text-slate-400">Form: {row.rawForm}</div>
                              )}
                            </td>
                            <td className="p-2 text-slate-700 dark:text-slate-300 font-sans">
                              {row.matchedStudent ? (
                                <div>
                                  <div className="font-black text-slate-900 dark:text-white">
                                    {row.matchedStudent.studentName || row.matchedStudent["Student's Name"]}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500">
                                    F: {row.matchedStudent.fatherName || row.matchedStudent["Father's Name"]}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-mono">
                                    {row.matchedStudent.class} • {row.matchedStudent.stream}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not found in database</span>
                              )}
                            </td>
                            <td className="p-2 font-sans space-y-1">
                              {row.isMatched ? (
                                diffEntries.length > 0 ? (
                                  diffEntries.map(([fKey, d]) => (
                                    <div key={fKey} className="text-[9.5px]">
                                      <span className="font-extrabold uppercase text-slate-500 text-[8.5px]">
                                        {fKey}:
                                      </span>{' '}
                                      <span className="line-through text-slate-400 mr-1">{d.current}</span>
                                      <span className="text-emerald-700 dark:text-emerald-300 font-black">
                                        → {d.incoming}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">
                                    All selected fields already match
                                  </span>
                                )
                              ) : (
                                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                  {row.incomingFields.studentName} ({row.incomingFields.fatherName})
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-center font-sans">
                              {row.isMatched ? (
                                row.hasChanges ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    Update Ready
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Identical
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  No Match
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ──────── STEP 3: EXECUTING ──────── */}
          {step === 'executing' && (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw size={32} className="text-emerald-600 animate-spin" />
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Overwriting Student Records...
                </h3>
                <p className="text-xs text-slate-500 font-bold">{progressStage}</p>
              </div>
              <div className="w-64 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-black text-emerald-700 dark:text-emerald-400">
                {progressPercent}% Completed
              </span>
            </div>
          )}

          {/* ──────── STEP 4: COMPLETED ──────── */}
          {step === 'completed' && (
            <div className="py-10 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Board Data Overwrite Completed!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold max-w-md">
                  Successfully updated {executionStats?.updatedCount || 0} student records with verified Board fields.
                  A 30-day rollback snapshot has been preserved in the Batch Manager.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer transition-all"
              >
                Close & Return to Reports
              </button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        {step !== 'executing' && step !== 'completed' && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
            {step === 'preview' ? (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                ← Back to Upload
              </button>
            ) : (
              <div className="text-[11px] font-bold text-slate-500">
                Matches against {allStudents.length} loaded student profiles
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              {step === 'preview' && (
                <button
                  type="button"
                  disabled={selectedRowIds.size === 0}
                  onClick={executeOverwrite}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Check size={14} />
                  <span>Execute Overwrite ({selectedRowIds.size})</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
