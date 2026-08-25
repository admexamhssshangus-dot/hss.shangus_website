// =================================================================
// HSS SHANGUS — Bulk TC / Discharge Certificate Generator Hub
// Multi-Class / Session Filtering, Sequential Numbering, Dual-Page Batch Exports
// =================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Award, Printer, Search,
  FileSpreadsheet, AlertCircle, RefreshCw, Database
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { unpackMasterRegisterStudents } from './OfficialDocumentsStudioView';
import {
  BUILTIN_CERTIFICATE_TEMPLATES,
  dobToWords,
  interpolateCertificateTemplate,
  printBatchStudentCertificates
} from '../../utils/certificateExportUtils';
import {
  normalizeResultStatus,
  calculateDivision,
  extractStudentResultMarks,
  extractStudentAdmissionNumber,
  extractStudentAdmissionDate
} from '../../utils/jkboseResultManager';
import {
  extractStudentName,
  extractFatherName,
  extractMotherName,
  extractClass,
  extractStream,
  extractSession,
  extractDob,
  extractGender,
  extractBoardRegNo,
  getStudentRollNumber,
  extractAdmNo,
  extractVillage,
  extractMobile
} from './CustomRosterDocumentBuilderView';
import * as XLSX from 'xlsx';

export default function BulkCertificateGeneratorModal({
  isOpen,
  onClose,
  allStudents = [],
  officeTitle = 'Office of the Principal',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'Anantnag Kmr. 192201',
  signatories = ['I/c Admissions', 'Checked By', 'Principal'],
  showToast = () => {}
}) {
  // ─── Real-Time Firestore Master Registers Pipeline (Zero LocalStorage) ───
  const [masterHistoricalRecords, setMasterHistoricalRecords] = useState([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingHistorical(true);
    let isMounted = true;

    const unsubscribe = onSnapshot(
      collection(db, 'masterRegisters'),
      (snapshot) => {
        if (!isMounted) return;
        const docs = [];
        snapshot.forEach((docSnap) => {
          docs.push({ id: docSnap.id, ...docSnap.data() });
        });
        const flatList = unpackMasterRegisterStudents(docs);
        setMasterHistoricalRecords(flatList);
        setIsLoadingHistorical(false);
      },
      (error) => {
        console.warn('masterRegisters snapshot error in Bulk TC Hub:', error);
        if (isMounted) setIsLoadingHistorical(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen]);

  // Combined real-time student pool: Preloaded Admissions + Live Master Registers
  const combinedStudentPool = useMemo(() => {
    const map = new Map();
    // 1. Unpacked historical master records (6,105 records across 22 sessions)
    masterHistoricalRecords.forEach(st => {
      if (st && st.id) map.set(st.id, st);
    });
    // 2. Active session admissions records (take precedence for active session)
    allStudents.forEach(st => {
      if (st) {
        const id = st.id || st.formNo || st['Form Number'] || st['Adm. No.'] || Math.random();
        map.set(id, st);
      }
    });
    return Array.from(map.values());
  }, [allStudents, masterHistoricalRecords]);

  // ─── Filter Controls State ───
  const [selectedClass, setSelectedClass] = useState('12th');
  const [selectedSession, setSelectedSession] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [selectedResultStatus, setSelectedResultStatus] = useState('ALL'); // 'ALL' | 'Passed' | 'Reap' | 'Failed' | 'hasResult'
  const [searchQuery, setSearchQuery] = useState('');
  
  // ─── Numbering & Date Controls State ───
  const [lastIssuedCertNo, setLastIssuedCertNo] = useState(1367);
  const [startCertNo, setStartCertNo] = useState(1368);
  const [issueDate, setIssueDate] = useState(() => new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
  const [withdrawalDateOverride, setWithdrawalDateOverride] = useState('14-01-2026');
  const [examSessionOverride, setExamSessionOverride] = useState('Annual Regular 2025 (Oct.-Nov.)');
  const [pageMargin, setPageMargin] = useState(0.3);

  const handleLastCertNoChange = (val) => {
    setLastIssuedCertNo(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setStartCertNo(parsed + 1);
    }
  };

  const handleStartCertNoChange = (val) => {
    setStartCertNo(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 1) {
      setLastIssuedCertNo(parsed - 1);
    }
  };
  
  // Auto-sync exam session title when session filter changes
  useEffect(() => {
    if (selectedSession && selectedSession !== 'ALL') {
      if (/bian|bi-annual|apr/i.test(selectedSession)) {
        setExamSessionOverride('Annual Private / Bi-Annual 2026');
      } else if (selectedSession === '2025-26') {
        setExamSessionOverride('Annual Regular 2025-26');
      } else {
        setExamSessionOverride(`Annual Regular ${selectedSession}`);
      }
    }
  }, [selectedSession]);

  // ─── Multi-Selection State ───
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Extract distinct Sessions scoped to current Class selection (e.g. Class 12th has 94 students)
  const availableSessions = useMemo(() => {
    const sessionMap = new Map();
    combinedStudentPool.forEach(st => {
      if (selectedClass && selectedClass !== 'ALL') {
        const c = extractClass(st);
        if (!c || !c.toLowerCase().includes(selectedClass.toLowerCase())) return;
      }
      const s = extractSession(st);
      if (s && s !== '—' && s.trim()) {
        sessionMap.set(s.trim(), (sessionMap.get(s.trim()) || 0) + 1);
      }
    });
    const sorted = Array.from(sessionMap.keys()).sort((a, b) => {
      return b.localeCompare(a, undefined, { numeric: true });
    });
    return sorted.map(s => ({
      value: s,
      label: `${s} (${sessionMap.get(s)} Students)`
    }));
  }, [combinedStudentPool, selectedClass]);

  // Extract distinct Classes from live combined student pool
  const availableClasses = useMemo(() => {
    const classMap = new Map();
    combinedStudentPool.forEach(st => {
      const c = extractClass(st);
      if (c && c !== '—' && c.trim()) {
        classMap.set(c.trim(), (classMap.get(c.trim()) || 0) + 1);
      }
    });
    const order = ['12th', '11th', '10th', '9th'];
    const sorted = Array.from(classMap.keys()).sort((a, b) => {
      const ia = order.findIndex(o => a.toLowerCase().includes(o));
      const ib = order.findIndex(o => b.toLowerCase().includes(o));
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return sorted.map(c => ({
      value: c,
      label: `Class ${c} (${classMap.get(c)})`
    }));
  }, [combinedStudentPool]);

  // Extract distinct Streams scoped to selected Class and Session
  const availableStreams = useMemo(() => {
    const streamMap = new Map();
    combinedStudentPool.forEach(st => {
      if (selectedClass && selectedClass !== 'ALL') {
        const c = extractClass(st);
        if (!c || !c.toLowerCase().includes(selectedClass.toLowerCase())) return;
      }
      if (selectedSession && selectedSession !== 'ALL') {
        const s = extractSession(st);
        if (!s || !s.toLowerCase().includes(selectedSession.toLowerCase())) return;
      }
      const s = extractStream(st);
      if (s && s !== '—' && s.trim()) {
        streamMap.set(s.trim(), (streamMap.get(s.trim()) || 0) + 1);
      }
    });
    const order = ['Medical', 'Non-Medical', 'Arts', 'Commerce', 'Humanities', 'Science', 'General'];
    const sorted = Array.from(streamMap.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return sorted.map(s => ({
      value: s,
      label: `${s} (${streamMap.get(s)})`
    }));
  }, [combinedStudentPool, selectedClass, selectedSession]);

  // Standardized student normalized rows from real-time pool
  const normalizedStudents = useMemo(() => {
    return combinedStudentPool.map(st => {
      const raw = st.raw || st;
      const id = st.id || st._id || raw.id || `${raw['Adm. No.'] || raw.formNo || Math.random()}`;
      const name = extractStudentName(st);
      const father = extractFatherName(st);
      const mother = extractMotherName(st);
      const cls = extractClass(st) || '12th';
      const stream = extractStream(st) || 'Medical';
      const session = extractSession(st) || '2025-26';
      const rollNo = getStudentRollNumber(st) || extractAdmNo(st) || '';
      const regNo = extractBoardRegNo(st) || '';
      const admNo = extractStudentAdmissionNumber(raw) || extractAdmNo(st) || rollNo || '—';
      const admDate = extractStudentAdmissionDate(raw) || '01-07-2024';
      const dobRaw = extractDob(st) || '2007-08-15';
      const gender = (extractGender(st) || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
      const village = extractVillage(st) || 'Shangus';
      const mobile = extractMobile(st) || '';

      // Exam Result fields
      const resInfo = extractStudentResultMarks(raw);
      const examRollNo = resInfo.examRoll || '—';
      const isPassed = resInfo.isPassed;
      const isReap = resInfo.isReap;
      const isFailed = resInfo.isFailed;
      const hasResult = resInfo.hasResult;
      const marksObtained = resInfo.marksObtained || '';
      const maxMarks = resInfo.maxMarks || '500';
      const division = resInfo.division || '';
      const reappSubjects = resInfo.reappSubjects || '';

      let resultStatus = 'Awaiting Result';
      if (isPassed) resultStatus = 'Passed';
      else if (isReap) resultStatus = 'Re-appear';
      else if (isFailed) resultStatus = 'Failed';

      return {
        id,
        raw,
        studentName: name,
        fatherName: father,
        motherName: mother,
        className: cls,
        stream,
        session,
        rollNo,
        regNo,
        admNo,
        admDate,
        dobRaw,
        gender,
        village,
        mobile,
        examRollNo,
        resultStatus,
        division,
        marksObtained,
        maxMarks,
        reappSubjects,
        hasResult,
        isPassed,
        isReap,
        isFailed
      };
    });
  }, [combinedStudentPool]);

  // Filtered students based on active dropdowns
  const filteredStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (selectedClass !== 'ALL') {
        const clsMatch = st.className.toLowerCase().includes(selectedClass.toLowerCase());
        if (!clsMatch) return false;
      }
      if (selectedSession !== 'ALL') {
        if (st.session !== selectedSession) return false;
      }
      if (selectedStream !== 'ALL') {
        if (!st.stream.toLowerCase().includes(selectedStream.toLowerCase())) return false;
      }
      if (selectedResultStatus === 'Passed') {
        if (st.resultStatus !== 'Passed') return false;
      } else if (selectedResultStatus === 'Reap') {
        if (st.resultStatus !== 'Re-appear') return false;
      } else if (selectedResultStatus === 'Failed') {
        if (st.resultStatus !== 'Failed') return false;
      } else if (selectedResultStatus === 'awaiting') {
        if (st.resultStatus !== 'Awaiting Result') return false;
      } else if (selectedResultStatus === 'hasResult') {
        if (!st.hasResult) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          st.studentName.toLowerCase().includes(q) ||
          st.fatherName.toLowerCase().includes(q) ||
          st.rollNo.toLowerCase().includes(q) ||
          st.regNo.toLowerCase().includes(q) ||
          st.admNo.toLowerCase().includes(q) ||
          st.examRollNo.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [normalizedStudents, selectedClass, selectedSession, selectedStream, selectedResultStatus, searchQuery]);

  // Pre-compute cert number map: O(n) single pass instead of O(n²) per-row
  const certNumberMap = useMemo(() => {
    const base = parseInt(startCertNo, 10) || 1368;
    const map = new Map();
    let seq = 0;
    filteredStudents.forEach((st, idx) => {
      if (selectedStudentIds.has(st.id)) {
        map.set(st.id, base + seq);
        seq++;
      } else {
        map.set(st.id, base + idx);
      }
    });
    return map;
  }, [filteredStudents, selectedStudentIds, startCertNo]);

  // Pre-compute result status counts in a single pass instead of 3x O(n) in render
  const resultStats = useMemo(() => {
    let passed = 0, reappear = 0, awaiting = 0;
    filteredStudents.forEach(s => {
      if (s.resultStatus === 'Passed') passed++;
      else if (s.resultStatus === 'Re-appear') reappear++;
      else if (s.resultStatus === 'Awaiting Result') awaiting++;
    });
    return { passed, reappear, awaiting };
  }, [filteredStudents]);

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size >= filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      const allIds = new Set(filteredStudents.map(s => s.id));
      setSelectedStudentIds(allIds);
    }
  };

  const handleToggleStudent = (id) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  // Compile batch student certificate packages with sequential numbering
  const compileBatchPackages = () => {
    const selectedList = filteredStudents.filter(s => selectedStudentIds.has(s.id));
    if (selectedList.length === 0) return [];

    let currentCertNum = parseInt(startCertNo, 10) || 1276;
    const qualifiedTpl = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === 'tc_dc_qualified') || BUILTIN_CERTIFICATE_TEMPLATES[0];
    const reappearTpl = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === 'tc_dc_reappear') || qualifiedTpl;

    return selectedList.map((st, idx) => {
      const certNo = String(currentCertNum + idx);
      const isPassed = st.resultStatus === 'Passed';
      const targetTpl = isPassed ? qualifiedTpl : reappearTpl;

      let dobWordsObj = { figures: st.dobRaw || '—', words: '—', standard: st.dobRaw || '—' };
      try {
        if (typeof dobToWords === 'function') {
          dobWordsObj = dobToWords(st.dobRaw) || dobWordsObj;
        }
      } catch (e) {
        console.warn('dobToWords execution error:', e);
      }

      const interpolatedHtml = interpolateCertificateTemplate(targetTpl.bodyHtml, {
        studentName: st.studentName,
        fatherName: st.fatherName,
        motherName: st.motherName,
        className: st.className,
        stream: st.stream,
        rollNo: st.rollNo,
        regNo: st.regNo,
        dobFigures: dobWordsObj.figures,
        dobWords: dobWordsObj.words,
        session: st.session,
        address: `${st.village}, Shangus, Anantnag (J&K)`,
        gender: st.gender,
        refNo: certNo,
        date: issueDate,
        examName: `Class ${st.className} Examination`,
        examRollNo: st.examRollNo || '—',
        examSession: examSessionOverride || st.session,
        resultStatus: isPassed ? 'Pass' : (st.isReap ? 'Re-appear' : (st.hasResult ? 'Did Not Qualify' : '—')),
        divisionDistinction: st.division || (isPassed ? 'Distinction' : '—'),
        marksObtained: st.marksObtained || (isPassed ? '—' : ''),
        maxMarks: st.maxMarks || '500',
        reappSubjects: st.reappSubjects || '',
        conductStatus: 'Satisfactory',
        admissionDate: st.admDate,
        admissionNo: st.admNo,
        withdrawalDate: withdrawalDateOverride,
        issueDate: issueDate
      });

      return {
        student: st,
        certNo,
        bodyHtml: interpolatedHtml,
        metaDetails: {
          certificateNo: certNo,
          admissionDate: st.admDate,
          admissionNo: st.admNo,
          regNo: st.regNo
        }
      };
    });
  };

  // ─── Action 1: Batch Print 2 Pages Per Student ───
  const handleBatchPrint = () => {
    const packages = compileBatchPackages();
    if (packages.length === 0) {
      showToast('Please select at least 1 student for bulk print.', 'warning');
      return;
    }

    showToast(`🖨️ Opening print stream for ${packages.length} certificates (${packages.length * 2} pages)...`, 'info');
    printBatchStudentCertificates(packages, {
      officeTitle,
      institutionName,
      institutionAddress,
      certificateTitle: 'Discharge/Transfer cum Character Certificate',
      dateStr: issueDate,
      signatories,
      watermark: true,
      showPhoto: false,
      pageMargin,
      headerGap: 0.50,
      titleMetaGap: 0,
      metaBodyGap: 0.50,
      paraSpacing: 8,
      bodyLineHeight: 1.85,
      bodyDateGap: 12,
      dateSigGap: 0.50,
      sigReceiptGap: 12
    });
  };

  // ─── Action 2: Export Registry Spreadsheet (.xlsx) ───
  const handleExportRegistryExcel = () => {
    const packages = compileBatchPackages();
    if (packages.length === 0) {
      showToast('Please select at least 1 student to export registry.', 'warning');
      return;
    }

    const rows = packages.map((pkg, idx) => ({
      'S.No': idx + 1,
      'Certificate No': pkg.certNo,
      'Student Name': pkg.student.studentName,
      'Father Name': pkg.student.fatherName,
      'Mother Name': pkg.student.motherName,
      'Class': pkg.student.className,
      'Stream': pkg.student.stream,
      'Session': pkg.student.session,
      'Board Reg No': pkg.student.regNo,
      'Adm No': pkg.student.admNo,
      'Adm Date': pkg.student.admDate,
      'Exam Roll No': pkg.student.examRollNo,
      'Result Status': pkg.student.resultStatus,
      'Division / Remarks': pkg.student.division || pkg.student.reappSubjects || '—',
      'Marks Obtained': `${pkg.student.marksObtained} / ${pkg.student.maxMarks}`,
      'Date of Birth': pkg.student.dobRaw,
      'Withdrawal Date': withdrawalDateOverride,
      'Issue Date': issueDate
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TC_DC_Issuance_Registry');
    XLSX.writeFile(wb, `HSS_Shangus_TC_DC_Registry_${selectedClass}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`📊 Exported issuance registry for ${packages.length} certificates!`, 'success');
  };

  if (!isOpen) return null;

  const totalFiltered = filteredStudents.length;
  const totalSelected = selectedStudentIds.size;
  const isAllSelected = totalSelected > 0 && totalSelected === totalFiltered;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden">
        
        {/* ════════ MODAL HEADER ════════ */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white flex items-center justify-between border-b border-teal-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300 shadow-inner shrink-0">
              <Award size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">Bulk TC / Discharge Certificate Hub</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Dual-Page Batch Engine
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800/90 text-slate-300 border border-slate-700/80 flex items-center gap-1">
                  {isLoadingHistorical ? (
                    <>
                      <RefreshCw size={9} className="animate-spin text-teal-400" />
                      <span>Syncing Realtime...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{combinedStudentPool.length} Live Records</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Multi-Class & Session Filtering • Auto Sequential Numbering • 2-Page Sequential Batch Prints
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ════════ CONTROLS & CONFIGURATION TOOLBAR ════════ */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          
          {/* Row 1: Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            
            {/* Class Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="12th">Class 12th</option>
                <option value="11th">Class 11th</option>
                <option value="10th">Class 10th</option>
                <option value="9th">Class 9th</option>
                <option value="ALL">All Classes</option>
                {availableClasses.filter(c => !['12th', '11th', '10th', '9th'].includes(c.value)).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Session Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">All Sessions ({combinedStudentPool.length})</option>
                {availableSessions.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Stream Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Stream</label>
              <select
                value={selectedStream}
                onChange={(e) => setSelectedStream(e.target.value)}
                className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">All Streams</option>
                {availableStreams.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Result Status Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Exam Result</label>
              <select
                value={selectedResultStatus}
                onChange={(e) => setSelectedResultStatus(e.target.value)}
                className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">All Students</option>
                <option value="Passed">Passed Only</option>
                <option value="Reap">Re-appear Only</option>
                <option value="Failed">Failed Only</option>
                <option value="awaiting">Awaiting Result / In-Course</option>
                <option value="hasResult">With Result Data</option>
              </select>
            </div>

            {/* Live Search */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Search</label>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Name, Reg, Roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-7 pr-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

          </div>

          {/* Row 2: Sequential Numbering & Batch Overrides */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/60 text-xs items-end">
            
            {/* Last Issued Cert No Input */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5" title="The last certificate number recorded in your physical register">
                Last Issued Cert No.
              </label>
              <input
                type="number"
                value={lastIssuedCertNo}
                onChange={(e) => handleLastCertNoChange(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-teal-500"
                placeholder="e.g. 1367"
              />
            </div>

            {/* Next Starting Cert No Input */}
            <div>
              <label className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider block mb-0.5" title="The certificate number to start assigning from for this batch">
                Next Starting No. →
              </label>
              <input
                type="number"
                value={startCertNo}
                onChange={(e) => handleStartCertNoChange(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-700 text-xs font-black text-rose-800 dark:text-rose-300 focus:ring-2 focus:ring-rose-500"
                placeholder="e.g. 1368"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Issue Date
              </label>
              <input
                type="text"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white"
                placeholder="DD-MM-YYYY"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Withdrawal / Result Date
              </label>
              <input
                type="text"
                value={withdrawalDateOverride}
                onChange={(e) => setWithdrawalDateOverride(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white"
                placeholder="14-01-2026"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Exam Session Title
              </label>
              <input
                type="text"
                value={examSessionOverride}
                onChange={(e) => setExamSessionOverride(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white"
                placeholder="Annual Regular 2025"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Page Margin
                </label>
                <span className="font-mono font-black text-[10px] text-teal-700 dark:text-teal-400">
                  {Number(pageMargin).toFixed(2)}"
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={pageMargin}
                onChange={(e) => setPageMargin(parseFloat(e.target.value))}
                className="w-full h-7 accent-teal-600 cursor-pointer"
                title="Adjust certificate page margins (0.1 inch to 0.5 inch, default 0.3 inch)"
              />
            </div>
          </div>

          {/* Sequential Range Info Banner */}
          {totalSelected > 0 && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-rose-100/70 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-[11px] font-bold animate-fadeIn">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                <span>Sequential Range:</span>
                <span className="font-mono font-black text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700">
                  #{startCertNo}
                </span>
                <span>to</span>
                <span className="font-mono font-black text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700">
                  #{(parseInt(startCertNo, 10) || 1368) + totalSelected - 1}
                </span>
              </span>
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                (Total <strong>{totalSelected}</strong> Sequential Certificates)
              </span>
            </div>
          )}

        </div>

        {/* ════════ SELECTION STATS & SELECTION BAR ════════ */}
        <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-850 flex items-center justify-between text-xs border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-white hover:bg-slate-50 cursor-pointer shadow-2xs text-[11px]"
            >
              {isAllSelected ? 'Deselect All' : `Select All (${totalFiltered})`}
            </button>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">
              Selected: <span className="text-teal-600 dark:text-teal-400 font-black">{totalSelected}</span> of {totalFiltered}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              {resultStats.passed} Passed
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              {resultStats.reappear} Re-appear
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              {resultStats.awaiting} Awaiting / In-Course
            </span>
          </div>
        </div>

        {/* ════════ STUDENTS DATA TABLE ════════ */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredStudents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <AlertCircle size={36} className="text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No students match current filter criteria.</p>
              <p className="text-xs text-slate-400 mt-0.5">Try changing class, session, or clearing search query.</p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2 w-10 text-center">S.No.</th>
                    <th className="p-2 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        className="rounded text-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="p-2 w-20 text-center">Cert No</th>
                    <th className="p-2">Student Name & Parentage</th>
                    <th className="p-2 w-24">Class & Stream</th>
                    <th className="p-2 w-28">Reg No / Adm No</th>
                    <th className="p-2 w-32">Exam Roll & Session</th>
                    <th className="p-2">Exam Result Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {filteredStudents.map((st, idx) => {
                    const isChecked = selectedStudentIds.has(st.id);
                    const calculatedCertNo = certNumberMap.get(st.id) || ((parseInt(startCertNo, 10) || 1368) + idx);

                    return (
                      <tr
                        key={st.id}
                        onClick={() => handleToggleStudent(st.id)}
                        className={`cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-50 dark:hover:bg-teal-950/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-2 text-center font-mono font-bold text-slate-500 dark:text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudent(st.id)}
                            className="rounded text-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-2 text-center font-mono">
                          {isChecked ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-black text-xs border border-rose-300 dark:border-rose-800">
                              #{calculatedCertNo}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold text-[11px]">
                              #{calculatedCertNo}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="font-extrabold text-slate-900 dark:text-white leading-tight">
                            {st.studentName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            S/o {st.fatherName} • M: {st.motherName}
                          </div>
                        </td>
                        <td className="p-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{st.className}</span>
                          <div className="text-[10px] text-slate-500">{st.stream}</div>
                        </td>
                        <td className="p-2 font-mono text-[10.5px]">
                          <div>{st.regNo || '—'}</div>
                          <div className="text-[9.5px] text-slate-400">Adm: {st.admNo}</div>
                        </td>
                        <td className="p-2 font-mono text-[10.5px]">
                          <div>{st.examRollNo && st.examRollNo !== '—' ? st.examRollNo : '—'}</div>
                          <div className="text-[9.5px] text-slate-400 truncate max-w-[120px]">{st.session}</div>
                        </td>
                        <td className="p-2">
                          {st.resultStatus === 'Passed' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 inline-flex items-center gap-1">
                              <span>✓ Pass ({st.division ? `${st.division} • ` : ''}{st.marksObtained ? `${st.marksObtained}/${st.maxMarks}` : 'Passed'})</span>
                            </span>
                          ) : st.resultStatus === 'Re-appear' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 inline-flex items-center gap-1">
                              <span>⚠ Reap ({st.reappSubjects || 'Re-appear'})</span>
                            </span>
                          ) : st.resultStatus === 'Failed' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 inline-flex items-center gap-1">
                              <span>✕ Failed</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              ⏳ Awaiting Result / In-Course
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ════════ BOTTOM ACTION BAR ════════ */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            💡 Each student certificate generates <strong>2 separate A4 portrait pages</strong> (Page 1: Student Copy, Page 2: Office Copy with red watermark & receipt slip).
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportRegistryExcel}
              disabled={totalSelected === 0}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Export Registry (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleBatchPrint}
              disabled={totalSelected === 0}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-98 text-white font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Printer size={15} />
              <span>Batch Print ({totalSelected} Selected)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
