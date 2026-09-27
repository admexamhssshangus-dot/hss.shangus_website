import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Database, ShieldAlert, CheckCircle2, AlertTriangle, X, RefreshCw, 
  ArrowRight, Search, Sparkles, Check,
  Download, Lock, Eye, EyeOff, ShieldCheck, ChevronDown, ChevronUp, Settings
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import verifiedCatalog from '../../data/verifiedStudentsCatalog.json';
import { extractRegNo, formatStudentAdmNo, getStudentRollVal } from './AdvancedReports';
import { 
  loadSessionAdmissions, 
  archiveSessionRecords, 
  scanSessionDuplicates,
  executeDuplicatesReconciliation,
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
    const parts = String(currentSession || '').split('-');
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return `${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`;
    }
    return '2026-27';
  });

  // UI State: Collapsible Configuration Strip
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  // Keep session tags reactive to active database session
  useEffect(() => {
    if (currentSession) {
      setArchiveSessionTag(currentSession);
      const parts = String(currentSession).split('-');
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setNewSessionTag(`${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`);
      }
    }
  }, [currentSession]);

  // Safety Confirmation & Security PIN for Rollover
  const [confirmInput, setConfirmInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [step, setStep] = useState('analysis'); // 'analysis' | 'confirm' | 'executing' | 'completed'
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Phase 1: Safe Scan -> Preview -> Confirm Audit Modal State
  const [isScanning, setIsScanning] = useState(false);
  const [scanPlan, setScanPlan] = useState(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditPinInput, setAuditPinInput] = useState('');
  const [isExecutingAudit, setIsExecutingAudit] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  // Load and enrich admissions with master registers and verified catalog fallbacks
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await loadSessionAdmissions(archiveSessionTag);

      // 1. Index verifiedStudentsCatalog by Form Number
      const catalogByForm = new Map();
      if (Array.isArray(verifiedCatalog)) {
        verifiedCatalog.forEach(cat => {
          const fNo = normalizeFormNo(cat.fNo || cat.formNo || cat['Form Number'] || '');
          if (fNo) catalogByForm.set(fNo, cat);
        });
      }

      // 2. Fetch masterRegisters to index by Form Number
      const masterSnap = await getDocs(collection(db, 'masterRegisters'));
      const masterByForm = new Map();
      masterSnap.docs.forEach(docSnap => {
        const dData = docSnap.data();
        if (!dData || dData.Status === 'Deleted' || dData.status === 'Deleted' || dData._deleted === true) return;
        const chunkItems = dData.items || dData.students || dData.records || dData.data;
        if (Array.isArray(chunkItems)) {
          chunkItems.forEach(item => {
            if (!item) return;
            const fNo = normalizeFormNo(item['Form Number'] || item['Form No.'] || item.formNo || item.id || '');
            if (fNo && !masterByForm.has(fNo)) {
              masterByForm.set(fNo, item);
            }
          });
        } else {
          const fNo = normalizeFormNo(dData['Form Number'] || dData['Form No.'] || dData.formNo || dData.id || '');
          if (fNo && !masterByForm.has(fNo)) {
            masterByForm.set(fNo, dData);
          }
        }
      });

      // 3. Enrich raw admissions with verified fields so no student has missing data
      const enrichedList = list.map(adm => {
        const fNo = normalizeFormNo(adm['Form Number'] || adm['Form No.'] || adm.formNo || adm.id || '');
        const masterMatch = fNo ? masterByForm.get(fNo) : null;
        const catMatch = fNo ? catalogByForm.get(fNo) : null;

        return {
          ...adm,
          _masterMatch: masterMatch,
          _catMatch: catMatch,
          _masterAdmNo: masterMatch?.['Admission No'] || masterMatch?.['Admission No.'] || masterMatch?.admNo || masterMatch?.admissionNo,
          _masterRegNo: catMatch?.boardRegNo || masterMatch?.['Board Registration Number'] || masterMatch?.boardRegNo || masterMatch?.regNo,
          _masterFatherName: catMatch?.fatherName || masterMatch?.["Father's Name"] || masterMatch?.["Father's/Guardian's Name"] || masterMatch?.fatherName,
          _masterMotherName: masterMatch?.["Mother's Name"] || masterMatch?.motherName,
          _masterDob: catMatch?.dob || masterMatch?.['DoB (figures)'] || masterMatch?.['DoB (as per school records)'] || masterMatch?.dob,
          _masterStream: catMatch?.stream || masterMatch?.Stream || masterMatch?.stream,
          _masterClassRollNo: catMatch?.classRollNo || masterMatch?.['Class Roll No'] || masterMatch?.classRollNo
        };
      });

      setRawAdmissions(enrichedList);
    } catch (err) {
      console.error('Failed to load admissions for archival analysis:', err);
      setErrorMsg('Failed to load admissions records: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [archiveSessionTag]);

  useEffect(() => {
    if (!isOpen) return;
    setStep('analysis');
    setConfirmInput('');
    setPinInput('');
    setReconcileResult(null);
    setScanPlan(null);
    setIsAuditModalOpen(false);
    loadData();
  }, [isOpen, loadData]);

  // Phase 1 Step 1: Trigger Read-Only Scan & Open Audit Preview Modal
  const handleStartScan = async () => {
    setIsScanning(true);
    setErrorMsg(null);
    try {
      const plan = await scanSessionDuplicates({
        session: archiveSessionTag,
        onProgress: (pct, msg) => setProgressStage(msg)
      });
      setScanPlan(plan);
      setAuditPinInput('');
      setIsAuditModalOpen(true);
    } catch (err) {
      console.error('Scan error:', err);
      setErrorMsg('Scan failed: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Phase 1 Step 2: Confirm & Execute Reconciliation
  const handleConfirmExecuteAudit = async () => {
    if (!scanPlan) return;
    if (auditPinInput.trim() !== '313313') {
      alert('Security Verification Failed: Incorrect administrative security PIN.');
      return;
    }

    setIsExecutingAudit(true);
    setErrorMsg(null);
    try {
      const res = await executeDuplicatesReconciliation({
        scanPlan,
        onProgress: (pct, msg) => setProgressStage(msg)
      });
      setReconcileResult(res);
      setIsAuditModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Execution error:', err);
      alert('Reconciliation failed: ' + err.message);
    } finally {
      setIsExecutingAudit(false);
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

  // Comprehensive extraction engine across all 48 official columns
  const getStudentColumnValue = (s, colKey, idx) => {
    switch (colKey) {
      case 'sno': return s.sno || idx + 1;
      case 'classRollNo': return getAssignedClassRollNumber(s) || getStudentRollVal(s) || s['Class Roll No'] || s['Class Roll No.'] || s['RL. NO.'] || s.classRollNo || s.rollNo || s._masterClassRollNo || '—';
      case 'admNo': return formatStudentAdmNo(s) || s['Admission No'] || s['Admission No.'] || s['Adm. No.'] || s['Adm No'] || s['Adm No.'] || s.admNo || s.admissionNo || s.admissionNumber || s['Old Admission No.'] || s._masterAdmNo || '—';
      case 'formNo': return s['Form Number'] || s['Form No.'] || s['Form No'] || s.formNo || s.id || '—';
      case 'class': return s['Admission sought for class'] || s.Class || s.class || s.targetClass || s._catMatch?.className || '—';
      case 'session': return s.Session || s.session || s['Academic Session'] || archiveSessionTag || '—';
      case 'stream': return s['Stream for Class 11th'] || s['Stream opted in Class 11th'] || s['Stream & Subjects for Class 12th'] || s.Stream || s.stream || s['Academic Stream'] || s._masterStream || 'General';
      case 'boardRegNo': return extractRegNo(s) || s['Board Registration Number'] || s['Board Registration No. (Class 10th)'] || s['Board Registration No. (Class 11th)'] || s['Board Reg. No.'] || s['Registration No. (allotted by JKBOSE)'] || s['DIET Registration No.'] || s.boardRegNo || s.regNo || s._masterRegNo || '—';
      case 'name': return s["Student's Name (as per school records)"] || s["Student's Name"] || s['Student Name'] || s.studentName || s.name || s._catMatch?.name || 'Student';
      case 'fatherName': return s["Father's/Guardian's Name (as per school records)"] || s["Father's/Guardian's Name"] || s["Father's Name (as per school records)"] || s["Father's Name"] || s['Father Name'] || s["Parent's Name"] || s.fatherName || s.parentName || s.parentage || s._masterFatherName || '—';
      case 'motherName': return s["Mother's Name (as per school records)"] || s["Mother's Name"] || s['Mother Name'] || s.motherName || s.Mother || s._masterMotherName || '—';
      case 'dob': {
        const rawDob = s.directEditHistory?.dob?.newValue || s.fieldEditHistory?.dob?.newValue || s['DoB (as per school records)'] || s['DoB (figures)'] || s['DoB (in figures)'] || s['Date of Birth'] || s['Date of Birth (as per school records)'] || s.dob || s.DoB || s.dateOfBirth || s._masterDob;
        if (!rawDob || rawDob === '—' || rawDob === '-') return '—';
        const str = String(rawDob).trim();
        const parts = str.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
          if (parts[2].length === 4) return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
        }
        return str;
      }
      case 'gender': return s['Gender'] || s.gender || s.Sex || s.sex || '—';
      case 'category': return s['Social category'] || s['Category'] || s['Cat._JKBOSE'] || s['Social Category'] || s.category || 'General';
      case 'penNo': return s['PEN number (given by UDISE portal)'] || s['PEN No'] || s['PEN No.'] || s['Permanent Education Number (PEN)'] || s.penNo || s.pen || s['APAAR ID'] || s.apaarId || '—';
      case 'aadhaar': return s['Aadhar No.'] || s['Aadhaar Number'] || s['Aadhaar No.'] || s['Aadhaar Number (12 Digits)'] || s.aadhaar || s.aadhar || s.aadhaarNo || '—';
      case 'fatherAadhaar': return s["Father's Aadhar No."] || s["Father's Aadhaar No."] || s["Father's Aadhaar Number"] || s.fatherAadhaar || '—';
      case 'mobile': return s['Mobile No. (with working WhatsApp)'] || s['Mobile No.'] || s['Mobile Number'] || s["Student's Contact"] || s.mobile || s.contact || '—';
      case 'parentContact': return s["Parent's Mobile No. (must be working)"] || s["Parent's Contact"] || s['Alternate Mobile No.'] || s.parentContact || s.parentMobile || '—';
      case 'email': return s['Email Address'] || s['Email'] || s.email || '—';
      case 'address': return s['Name of your village'] || s['Residence (Village, District)'] || s['Permanent Address'] || s['Village/Town'] || s.residence || s.address || s.village || '—';
      case 'tehsil': return s['Tehsil'] || s.tehsil || '—';
      case 'district': return s['District'] || s.district || '—';
      case 'pincode': return s['PIN code'] || s['Pin Code'] || s['Pincode'] || s.pincode || s.pinCode || '—';
      case 'sub1': return s.Subjects1 || s.subjects1 || s.subject1 || s['Subject 1'] || s['Subjects to be taken in Class 11th']?.split?.(',')?.[0] || '—';
      case 'sub2': return s.Subjects2 || s.subjects2 || s.subject2 || s['Subject 2'] || s['Subjects to be taken in Class 11th']?.split?.(',')?.[1] || '—';
      case 'sub3': return s.Subjects3 || s.subjects3 || s.subject3 || s['Subject 3'] || s['Subjects to be taken in Class 11th']?.split?.(',')?.[2] || '—';
      case 'sub4': return s.Subjects4 || s.subjects4 || s.subject4 || s['Subject 4'] || s['Subjects to be taken in Class 11th']?.split?.(',')?.[3] || '—';
      case 'sub5': return s.Subjects5 || s.subjects5 || s.subject5 || s['Subject 5'] || s['Subjects to be taken in Class 11th']?.split?.(',')?.[4] || '—';
      case 'sub6': return s.Subjects6 || s.subjects6 || s.subject6 || s['Subject 6'] || s.additionalSubject || '—';
      case 'compositeSubs': return s.subjects || s.subs || s['Subjects'] || s['Subjects Offered'] || s['Subjects to be taken in Class 11th'] || s['Subjects Studied in Class 11th'] || s['Stream & Subjects for Class 12th'] || '—';
      case 'prevSchool': return s['Name of Previous School (Class 10th)'] || s['Name of Previous School (Class 11th)'] || s['Name of Previous School (Class 8th)'] || s['Name of the Institution last attended'] || s['Previous School'] || s.prevSchool || '—';
      case 'prevExamRollNo': return s['Exam Roll Number of Class 10th'] || s['Exam Roll Number of Class 11th'] || s['Roll No. (Class 10th)'] || s['Exam R.No. (Prev.)'] || s.prevExamRollNo || s.prevRollNo || '—';
      case 'prevMarksObt': return s['Total Marks Obtained in Class 10th'] || s['Total Marks Obtained in Class 11th'] || s['Total Marks Obtained in Class 8th'] || s['Marks Obtained (Class 10th)'] || s['Marks Obt. (Prev.)'] || s.prevMarksObt || s.prevMarks || '—';
      case 'prevMaxMarks': return s['Total Max. Marks in Class 10th'] || s['Total Max. Marks in Class 11th'] || s['Total Max. Marks in Class 8th'] || s['Max Marks (Class 10th)'] || s['Max. Marks (Prev.)'] || s.prevMaxMarks || '500';
      case 'prevPercentage': return s['Percentage (Class 10th)'] || s['%age (Prev.)'] || s.prevPercentage || (s.prevMarksObt && s.prevMaxMarks ? `${((Number(s.prevMarksObt)/Number(s.prevMaxMarks))*100).toFixed(1)}%` : '—');
      case 'prevDivision': return s['Previous Result / Marks'] || s['Div/Distinc (Prev.)'] || s.prevDivision || '—';
      case 'currExamRollNo': return s['Board Roll Number'] || s['Board Roll No.'] || s['Exam R.No. (Current)'] || s['Exam R. No. (Current)'] || s.boardRoll || s.currExamRollNo || s.examRollNo || '—';
      case 'currResult': return s['Result (Current)'] || s['Board Result'] || s.result || s.currResult || '—';
      case 'currMarks': return s['Marks/Reapp (Current)'] || s['Marks Obtained'] || s.currMarks || s.marks || '—';
      case 'admDate': return s['Adm. Date'] || s['Admission Date'] || s.admissionDate || s.admDate || '—';
      case 'status': return resolveStudentAdmissionStatus(s);
      case 'bankAccount': return s['Bank Account No.'] || s['Bank Account No'] || s.bankAccount || s.accountNo || '—';
      case 'bankName': return s['Name of Bank'] || s['Bank Name'] || s.bankName || '—';
      case 'ifsc': return s['IFSC code'] || s['IFSC Code'] || s.ifsc || '—';
      case 'paymentRef': return s['Payment Reference'] || s['Payment Ref'] || s.paymentRef || s.utrNo || s.transactionId || '—';
      case 'photoStatus': {
        const p = s.photo_id || s['Student Photo'] || s.photoUrl || s.photoId;
        return (p && p.length > 20) ? 'Available' : 'Missing';
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
        const cls = String(r['Admission sought for class'] || r.Class || r.class || r._catMatch?.className || '').toLowerCase();
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
      const name = String(r["Student's Name (as per school records)"] || r.studentName || r["Student's Name"] || r._catMatch?.name || '').toLowerCase();
      const form = String(r['Form Number'] || r['Form No.'] || r.formNo || r.id || '').toLowerCase();
      const roll = String(r['Class Roll No'] || r.classRollNo || r._masterClassRollNo || '').toLowerCase();
      const reg = String(r['Board Registration Number'] || r.regNo || r._masterRegNo || '').toLowerCase();
      return name.includes(q) || form.includes(q) || roll.includes(q) || reg.includes(q);
    });
  }, [analysis, filterTab, rawAdmissions, searchQuery, selectedClassTab]);

  // Validation rules for rollover execution
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

  // Filtered audit candidates in preview modal
  const filteredAuditCandidates = useMemo(() => {
    if (!scanPlan?.harvestedDetails) return [];
    if (!auditSearchQuery.trim()) return scanPlan.harvestedDetails;
    const q = auditSearchQuery.toLowerCase().trim();
    return scanPlan.harvestedDetails.filter(c => 
      c.formNo.includes(q) || 
      c.studentName.toLowerCase().includes(q) || 
      c.className.toLowerCase().includes(q) ||
      c.rollNo.includes(q)
    );
  }, [scanPlan, auditSearchQuery]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-1 sm:p-2.5 animate-fadeIn overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-[98vw] w-full h-[96vh] max-h-[96vh] flex flex-col shadow-2xl border border-slate-300 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white my-auto">
        
        {/* COMPACT HEADER (Title + Quick Inline KPIs + Config Toggle + Close) */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-600/10 border border-purple-600/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Database size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-none truncate">
                  Annual Session Lifecycle & Rollover Manager
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  PIN Guarded
                </span>
              </div>
              <p className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
                Form No Deduplication • 48-Column Preview • Zero Data Loss
              </p>
            </div>
          </div>

          {/* Quick Mini-KPI Pills in Header */}
          <div className="hidden lg:flex items-center gap-1 text-[10px] font-black">
            <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300" title="Total active applications">
              Active: <strong>{analysis.total}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50" title="Approved to migrate to master registers">
              Approved: <strong>{analysis.approved.length}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300/50" title="Unapproved / Draft to download to JSON">
              Drafts: <strong>{analysis.unapproved.length}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300/50" title="Preserved photo IDs">
              Photos: <strong>{analysis.totalPhotos}</strong>
            </span>
          </div>

          {/* Controls: Settings Strip Toggle & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 cursor-pointer transition-all ${
                isConfigExpanded 
                  ? 'bg-purple-700 text-white border-purple-800 shadow-2xs' 
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Toggle Session Rollover Configuration & Phase 1 Tools"
            >
              <Settings size={11} />
              <span>Session & Audit Tools</span>
              {isConfigExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            <button
              type="button"
              disabled={step === 'executing'}
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer disabled:opacity-50"
              title="Close Rollover Modal"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* COLLAPSIBLE CONFIGURATION & PHASE 1 AUDIT BAR */}
        {isConfigExpanded && (
          <div className="p-2 sm:p-2.5 border-b border-slate-200 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-950/20 text-xs shrink-0 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">1. Archive Active:</span>
                  <input
                    type="text"
                    value={archiveSessionTag}
                    onChange={(e) => setArchiveSessionTag(e.target.value)}
                    className="w-24 px-2 py-0.5 rounded-md text-[11px] font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">2. New Session:</span>
                  <input
                    type="text"
                    value={newSessionTag}
                    onChange={(e) => setNewSessionTag(e.target.value)}
                    className="w-24 px-2 py-0.5 rounded-md text-[11px] font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
                  />
                </div>
              </div>

              {/* Phase 1 Action: Safe Read-Only Audit Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={handleStartScan}
                  className="px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-black text-[11px] shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  title="Run Safe Pre-Flight Audit: Scan masterRegisters for duplicates, preview harvestable fields, and ask proper confirmation"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw size={11} className="animate-spin" />
                      <span>Auditing Duplicates...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} />
                      <span>Phase 1: Scan Duplicates & Field Audit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RECONCILE SUCCESS BANNER (IF EXECUTED) */}
        {reconcileResult && (
          <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-[10.5px] font-bold flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>
                Reconciliation Complete: Matched <strong>{reconcileResult.matchedCount}</strong> duplicates via Form Number. Harvested <strong>{reconcileResult.fieldsHarvestedCount}</strong> fields into admissions. Purged <strong>{reconcileResult.purgedCount}</strong> duplicate records from master registers.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReconcileResult(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* ERROR BANNER */}
        {errorMsg && (
          <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-black flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="p-0.5">
              <X size={12} />
            </button>
          </div>
        )}

        {/* MAIN BODY AREA (FLEX-1, ZERO MAX-H-56 RESTRICTION) */}
        <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 overflow-hidden">
          
          {loading && (
            <ModernLoader
              moduleKey="archive"
              text="Auditing admission records for session..."
              subtext="Please wait."
              className="my-auto py-12"
            />
          )}

          {!loading && step === 'analysis' && (
            <>
              {/* HIGH-DENSITY FILTER TOOLBAR */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pb-2 shrink-0 border-b border-slate-100 dark:border-slate-800">
                {/* Left: Class Pills */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10.5px] font-black shrink-0">
                  {[
                    { id: 'ALL', label: `All (${analysis.total})` },
                    { id: '9th', label: `9th (${analysis.byClass['9th']})` },
                    { id: '10th', label: `10th (${analysis.byClass['10th']})` },
                    { id: '11th', label: `11th (${analysis.byClass['11th']})` },
                    { id: '12th', label: `12th (${analysis.byClass['12th']})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedClassTab(tab.id)}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer whitespace-nowrap ${
                        selectedClassTab === tab.id
                          ? 'bg-purple-700 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Center / Right: Status Filter & Search */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10.5px] font-black">
                    <button
                      type="button"
                      onClick={() => setFilterTab('all')}
                      className={`px-2 py-0.5 rounded transition-all ${filterTab === 'all' ? 'bg-purple-700 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      All ({analysis.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('approved')}
                      className={`px-2 py-0.5 rounded transition-all ${filterTab === 'approved' ? 'bg-emerald-700 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      Approved ({analysis.approved.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('unapproved')}
                      className={`px-2 py-0.5 rounded transition-all ${filterTab === 'unapproved' ? 'bg-amber-700 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      Drafts ({analysis.unapproved.length})
                    </button>
                  </div>

                  <div className="relative w-36 sm:w-44">
                    <Search size={11} className="absolute left-2 top-2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search student / form..."
                      className="w-full pl-6 pr-2 py-0.5 rounded-lg text-[10.5px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>

                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold whitespace-nowrap pl-1">
                    Showing {previewRecords.length} records (48 columns) &rarr;
                  </span>
                </div>
              </div>

              {/* ULTRA-COMPACT 48-COLUMN TABLE (FLEX-1 FULL VERTICAL EXPANSION) */}
              <div className="flex-1 min-h-0 border border-slate-200 dark:border-slate-800 rounded-xl overflow-auto bg-white dark:bg-slate-900 scrollbar-thin mt-1.5">
                <table className="w-full text-left text-[11px] font-bold border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                    <tr className="h-7">
                      {STANDARD_48_COLUMNS.map((col, cIdx) => (
                        <th
                          key={col.key}
                          className={`px-2 py-1 border-r border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-wider ${
                            cIdx === 0
                              ? 'sticky left-0 bg-slate-100 dark:bg-slate-800 z-30 shadow-2xs'
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
                        <tr key={r.id || idx} className="h-8 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors">
                          {STANDARD_48_COLUMNS.map((col, cIdx) => {
                            const cellVal = getStudentColumnValue(r, col.key, idx);

                            if (col.key === 'rolloverAction') {
                              return (
                                <td key={col.key} className="px-2 py-1 border-r border-slate-100 dark:border-slate-800">
                                  {isAppr ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-full">
                                      <Check size={9} /> Migrate to masterRegisters
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded-full">
                                      <Download size={9} /> Auto-JSON & Purge
                                    </span>
                                  )}
                                </td>
                              );
                            }

                            if (col.key === 'status') {
                              return (
                                <td key={col.key} className="px-2 py-1 border-r border-slate-100 dark:border-slate-800">
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
                                className={`px-2 py-1 border-r border-slate-100 dark:border-slate-800 truncate max-w-[220px] ${
                                  cIdx === 0
                                    ? 'sticky left-0 bg-white dark:bg-slate-900 z-10 font-black'
                                    : ''
                                } ${col.key === 'formNo' ? 'font-mono font-black text-teal-700 dark:text-teal-400' : ''} ${
                                  col.key === 'boardRegNo' && cellVal !== '—' ? 'font-mono text-purple-700 dark:text-purple-300 font-black' : ''
                                }`}
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
                        <td colSpan={STANDARD_48_COLUMNS.length} className="p-6 text-center text-slate-400">
                          No student records found matching active filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* STEP 2: SAFETY CONFIRMATION & ADMINISTRATIVE PIN 313313 */}
          {!loading && step === 'confirm' && (
            <div className="space-y-3.5 py-2 my-auto max-w-xl mx-auto w-full">
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
                      <ShieldCheck size={11} /> Administrative PIN Verified & Authorized
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EXECUTING PROGRESS */}
          {step === 'executing' && (
            <div className="py-12 px-4 my-auto">
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
            <div className="py-12 px-4 space-y-3 text-center my-auto">
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

        {/* FOOTER ACTIONS */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <button
            type="button"
            disabled={step === 'executing'}
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer disabled:opacity-50"
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
                <span>Proceed to Rollover Authorization</span>
                <ArrowRight size={13} />
              </button>
            )}

            {!loading && step === 'confirm' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('analysis')}
                  className="px-3 py-1 rounded-lg text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
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

      {/* PHASE 1: DEDICATED RECONCILIATION AUDIT & CONFIRMATION MODAL */}
      {isAuditModalOpen && scanPlan && (
        <div className="fixed inset-0 z-[100000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-purple-300 dark:border-purple-800 overflow-hidden text-slate-900 dark:text-white">
            
            {/* Audit Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-purple-50 dark:bg-purple-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-600" />
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-purple-950 dark:text-purple-200">
                    Phase 1: Form Number Reconciliation Audit & Field Harvest Preview
                  </h3>
                  <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                    Safe Read-Only Audit • No changes committed yet
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isExecutingAudit}
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Audit Modal Content */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3">
              
              {/* Stat Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <span className="text-[9px] uppercase font-black text-slate-500 block">Duplicates Detected</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{scanPlan.duplicatesFound}</span>
                  <span className="text-[9px] text-slate-400 block">in masterRegisters</span>
                </div>
                <div className="p-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
                  <span className="text-[9px] uppercase font-black text-emerald-700 dark:text-emerald-400 block">Matched via Form No</span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-400">{scanPlan.matchedCount}</span>
                  <span className="text-[9px] text-emerald-600 block">1:1 match in admissions</span>
                </div>
                <div className="p-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30">
                  <span className="text-[9px] uppercase font-black text-purple-700 dark:text-purple-400 block">Applications To Enrich</span>
                  <span className="text-base font-black text-purple-700 dark:text-purple-400">{scanPlan.admissionsPatchedCount}</span>
                  <span className="text-[9px] text-purple-600 block">will gain missing fields</span>
                </div>
                <div className="p-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30">
                  <span className="text-[9px] uppercase font-black text-indigo-700 dark:text-indigo-400 block">Total Fields To Harvest</span>
                  <span className="text-base font-black text-indigo-700 dark:text-indigo-400">{scanPlan.fieldsHarvestedCount}</span>
                  <span className="text-[9px] text-indigo-600 block">zero data loss</span>
                </div>
              </div>

              {/* Candidate Harvest Preview */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                    Candidate Applications with Harvestable Missing Fields ({filteredAuditCandidates.length}):
                  </span>
                  <div className="relative w-48">
                    <Search size={11} className="absolute left-2 top-2 text-slate-400" />
                    <input
                      type="text"
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      placeholder="Filter candidate..."
                      className="w-full pl-6 pr-2 py-0.5 rounded text-[10px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 scrollbar-thin">
                  {filteredAuditCandidates.map((c, i) => (
                    <div key={i} className="p-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded font-mono font-black text-[10px] bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                            Form {c.formNo}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {c.studentName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            ({c.className}, Roll: {c.rollNo})
                          </span>
                        </div>
                        <span className="text-[9.5px] font-black text-purple-600 dark:text-purple-400">
                          +{c.fields.length} fields gained
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap pl-1">
                        {c.fields.map((f, fi) => (
                          <span key={fi} className="inline-flex items-center gap-1 text-[9.5px] bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 rounded text-purple-900 dark:text-purple-200">
                            <strong>{f.field}:</strong> <span className="font-semibold">{f.val}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  {filteredAuditCandidates.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      {scanPlan.harvestedDetails.length === 0 
                        ? 'Zero duplicate records or missing fields detected! Active admissions is already 100% enriched.' 
                        : 'No candidate students match your search filter.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Security Authorization & PIN */}
              <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <ShieldCheck size={16} className="text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-purple-950 dark:text-purple-200 block text-[11px]">
                      Administrative Confirmation (Security PIN Guarded)
                    </span>
                    <p className="text-[10px] font-bold text-purple-800 dark:text-purple-300 leading-tight">
                      Confirming will write the harvested fields directly into the corresponding active applications in <code className="font-mono">admissions</code> and purge the duplicate copies from <code className="font-mono">masterRegisters</code> so no redundant records remain.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[10.5px] font-black text-slate-700 dark:text-slate-300">Enter Security PIN:</span>
                    <input
                      type="password"
                      value={auditPinInput}
                      onChange={(e) => setAuditPinInput(e.target.value)}
                      placeholder="••••••"
                      maxLength={6}
                      className="w-28 p-1 rounded-md text-xs font-mono font-black border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-center tracking-widest"
                    />
                    {auditPinInput === '313313' && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <Check size={11} /> PIN Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Audit Modal Footer */}
            <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                disabled={isExecutingAudit}
                onClick={() => setIsAuditModalOpen(false)}
                className="px-3 py-1 rounded-lg text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer disabled:opacity-50"
              >
                Cancel / Do Not Apply
              </button>

              <button
                type="button"
                disabled={isExecutingAudit || auditPinInput.trim() !== '313313'}
                onClick={handleConfirmExecuteAudit}
                className="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-purple-700 hover:bg-purple-600 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isExecutingAudit ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Applying Harvest & Purging Duplicates...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Authorize Harvest & Purge Duplicates</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
