import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Database, ShieldAlert, CheckCircle2, AlertTriangle, X, RefreshCw, 
  ArrowRight, Search, Users, Archive, Trash2, FileCheck, Layers, Sparkles, Check,
  Download, Lock, Eye, EyeOff, FileSpreadsheet, ShieldCheck
} from 'lucide-react';
import { 
  loadSessionAdmissions, 
  archiveSessionRecords, 
  reconcileAndDeduplicateSession,
  normalizeFormNo
} from '../../services/sessionArchivalService';
import ModernLoader from '../../components/ModernLoader';
import {
  getAssignedClassRollNumber,
  resolveStudentAdmissionStatus
} from '../../utils/studentApprovalStatus';

// The 48 standard official column headers matching Student Records & Reports
const STANDARD_48_COLUMNS = [
  { key: 'sno', label: 'S.No.' },
  { key: 'classRollNo', label: 'Class Roll No' },
  { key: 'admNo', label: 'Admission No' },
  { key: 'formNo', label: 'Form No' },
  { key: 'class', label: 'Class' },
  { key: 'session', label: 'Session' },
  { key: 'stream', label: 'Stream' },
  { key: 'boardRegNo', label: 'Board Reg No' },
  { key: 'name', label: "Student's Name" },
  { key: 'fatherName', label: "Father's Name" },
  { key: 'motherName', label: "Mother's Name" },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'category', label: 'Category' },
  { key: 'penNo', label: 'PEN No' },
  { key: 'aadhaar', label: 'Aadhaar No' },
  { key: 'fatherAadhaar', label: "Father's Aadhaar" },
  { key: 'mobile', label: 'Mobile (Student)' },
  { key: 'parentContact', label: 'Mobile (Parent)' },
  { key: 'email', label: 'Email Address' },
  { key: 'address', label: 'Permanent Address' },
  { key: 'tehsil', label: 'Tehsil' },
  { key: 'district', label: 'District' },
  { key: 'pincode', label: 'PIN Code' },
  { key: 'sub1', label: 'Subject 1' },
  { key: 'sub2', label: 'Subject 2' },
  { key: 'sub3', label: 'Subject 3' },
  { key: 'sub4', label: 'Subject 4' },
  { key: 'sub5', label: 'Subject 5' },
  { key: 'sub6', label: 'Subject 6' },
  { key: 'compositeSubs', label: 'Composite Subjects' },
  { key: 'prevSchool', label: 'Previous School' },
  { key: 'prevExamRollNo', label: 'Prev Exam Roll No' },
  { key: 'prevMarksObt', label: 'Prev Marks' },
  { key: 'prevMaxMarks', label: 'Prev Max Marks' },
  { key: 'prevPercentage', label: 'Prev %age' },
  { key: 'prevDivision', label: 'Prev Division' },
  { key: 'currExamRollNo', label: 'Curr Exam Roll No' },
  { key: 'currResult', label: 'Curr Result' },
  { key: 'currMarks', label: 'Marks/Reappear' },
  { key: 'admDate', label: 'Admission Date' },
  { key: 'status', label: 'Status' },
  { key: 'bankAccount', label: 'Bank Account No' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'ifsc', label: 'IFSC Code' },
  { key: 'paymentRef', label: 'Payment Ref / UTR' },
  { key: 'photoStatus', label: 'Photo Status' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'rolloverAction', label: 'Rollover Action' }
];

export default function SessionArchivalModal({ isOpen, onClose, currentSession = '2025-26', onArchivalComplete }) {
  const [loading, setLoading] = useState(true);
  const [rawAdmissions, setRawAdmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'approved' | 'unapproved'
  const [selectedClassTab, setSelectedClassTab] = useState('ALL'); // 'ALL' | '9th' | '10th' | '11th' | '12th'
  
  // Archival Configuration
  const [archiveSessionTag, setArchiveSessionTag] = useState(currentSession);
  const [newSessionTag, setNewSessionTag] = useState(() => {
    const parts = currentSession.split('-');
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return `${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`;
    }
    return '2026-27';
  });

  // Safety Confirmation & Security PIN
  const [confirmInput, setConfirmInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [step, setStep] = useState('analysis'); // 'analysis' | 'confirm' | 'executing' | 'completed'
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Reconciliation Tool State
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  // Load and analyze all admissions
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await loadSessionAdmissions(archiveSessionTag);
      setRawAdmissions(list);
    } catch (err) {
      console.error('Failed to load admissions for archival analysis:', err);
      setErrorMsg('Failed to load admissions records: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setStep('analysis');
    setConfirmInput('');
    setPinInput('');
    setReconcileResult(null);
    loadData();
  }, [isOpen, archiveSessionTag]);

  // Run Form Number Reconciliation & Deduplication
  const handleRunReconciliation = async () => {
    setIsReconciling(true);
    setErrorMsg(null);
    try {
      const res = await reconcileAndDeduplicateSession({
        session: archiveSessionTag,
        onProgress: (pct, msg) => setProgressStage(msg)
      });
      setReconcileResult(res);
      await loadData();
    } catch (err) {
      console.error('Reconciliation error:', err);
      setErrorMsg('Reconciliation failed: ' + err.message);
    } finally {
      setIsReconciling(false);
    }
  };

  // Categorization Logic
  const analysis = useMemo(() => {
    const approved = [];
    const unapproved = [];
    const byClass = { '9th': 0, '10th': 0, '11th': 0, '12th': 0, 'Other': 0 };
    const byClassApproved = { '9th': 0, '10th': 0, '11th': 0, '12th': 0, 'Other': 0 };
    let totalPhotos = 0;

    rawAdmissions.forEach(rec => {
      const effectiveStatus = resolveStudentAdmissionStatus(rec);

      const cls = String(rec['Admission sought for class'] || rec.Class || rec.class || '').toLowerCase();
      let classKey = 'Other';
      if (cls.includes('9')) classKey = '9th';
      else if (cls.includes('10')) classKey = '10th';
      else if (cls.includes('11')) classKey = '11th';
      else if (cls.includes('12')) classKey = '12th';

      byClass[classKey] = (byClass[classKey] || 0) + 1;

      const photoVal = rec.photo_id || rec['Student Photo'] || rec.photoUrl || rec.photoId || '';
      if (photoVal && typeof photoVal === 'string' && photoVal.length > 10 && photoVal !== '—') {
        totalPhotos++;
      }

      if (effectiveStatus === 'Approved') {
        approved.push(rec);
        byClassApproved[classKey] = (byClassApproved[classKey] || 0) + 1;
      } else {
        unapproved.push(rec);
      }
    });

    return {
      total: rawAdmissions.length,
      approved,
      unapproved,
      byClass,
      byClassApproved,
      totalPhotos
    };
  }, [rawAdmissions]);

  // Extract clean cell value for 48 columns
  const getStudentColumnValue = (s, colKey, idx) => {
    switch (colKey) {
      case 'sno': return s.sno || idx + 1;
      case 'classRollNo': return getAssignedClassRollNumber(s) || s.classRollNo || s['Class Roll No'] || '—';
      case 'admNo': return s['Admission No'] || s['Adm. No.'] || s.admNo || s.admissionNo || '—';
      case 'formNo': return s['Form Number'] || s['Form No.'] || s.formNo || s.id || '—';
      case 'class': return s['Admission sought for class'] || s.Class || s.class || '—';
      case 'session': return s.Session || s.session || s['Academic Session'] || '—';
      case 'stream': return s.Stream || s.stream || s['Academic Stream'] || 'General';
      case 'boardRegNo': return s['Board Registration Number'] || s['Board Reg. No.'] || s.boardRegNo || s.regNo || '—';
      case 'name': return s["Student's Name (as per school records)"] || s["Student's Name"] || s.studentName || s.name || 'Student';
      case 'fatherName': return s["Father's Name (as per school records)"] || s["Father's Name"] || s.fatherName || '—';
      case 'motherName': return s["Mother's Name (as per school records)"] || s["Mother's Name"] || s.motherName || '—';
      case 'dob': return s['Date of Birth'] || s['DoB (figures)'] || s['DoB'] || s.dob || '—';
      case 'gender': return s['Gender'] || s.gender || '—';
      case 'category': return s['Category'] || s['Cat._JKBOSE'] || s['Social category'] || s.category || '—';
      case 'penNo': return s['PEN No'] || s['PEN No.'] || s.penNo || s.apaarId || s['APAAR ID'] || '—';
      case 'aadhaar': return s['Aadhaar Number'] || s['Aadhaar No.'] || s['Aadhar No.'] || s.aadhaar || '—';
      case 'fatherAadhaar': return s["Father's Aadhaar No."] || s["Father's Aadhar No."] || s.fatherAadhaar || '—';
      case 'mobile': return s['Mobile No.'] || s['Mobile Number'] || s["Student's Contact"] || s.mobile || '—';
      case 'parentContact': return s["Parent's Contact"] || s['Alternate Mobile No.'] || s.parentContact || '—';
      case 'email': return s['Email Address'] || s['Email'] || s.email || '—';
      case 'address': return s['Permanent Address'] || s['Residence (Village, District)'] || s.residence || s.address || '—';
      case 'tehsil': return s['Tehsil'] || s.tehsil || '—';
      case 'district': return s['District'] || s.district || '—';
      case 'pincode': return s['PIN code'] || s['Pin Code'] || s.pincode || '—';
      case 'sub1': return s.Subjects1 || s.subjects1 || s.subject1 || '—';
      case 'sub2': return s.Subjects2 || s.subjects2 || s.subject2 || '—';
      case 'sub3': return s.Subjects3 || s.subjects3 || s.subject3 || '—';
      case 'sub4': return s.Subjects4 || s.subjects4 || s.subject4 || '—';
      case 'sub5': return s.Subjects5 || s.subjects5 || s.subject5 || '—';
      case 'sub6': return s.Subjects6 || s.subjects6 || s.subject6 || s.additionalSubject || '—';
      case 'compositeSubs': return s.subjects || s.subs || s['Subjects'] || '—';
      case 'prevSchool': return s['Name of the Institution last attended'] || s['Previous School'] || s.prevSchool || '—';
      case 'prevExamRollNo': return s['Roll No. (Class 10th)'] || s['Exam R.No. (Prev.)'] || s.prevExamRollNo || '—';
      case 'prevMarksObt': return s['Marks Obtained (Class 10th)'] || s['Marks Obt. (Prev.)'] || s.prevMarksObt || '—';
      case 'prevMaxMarks': return s['Max Marks (Class 10th)'] || s['Max. Marks (Prev.)'] || s.prevMaxMarks || '—';
      case 'prevPercentage': return s['Percentage (Class 10th)'] || s['%age (Prev.)'] || s.prevPercentage || '—';
      case 'prevDivision': return s['Previous Result / Marks'] || s['Div/Distinc (Prev.)'] || s.prevDivision || '—';
      case 'currExamRollNo': return s['Exam R.No. (Current)'] || s.boardRoll || '—';
      case 'currResult': return s['Result (Current)'] || s.result || '—';
      case 'currMarks': return s['Marks/Reapp (Current)'] || s.currMarks || '—';
      case 'admDate': return s['Adm. Date'] || s.admissionDate || s.admDate || '—';
      case 'status': return resolveStudentAdmissionStatus(s);
      case 'bankAccount': return s['Bank Account No.'] || s.bankAccount || '—';
      case 'bankName': return s['Bank Name'] || s.bankName || '—';
      case 'ifsc': return s['IFSC Code'] || s.ifsc || '—';
      case 'paymentRef': return s['Payment Reference'] || s.paymentRef || s.utrNo || '—';
      case 'photoStatus': {
        const p = s.photo_id || s['Student Photo'] || s.photoUrl || s.photoId;
        return (p && p.length > 20) ? 'Available (Base64)' : 'Missing';
      }
      case 'remarks': return s.remarks || s['Remarks'] || '—';
      case 'rolloverAction': {
        const isAppr = resolveStudentAdmissionStatus(s) === 'Approved';
        return isAppr ? 'Migrate to masterRegisters' : 'Archive to JSON & Purge';
      }
      default: return '—';
    }
  };

  // Filtered Preview Records
  const previewRecords = useMemo(() => {
    let list = rawAdmissions;
    if (filterTab === 'approved') list = analysis.approved;
    else if (filterTab === 'unapproved') list = analysis.unapproved;

    if (selectedClassTab !== 'ALL') {
      list = list.filter(r => {
        const cls = String(r['Admission sought for class'] || r.Class || r.class || '').toLowerCase();
        if (selectedClassTab === '9th') return cls.includes('9');
        if (selectedClassTab === '10th') return cls.includes('10');
        if (selectedClassTab === '11th') return cls.includes('11');
        if (selectedClassTab === '12th') return cls.includes('12');
        return false;
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(r => {
      const name = String(r["Student's Name (as per school records)"] || r.studentName || r["Student's Name"] || '').toLowerCase();
      const form = String(r['Form Number'] || r['Form No.'] || r.formNo || r.id || '').toLowerCase();
      const roll = String(r['Class Roll No'] || r.classRollNo || '').toLowerCase();
      const reg = String(r['Board Registration Number'] || r.regNo || '').toLowerCase();
      return name.includes(q) || form.includes(q) || roll.includes(q) || reg.includes(q);
    });
  }, [analysis, filterTab, rawAdmissions, searchQuery, selectedClassTab]);

  // Validation rules
  const requiredConfirmText = `ARCHIVE ${archiveSessionTag.toUpperCase().trim()}`;
  const isConfirmTextValid = confirmInput.trim().toUpperCase() === requiredConfirmText;
  const isPinValid = pinInput.trim() === '313313';
  const isAuthorized = isConfirmTextValid && isPinValid;

  // Auto-Download Unapproved JSON File
  const downloadUnapprovedJsonBackup = (unapprovedList) => {
    if (!unapprovedList || unapprovedList.length === 0) return;
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        institution: 'Govt. Higher Secondary School Shangus',
        academicSession: archiveSessionTag,
        purpose: 'Archived Unapproved/Draft Admissions prior to Rollover',
        count: unapprovedList.length,
        records: unapprovedList
      };

      const jsonStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `HSS_Shangus_Unapproved_Admissions_${archiveSessionTag}_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Failed to auto-download unapproved JSON backup:', e);
    }
  };

  // Execute 100% Native Firestore Archival Pipeline
  const executeArchival = async () => {
    if (!isAuthorized) return;
    setStep('executing');
    setErrorMsg(null);
    setProgressPercent(10);
    setProgressStage('Backing up unapproved applications to offline JSON...');

    try {
      // 1. Auto-download unapproved records to JSON in browser
      if (analysis.unapproved.length > 0) {
        downloadUnapprovedJsonBackup(analysis.unapproved);
      }

      // 2. Commit Approved to masterRegisters chunks and wipe admissions
      await archiveSessionRecords(rawAdmissions, {
        session: archiveSessionTag,
        newSession: newSessionTag,
        onProgress: (pct, msg) => {
          setProgressPercent(pct);
          setProgressStage(msg);
        }
      });

      setStep('completed');

      if (onArchivalComplete) {
        onArchivalComplete({
          archivedCount: analysis.approved.length,
          unapprovedCount: analysis.unapproved.length,
          archivedSession: archiveSessionTag,
          newSession: newSessionTag
        });
      }
    } catch (err) {
      console.error('Session Archival execution error:', err);
      setErrorMsg('Archival failed: ' + err.message);
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-1 sm:p-3 animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-6xl w-full max-h-[96vh] sm:max-h-[94vh] flex flex-col shadow-2xl border border-slate-300 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white my-auto">
        
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 border border-purple-600/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Database size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">
                  Annual Session Lifecycle & Rollover Manager
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  PIN 313313 Guarded
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Form No Deduplication • Class-Wise 48-Column Preview • Zero Data Loss
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={step === 'executing'}
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
            title="Close Rollover Modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3.5">
          
          {loading && (
            <ModernLoader
              moduleKey="archive"
              text="Auditing admission records for session..."
              subtext="Please wait."
              className="py-12"
            />
          )}

          {!loading && errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-black flex items-center gap-2">
              <AlertTriangle size={15} className="flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {reconcileResult && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold space-y-1 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={15} />
                <span>Form Number Reconciliation & Deduplication Complete!</span>
              </div>
              <p className="text-[11px]">
                Matched <strong>{reconcileResult.matchedCount}</strong> duplicates via Form Number. Harvested <strong>{reconcileResult.fieldsHarvestedCount}</strong> missing fields across {reconcileResult.admissionsPatchedCount} applications. Purged <strong>{reconcileResult.purgedCount}</strong> duplicate records from master registers.
              </p>
            </div>
          )}

          {!loading && step === 'analysis' && (
            <>
              {/* 1. Pre-Flight Deduplication & Harvest Card */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0 shadow-2xs">
                    <Sparkles size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-xs text-purple-950 dark:text-purple-200 block">
                      Phase 1: Form Number Deduplication & Legacy Field Harvest
                    </span>
                    <p className="text-[10.5px] text-purple-800 dark:text-purple-300 font-medium leading-tight">
                      Match the 401 duplicates in <code className="font-mono font-bold">masterRegisters</code> by Form Number, harvest missing fields (Adm No, Adm Date, APAAR ID, DoB Words) into <code className="font-mono font-bold">admissions</code>, and permanently purge the duplicates.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isReconciling}
                  onClick={handleRunReconciliation}
                  className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-black text-xs shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 transition-all"
                  title="Run 1-Click Form Number Matching & Deduplication"
                >
                  {isReconciling ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Reconciling & Purging...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      <span>Reconcile Duplicates (Form No Match)</span>
                    </>
                  )}
                </button>
              </div>

              {/* 2. Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-0.5">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block">Total Active In Admissions</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1">
                    <Users size={16} className="text-slate-600" />
                    <span>{analysis.total}</span>
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-400 block">Active Intake</span>
                </div>

                <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-0.5">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">To Be Archived (Approved)</span>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Archive size={16} />
                    <span>{analysis.approved.length}</span>
                  </div>
                  <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-300 block">Migrates to masterRegisters</span>
                </div>

                <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/30 space-y-0.5">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Unapproved / Drafts</span>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Download size={16} />
                    <span>{analysis.unapproved.length}</span>
                  </div>
                  <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-300 block">Auto-downloaded as JSON & purged</span>
                </div>

                <div className="p-2.5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/30 space-y-0.5">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 block">Photos Preserved</span>
                  <div className="text-lg font-black text-purple-700 dark:text-purple-400 flex items-center gap-1">
                    <Sparkles size={16} />
                    <span>{analysis.totalPhotos}</span>
                  </div>
                  <span className="text-[9.5px] font-bold text-purple-600 dark:text-purple-300 block">Canonical photo_id</span>
                </div>
              </div>

              {/* 3. Session Tagging Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
                <div className="space-y-0.5">
                  <label className="block text-[10.5px] font-black text-slate-700 dark:text-slate-300">
                    1. Archive Active Cohort As Session:
                  </label>
                  <input
                    type="text"
                    value={archiveSessionTag}
                    onChange={(e) => setArchiveSessionTag(e.target.value)}
                    placeholder="e.g. 2025-26"
                    className="w-full p-1.5 rounded-lg text-xs font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <p className="text-[9.5px] text-slate-500 font-medium">Approved records stored in master registers under this session.</p>
                </div>

                <div className="space-y-0.5">
                  <label className="block text-[10.5px] font-black text-slate-700 dark:text-slate-300">
                    2. Initialize Incoming Active Session:
                  </label>
                  <input
                    type="text"
                    value={newSessionTag}
                    onChange={(e) => setNewSessionTag(e.target.value)}
                    placeholder="e.g. 2026-27"
                    className="w-full p-1.5 rounded-lg text-xs font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <p className="text-[9.5px] text-slate-500 font-medium">Portal will wipe active admissions and open intake for this session.</p>
                </div>
              </div>

              {/* 4. Comprehensive Class-Wise 48-Column Preview Grid */}
              <div className="space-y-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                
                {/* Header Row: Class Tabs & Status Filter */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  {/* Class Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10.5px] font-black">
                    {[
                      { id: 'ALL', label: `All Classes (${analysis.total})` },
                      { id: '9th', label: `Class 9th (${analysis.byClass['9th']})` },
                      { id: '10th', label: `Class 10th (${analysis.byClass['10th']})` },
                      { id: '11th', label: `Class 11th (${analysis.byClass['11th']})` },
                      { id: '12th', label: `Class 12th (${analysis.byClass['12th']})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedClassTab(tab.id)}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                          selectedClassTab === tab.id
                            ? 'bg-purple-700 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter & Search */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10.5px] font-black">
                      <button
                        type="button"
                        onClick={() => setFilterTab('all')}
                        className={`px-2 py-1 rounded-md transition-all ${filterTab === 'all' ? 'bg-purple-700 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        All ({analysis.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('approved')}
                        className={`px-2 py-1 rounded-md transition-all ${filterTab === 'approved' ? 'bg-emerald-700 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        Approved ({analysis.approved.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('unapproved')}
                        className={`px-2 py-1 rounded-md transition-all ${filterTab === 'unapproved' ? 'bg-amber-700 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        Unapproved ({analysis.unapproved.length})
                      </button>
                    </div>

                    <div className="relative w-36 sm:w-44">
                      <Search size={11} className="absolute left-2 top-2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student / form..."
                        className="w-full pl-6 pr-2 py-1 rounded-lg text-[10.5px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                </div>

                {/* Subtitle with Column Indicator */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold px-0.5">
                  <span>Showing {previewRecords.length} student records across 48 official columns:</span>
                  <span className="text-purple-600 dark:text-purple-400 font-black">Scroll horizontally to inspect all 48 columns &rarr;</span>
                </div>

                {/* 48-Column High-Density Data Grid */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-56 scrollbar-thin">
                  <table className="w-full text-left text-[10px] font-bold border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        {STANDARD_48_COLUMNS.map((col, cIdx) => (
                          <th
                            key={col.key}
                            className={`p-1.5 border-r border-slate-200 dark:border-slate-700 ${
                              cIdx === 0
                                ? 'sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 shadow-2xs'
                                : ''
                            } ${col.key === 'rolloverAction' ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200' : ''}`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewRecords.map((r, idx) => {
                        const isAppr = resolveStudentAdmissionStatus(r) === 'Approved';

                        return (
                          <tr key={r.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            {STANDARD_48_COLUMNS.map((col, cIdx) => {
                              const cellVal = getStudentColumnValue(r, col.key, idx);

                              if (col.key === 'rolloverAction') {
                                return (
                                  <td key={col.key} className="p-1.5 border-r border-slate-100 dark:border-slate-800">
                                    {isAppr ? (
                                      <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                                        <Check size={10} /> Migrate to masterRegisters
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                                        <Download size={10} /> Download JSON & Purge
                                      </span>
                                    )}
                                  </td>
                                );
                              }

                              if (col.key === 'status') {
                                return (
                                  <td key={col.key} className="p-1.5 border-r border-slate-100 dark:border-slate-800">
                                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${
                                      isAppr
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    }`}>
                                      {cellVal}
                                    </span>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={col.key}
                                  className={`p-1.5 border-r border-slate-100 dark:border-slate-800 truncate max-w-[200px] ${
                                    cIdx === 0
                                      ? 'sticky left-0 bg-white dark:bg-slate-900 z-10 font-black'
                                      : ''
                                  } ${col.key === 'formNo' ? 'font-mono font-black text-teal-700 dark:text-teal-400' : ''}`}
                                  title={String(cellVal)}
                                >
                                  {cellVal}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {previewRecords.length === 0 && (
                        <tr>
                          <td colSpan={STANDARD_48_COLUMNS.length} className="p-4 text-center text-slate-400">
                            No records found matching filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: SAFETY CONFIRMATION & ADMINISTRATIVE PIN 313313 */}
          {!loading && step === 'confirm' && (
            <div className="space-y-3.5 py-1">
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5">
                <div className="flex items-center gap-2 font-black text-xs text-purple-900 dark:text-purple-200">
                  <ShieldAlert size={16} className="text-purple-600 shrink-0" />
                  <span>Administrative Authorization & Rollover Execution Confirmation</span>
                </div>
                <p className="text-[11px] font-bold text-purple-800 dark:text-purple-300 leading-relaxed">
                  Executing this rollover will pack <strong>{analysis.approved.length} approved students</strong> into permanent <code className="font-mono font-black">masterRegisters</code> chunks for session <strong>"{archiveSessionTag}"</strong>. All <strong>{analysis.unapproved.length} unapproved/draft records</strong> will automatically download as an offline <code className="font-mono font-black">.json</code> file to your computer. Active <code className="font-mono font-black">admissions</code> will be completely emptied for incoming session <strong>"{newSessionTag}"</strong>.
                </p>
              </div>

              {/* Security Authorization Card: Confirmation Text + PIN 313313 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3 text-xs">
                {/* 1. Confirmation Text */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200">
                    Step 1: Type <span className="font-mono text-purple-600 dark:text-purple-400 select-all font-black">"{requiredConfirmText}"</span> to confirm session:
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={`Type "${requiredConfirmText}" exactly`}
                    className="w-full p-2 rounded-lg font-mono font-black text-xs border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500"
                  />
                  {confirmInput && !isConfirmTextValid && (
                    <span className="text-[10px] text-rose-500 font-bold block">Text does not match "{requiredConfirmText}"</span>
                  )}
                  {isConfirmTextValid && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <Check size={11} /> Session text confirmation verified
                    </span>
                  )}
                </div>

                {/* 2. Security PIN Input (313313) */}
                <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Lock size={12} className="text-purple-600" />
                      <span>Step 2: Enter Administrative Security PIN:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                    >
                      {showPin ? <EyeOff size={11} /> : <Eye size={11} />}
                      <span>{showPin ? 'Hide PIN' : 'Show PIN'}</span>
                    </button>
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter 6-digit administrative security PIN"
                    maxLength={10}
                    className="w-full p-2 rounded-lg font-mono font-black text-xs border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 tracking-widest"
                  />
                  {pinInput && !isPinValid && (
                    <span className="text-[10px] text-rose-500 font-bold block">Invalid security PIN. Access denied.</span>
                  )}
                  {isPinValid && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <ShieldCheck size={11} /> Administrative PIN (313313) Authorized
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EXECUTING PROGRESS */}
          {step === 'executing' && (
            <div className="py-8 px-4">
              <ModernLoader
                moduleKey="archive"
                text="Executing Session Rollover & Packaging Master Registers…"
                subtext={progressStage}
                progress={progressPercent}
                className="py-4"
              />
            </div>
          )}

          {/* STEP 4: COMPLETED */}
          {step === 'completed' && (
            <div className="py-8 px-4 space-y-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">Annual Session Successfully Archived!</h3>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
                  <strong>{analysis.approved.length} approved students</strong> packaged into permanent <code className="font-mono text-purple-600">masterRegisters</code> chunks under session <strong>{archiveSessionTag}</strong>. All unapproved records downloaded to offline JSON. Active admissions intake is now 100% clean for session <strong>{newSessionTag}</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            disabled={step === 'executing'}
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer disabled:opacity-50"
          >
            {step === 'completed' ? 'Close & Refresh' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2">
            {!loading && step === 'analysis' && (
              <button
                type="button"
                disabled={analysis.approved.length === 0}
                onClick={() => setStep('confirm')}
                className="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-purple-700 hover:bg-purple-600 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                <span>Proceed to Rollover Authorization (PIN 313313)</span>
                <ArrowRight size={13} />
              </button>
            )}

            {!loading && step === 'confirm' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('analysis')}
                  className="px-3 py-1.5 rounded-lg text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                >
                  Back to Preview
                </button>
                <button
                  type="button"
                  disabled={!isAuthorized}
                  onClick={executeArchival}
                  className="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-purple-700 hover:bg-purple-600 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Database size={13} />
                  <span>Execute Rollover & Purge Admissions</span>
                </button>
              </>
            )}

            {step === 'completed' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-emerald-700 hover:bg-emerald-600 shadow-2xs cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
