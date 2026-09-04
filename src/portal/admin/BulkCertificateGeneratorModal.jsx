// =================================================================
// HSS SHANGUS — Bulk TC / Discharge Certificate Generator Hub
// Multi-Class / Session Filtering, Sequential Numbering, Dual-Page Batch Exports
// =================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Award, Printer, Search,
  FileSpreadsheet, AlertCircle, RefreshCw, CheckCircle2, Lock, Unlock, Edit3, Save
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { unpackMasterRegisterStudents } from './OfficialDocumentsStudioView';
import {
  fetchLastIssuedCertificateNumber,
  commitIssuedCertificateBatch,
  revokeCertificateNumberBatch,
  exportCertificateRegistryXlsx,
  extractCertificateSerial,
  persistCertificateStudentFields
} from '../../services/certificateRegistryService';
import {
  BUILTIN_CERTIFICATE_TEMPLATES,
  dobToWords,
  interpolateCertificateTemplate,
  printBatchStudentCertificates
} from '../../utils/certificateExportUtils';
import {
  extractStudentResultMarks,
  extractStudentAdmissionNumber,
  extractStudentAdmissionDate,
  extractStudentCertificateNumber
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
const sessionStartYear = (value) => {
  const match = String(value || '').match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

const sortIdentityRecordsByNearestSession = (records, targetSession) => {
  const targetYear = sessionStartYear(targetSession);
  return [...(records || [])].sort((a, b) => {
    const aYear = sessionStartYear(extractSession(a));
    const bYear = sessionStartYear(extractSession(b));
    const aDistance = targetYear !== null && aYear !== null ? Math.abs(targetYear - aYear) : Number.MAX_SAFE_INTEGER;
    const bDistance = targetYear !== null && bYear !== null ? Math.abs(targetYear - bYear) : Number.MAX_SAFE_INTEGER;
    if (aDistance !== bDistance) return aDistance - bDistance;
    return (bYear || 0) - (aYear || 0);
  });
};

const MAX_CERT_ASSIGNMENT_BATCH = 400;

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
  // ─── Real-Time Firestore Master Registers & Live Admissions Pipeline (Zero LocalStorage) ───
  const [masterHistoricalRecords, setMasterHistoricalRecords] = useState([]);
  const [liveAdmissionsRecords, setLiveAdmissionsRecords] = useState([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingHistorical(true);
    let isMounted = true;

    // 1. Listen to historical master registers
    const unsubMaster = onSnapshot(
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

    // 2. Listen to live admissions (for newly synchronized results & private candidates)
    const unsubAdmissions = onSnapshot(
      collection(db, 'admissions'),
      (snapshot) => {
        if (!isMounted) return;
        const docs = [];
        snapshot.forEach((docSnap) => {
          docs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setLiveAdmissionsRecords(docs);
      },
      (error) => {
        console.warn('admissions snapshot error in Bulk TC Hub:', error);
      }
    );

    return () => {
      isMounted = false;
      unsubMaster();
      unsubAdmissions();
    };
  }, [isOpen]);

  // Combined real-time student pool: Live Admissions (highest precedence) + Master Registers + Prop
  const combinedStudentPool = useMemo(() => {
    const map = new Map();

    const normalizeKey = (st) => {
      if (!st) return '';
      return String(
        st.id ||
        st.formNo ||
        st['Form Number'] ||
        st['Form No.'] ||
        st['Board Registration Number'] ||
        st['Board Reg. No.'] ||
        st.regNo ||
        st.boardRegNo ||
        ''
      ).toLowerCase().trim();
    };

    // 1. Unpacked historical master records
    masterHistoricalRecords.forEach(st => {
      const key = normalizeKey(st);
      if (key) map.set(key, st);
    });

    // 2. Passed prop students
    allStudents.forEach(st => {
      const key = normalizeKey(st);
      if (key) {
        const existing = map.get(key);
        map.set(key, existing ? { ...existing, ...st, raw: { ...(existing.raw || existing), ...(st.raw || st) } } : st);
      }
    });

    // 3. Live Firestore admissions records (contains latest synchronized result status & marks)
    liveAdmissionsRecords.forEach(st => {
      const key = normalizeKey(st);
      if (key) {
        const existing = map.get(key);
        map.set(key, existing ? { ...existing, ...st, raw: { ...(existing.raw || existing), ...(st.raw || st) } } : st);
      }
    });

    return Array.from(map.values());
  }, [allStudents, masterHistoricalRecords, liveAdmissionsRecords]);

  // Cross-session identity lookup. Result/session values remain attached to the
  // selected row; only stable identity fields are resolved from the same Board Reg No.
  const identityRecordsByReg = useMemo(() => {
    const index = new Map();
    [...masterHistoricalRecords, ...allStudents, ...liveAdmissionsRecords].forEach((record) => {
      const reg = String(extractBoardRegNo(record) || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (!reg || reg === '—') return;
      if (!index.has(reg)) index.set(reg, []);
      index.get(reg).push(record);
    });
    return index;
  }, [allStudents, masterHistoricalRecords, liveAdmissionsRecords]);

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
  const [isCommittingToDb, setIsCommittingToDb] = useState(false);
  const [isRevokingCertNo, setIsRevokingCertNo] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [isSavingFields, setIsSavingFields] = useState(false);

  // Auto-fetch highest issued Certificate Number from Firestore on modal open
  useEffect(() => {
    if (isOpen) {
      fetchLastIssuedCertificateNumber().then((lastNo) => {
        if (lastNo && !isNaN(lastNo) && lastNo > 0) {
          setLastIssuedCertNo(lastNo);
          setStartCertNo(lastNo + 1);
        }
      }).catch((err) => {
        console.warn('Failed to load last issued certificate number from Firestore:', err);
      });
    }
  }, [isOpen]);

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
      } else if (/^annual/i.test(selectedSession)) {
        setExamSessionOverride(selectedSession);
      } else if (selectedSession === '2025-26') {
        setExamSessionOverride('Annual Regular 2025-26');
      } else {
        setExamSessionOverride(`Annual Regular ${selectedSession}`);
      }
    }
  }, [selectedSession]);

  // ─── Multi-Selection State ───
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Extract distinct Sessions scoped to current Class selection
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
        const s = String(extractSession(st) || '').toLowerCase().trim();
        const target = selectedSession.toLowerCase().trim();
        const matchesSession = s === target || s.includes(target) || target.includes(s);
        if (!matchesSession) return false;
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
      const examMode = raw['Exam Mode (Current)'] || raw.currExamMode || raw.examMode || '';
      const session = extractSession(st) || '2025-26';
      const rollNo = getStudentRollNumber(st) || extractAdmNo(st) || '';
      const regNo = extractBoardRegNo(st) || '';
      const regKey = String(regNo || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const linkedRecords = sortIdentityRecordsByNearestSession(identityRecordsByReg.get(regKey) || [], session);
      const firstLinked = (extractor) => {
        for (const record of linkedRecords) {
          const value = extractor(record);
          if (value && value !== '—') return value;
        }
        return '';
      };
      const authoritativeIdentity = linkedRecords.find(record =>
        extractStudentAdmissionNumber(record) || extractStudentAdmissionDate(record) || extractDob(record) !== '—'
      );
      const certificateRaw = extractStudentCertificateNumber(raw) || firstLinked(extractStudentCertificateNumber);
      // Certificate serials are numeric. Never render result text such as
      // "Reap" as a locked certificate number when legacy columns are polluted.
      const certificateNo = extractCertificateSerial(certificateRaw);
      const admNo = extractStudentAdmissionNumber(raw) || firstLinked(extractStudentAdmissionNumber) || '—';
      const admDate = extractStudentAdmissionDate(raw) || firstLinked(extractStudentAdmissionDate) || '—';
      const dobRaw = (extractDob(st) !== '—' ? extractDob(st) : firstLinked(extractDob)) || '—';
      const resolvedGender = authoritativeIdentity ? extractGender(authoritativeIdentity) : (extractGender(st) !== '—' ? extractGender(st) : firstLinked(extractGender));
      const gender = String(resolvedGender || '').toUpperCase().startsWith('F')
        ? 'F'
        : (String(resolvedGender || '').toUpperCase().startsWith('M') ? 'M' : '');
      const village = (extractVillage(st) !== '—' ? extractVillage(st) : firstLinked(extractVillage)) || '—';
      const mobile = extractMobile(st) || '';

      // Exam Result fields
      const resInfo = extractStudentResultMarks(raw);
      const examRollNo = resInfo.examRoll || raw['Exam R.No. (Current)'] || raw.currExamRoll || raw.examRollNo || '—';
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

      const pendingFields = [];
      if (!regNo || regNo === '—') pendingFields.push('Registration No.');
      if (!admNo || admNo === '—') pendingFields.push('Admission No.');
      if (!admDate || admDate === '—') pendingFields.push('Admission Date');
      if (!dobRaw || dobRaw === '—') pendingFields.push('Date of Birth');
      if (!gender) pendingFields.push('Gender');
      if (!father || father === '—') pendingFields.push("Father's Name");
      if (!mother || mother === '—') pendingFields.push("Mother's Name");
      if (!village || village === '—') pendingFields.push('Village / Address');
      if (!examRollNo || examRollNo === '—') pendingFields.push('Exam Roll No.');
      if (!examMode) pendingFields.push('Exam Mode');
      if (!hasResult) pendingFields.push('Exam Result');
      if (isPassed && !marksObtained) pendingFields.push('Marks Obtained');
      if (isPassed && !division) pendingFields.push('Division');
      if (isReap && !reappSubjects) pendingFields.push('Re-appear Subjects');

      return {
        id,
        raw,
        studentName: name,
        fatherName: father,
        motherName: mother,
        className: cls,
        stream,
        session,
        examMode,
        rollNo,
        regNo,
        admNo,
        admDate,
        dobRaw,
        gender,
        village,
        mobile,
        certificateNo,
        pendingFields,
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
  }, [combinedStudentPool, identityRecordsByReg]);

  // Filtered students based on active dropdowns
  const filteredStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (selectedClass !== 'ALL') {
        const clsMatch = st.className.toLowerCase().includes(selectedClass.toLowerCase());
        if (!clsMatch) return false;
      }
      if (selectedSession !== 'ALL') {
        const s = String(st.session || '').toLowerCase().trim();
        const target = selectedSession.toLowerCase().trim();
        const matchesSession = s === target || s.includes(target) || target.includes(s);
        if (!matchesSession) return false;
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

      if (showPendingOnly && st.pendingFields.length === 0) return false;

      return true;
    });
  }, [normalizedStudents, selectedClass, selectedSession, selectedStream, selectedResultStatus, searchQuery, showPendingOnly]);

  // Pre-compute cert number map: strictly sequential for selected students, prospective for preview
  const certNumberMap = useMemo(() => {
    const base = parseInt(startCertNo, 10) || 1368;
    const map = new Map();
    let seq = 0;
    
    // If user has selectively checked students, number strictly the checked ones gaplessly
    if (selectedStudentIds.size > 0) {
      filteredStudents.forEach((st) => {
        if (st.certificateNo) {
          map.set(st.id, st.certificateNo);
        } else if (selectedStudentIds.has(st.id)) {
          map.set(st.id, base + seq);
          seq++;
        } else {
          map.set(st.id, '—');
        }
      });
    } else {
      // Preview mode: show prospective sequential numbers across all filtered students
      filteredStudents.forEach((st) => {
        if (st.certificateNo) map.set(st.id, st.certificateNo);
        else {
          map.set(st.id, base + seq);
          seq++;
        }
      });
    }
    return map;
  }, [filteredStudents, selectedStudentIds, startCertNo]);

  // Pre-compute result status counts in a single pass scoped to class & session
  const resultStats = useMemo(() => {
    let passed = 0, reappear = 0, awaiting = 0;
    normalizedStudents.forEach(st => {
      if (selectedClass !== 'ALL') {
        if (!st.className.toLowerCase().includes(selectedClass.toLowerCase())) return;
      }
      if (selectedSession !== 'ALL') {
        const s = String(st.session || '').toLowerCase().trim();
        const target = selectedSession.toLowerCase().trim();
        const matchesSession = s === target || s.includes(target) || target.includes(s);
        if (!matchesSession) return false;
      }
      if (st.resultStatus === 'Passed') passed++;
      else if (st.resultStatus === 'Re-appear') reappear++;
      else if (st.resultStatus === 'Awaiting Result') awaiting++;
    });
    return { passed, reappear, awaiting };
  }, [normalizedStudents, selectedClass, selectedSession]);

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
    const targetList = selectedStudentIds.size > 0
      ? filteredStudents.filter(s => selectedStudentIds.has(s.id))
      : filteredStudents;

    if (targetList.length === 0) return [];

    const baseCertNum = parseInt(startCertNo, 10) || 1368;
    const qualifiedTpl = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === 'tc_dc_qualified') || BUILTIN_CERTIFICATE_TEMPLATES[0];
    const reappearTpl = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === 'tc_dc_reappear') || qualifiedTpl;

    return targetList.map((st, idx) => {
      const assignedCertNo = String(st.certificateNo || certNumberMap.get(st.id) || (baseCertNum + idx));
      const isPassed = st.resultStatus === 'Passed';
      const targetTpl = isPassed ? qualifiedTpl : reappearTpl;

      let dobWordsObj = { figures: '----------------', words: '------------------------------------------------', standard: '----------------' };
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
        refNo: assignedCertNo,
        date: issueDate,
        examName: `Class ${st.className} Examination`,
        examRollNo: st.examRollNo || '',
        examSession: examSessionOverride || st.session,
        resultStatus: isPassed ? 'Pass' : (st.isReap ? 'Re-appear' : (st.hasResult ? 'Did Not Qualify' : '')),
        divisionDistinction: st.division || (isPassed ? 'Distinction' : ''),
        marksObtained: st.marksObtained || (isPassed ? '' : ''),
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
        id: st.id,
        formNo: st.raw?.formNo || st.raw?.['Form No.'] || st.id,
        certNo: assignedCertNo,
        isNewAssignment: !st.certificateNo,
        bodyHtml: interpolatedHtml,
        metaDetails: {
          certificateNo: assignedCertNo,
          admissionDate: st.admDate,
          admissionNo: st.admNo,
          regNo: st.regNo
        }
      };
    });
  };

  // Assign once in Firestore. Every subsequent print reuses the locked serial.
  const handleAssignCertificateNumbers = async () => {
    const packages = compileBatchPackages();
    if (packages.length === 0) {
      showToast('Please select at least 1 student.', 'warning');
      return;
    }
    const newAssignments = packages.filter(pkg => pkg.isNewAssignment);
    if (newAssignments.length === 0) {
      showToast('All selected students already have locked certificate numbers. You may print them again at any time.', 'info');
      return;
    }
    if (newAssignments.length > MAX_CERT_ASSIGNMENT_BATCH) {
      showToast(`Select at most ${MAX_CERT_ASSIGNMENT_BATCH} unissued students per assignment batch so the registry and student records remain one safe Firestore operation.`, 'warning');
      return;
    }

    const pendingCount = packages.filter(pkg => pkg.student?.pendingFields?.length > 0).length;

    setIsCommittingToDb(true);
    try {
      const commitRes = await commitIssuedCertificateBatch(newAssignments, issueDate);
      if (commitRes.success) {
        const msg = pendingCount > 0
          ? `Locked ${commitRes.count} certificate number(s). Missing fields (${pendingCount} students) will print with '-------' manual write-in blanks.`
          : `Locked ${commitRes.count} certificate number(s) permanently. Reprints will reuse the same numbers.`;
        showToast(msg, 'success');
        setLastIssuedCertNo(commitRes.lastIssuedCertNo);
        setStartCertNo(commitRes.lastIssuedCertNo + 1);
      }
    } catch (err) {
      console.error('Error assigning certificate numbers:', err);
      showToast(`Failed to assign certificate numbers: ${err.message}`, 'error');
    } finally {
      setIsCommittingToDb(false);
    }
  };

  // Revoke & Release Certificate Numbers for Selected Students (Batch Revocation)
  const handleRevokeCertificateNumbers = async () => {
    const targetStudents = selectedStudentIds.size > 0
      ? filteredStudents.filter(s => selectedStudentIds.has(s.id) && s.certificateNo)
      : filteredStudents.filter(s => s.certificateNo);

    if (targetStudents.length === 0) {
      showToast('No students with issued certificate numbers are selected for revocation.', 'warning');
      return;
    }

    const confirmMsg = `Are you sure you want to REVOKE and release the TC/DC Certificate Number(s) for ${targetStudents.length} student(s)?\n\nThis will clear their locked certificate numbers from both admissions and register records in Firestore, marking status as Revoked and allowing numbers to be reassigned.`;
    if (!window.confirm(confirmMsg)) return;

    setIsRevokingCertNo(true);
    try {
      const res = await revokeCertificateNumberBatch(targetStudents);
      if (res.success) {
        showToast(`Revoked certificate numbers for ${res.count} student(s) successfully.`, 'success');
        const nextSelected = new Set(selectedStudentIds);
        targetStudents.forEach(st => nextSelected.delete(st.id));
        setSelectedStudentIds(nextSelected);
      }
    } catch (err) {
      console.error('Error revoking certificate numbers:', err);
      showToast(`Failed to revoke certificate numbers: ${err.message}`, 'error');
    } finally {
      setIsRevokingCertNo(false);
    }
  };

  // Revoke & Release Certificate Number for a single student
  const handleRevokeSingleStudent = async (st, e) => {
    if (e) e.stopPropagation();
    if (!st.certificateNo) return;
    const confirmMsg = `Revoke TC/DC Certificate No. #${st.certificateNo} for ${st.studentName}?\n\nThis will clear the certificate number and mark status as Revoked.`;
    if (!window.confirm(confirmMsg)) return;

    setIsRevokingCertNo(true);
    try {
      const res = await revokeCertificateNumberBatch([st]);
      if (res.success) {
        showToast(`Revoked Certificate No. #${st.certificateNo} for ${st.studentName}.`, 'success');
      }
    } catch (err) {
      console.error('Error revoking certificate number:', err);
      showToast(`Failed to revoke certificate number: ${err.message}`, 'error');
    } finally {
      setIsRevokingCertNo(false);
    }
  };

  // ─── Print already-assigned certificates as often as required ───
  const handleBatchPrint = async () => {
    const packages = compileBatchPackages();
    if (packages.length === 0) {
      showToast('Please select at least 1 student for bulk print.', 'warning');
      return;
    }
    if (packages.some(pkg => pkg.isNewAssignment)) {
      showToast('Assign & Lock certificate numbers first. Printing never creates or changes a certificate number.', 'warning');
      return;
    }

    const pendingCount = packages.filter(pkg => pkg.student?.pendingFields?.length > 0).length;
    if (pendingCount > 0) {
      showToast(`🖨️ Printing ${packages.length} certificates (${pendingCount} with '-------' manual handwriting blanks)...`, 'info');
    } else {
      showToast(`🖨️ Opening print stream for ${packages.length} certificates (${packages.length * 2} pages)...`, 'info');
    }

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
    if (packages.some(pkg => pkg.isNewAssignment)) {
      showToast('Assign & Lock certificate numbers before exporting the official registry.', 'warning');
      return;
    }

    const studentsToExport = packages.map(pkg => ({
      ...pkg.student,
      certNo: pkg.certNo,
      issueDate: issueDate,
      withdrawalDate: withdrawalDateOverride
    }));

    exportCertificateRegistryXlsx(studentsToExport, `HSS_Shangus_TC_DC_Registry_${selectedClass}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`📊 Exported issuance registry for ${packages.length} certificates!`, 'success');
  };

  const openPendingFieldsEditor = (student) => {
    setEditingStudent(student);
    setEditValues({
      studentName: student.studentName === '—' ? '' : student.studentName,
      fatherName: student.fatherName === '—' ? '' : student.fatherName,
      motherName: student.motherName === '—' ? '' : student.motherName,
      regNo: student.regNo === '—' ? '' : student.regNo,
      admNo: student.admNo === '—' ? '' : student.admNo,
      admDate: student.admDate === '—' ? '' : student.admDate,
      dob: student.dobRaw === '—' ? '' : student.dobRaw,
      gender: student.gender || '',
      village: student.village === '—' ? '' : student.village,
      examRollNo: student.examRollNo === '—' ? '' : student.examRollNo,
      examMode: student.examMode || '',
      resultStatus: student.hasResult ? student.resultStatus : '',
      marksObtained: student.marksObtained || '',
      maxMarks: student.maxMarks || '500',
      division: student.division || '',
      reappSubjects: student.reappSubjects || ''
    });
  };

  const handleSavePendingFields = async () => {
    if (!editingStudent) return;
    setIsSavingFields(true);
    try {
      await persistCertificateStudentFields(editingStudent, editValues);
      showToast(`Saved certificate fields permanently for ${editingStudent.studentName}.`, 'success');
      setEditingStudent(null);
    } catch (error) {
      console.error('Failed to save certificate fields:', error);
      showToast(`Failed to save fields: ${error.message}`, 'error');
    } finally {
      setIsSavingFields(false);
    }
  };

  if (!isOpen) return null;

  const totalFiltered = filteredStudents.length;
  const totalSelected = selectedStudentIds.size;
  const isAllSelected = totalSelected > 0 && totalSelected === totalFiltered;
  const selectedRows = filteredStudents.filter(student => selectedStudentIds.has(student.id));
  const newSelectedCount = selectedRows.filter(student => !student.certificateNo).length;
  const selectedIssuedCount = selectedRows.filter(student => Boolean(student.certificateNo)).length;
  const sequentialEndNo = (parseInt(startCertNo, 10) || 1368) + Math.max(newSelectedCount - 1, 0);

  return createPortal(
    <>
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-[1280px] max-h-[94vh] sm:max-h-[90vh] shadow-2xl flex flex-col overflow-hidden my-auto">
        
        {/* ════════ MODAL HEADER ════════ */}
        <div className="p-3 sm:p-3.5 bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 text-white flex items-center justify-between gap-3 border-b border-teal-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300 shadow-inner shrink-0">
              <Award size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">Bulk TC / Discharge Certificate Hub</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Dual-Page Batch Engine
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800/90 border border-slate-600 flex items-center gap-1" style={{ color: '#cbd5e1' }}>
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
              <p className="text-[11px] font-medium mt-0.5 truncate" style={{ color: '#cbd5e1' }}>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[.78fr_.78fr_.82fr_1fr_1.35fr_.9fr] gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/60 text-xs items-end">
            
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
          {newSelectedCount > 0 && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-rose-100/70 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-[11px] font-bold animate-fadeIn">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                <span>Sequential Range:</span>
                <span className="font-mono font-black text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700">
                  #{startCertNo}
                </span>
                <span>to</span>
                <span className="font-mono font-black text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700">
                  #{sequentialEndNo}
                </span>
              </span>
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                (Assigning <strong>{newSelectedCount}</strong> new certificate{newSelectedCount === 1 ? '' : 's'}{totalSelected > newSelectedCount ? `; ${totalSelected - newSelectedCount} already locked` : ''})
              </span>
            </div>
          )}

        </div>

        {/* ════════ SELECTION STATS & SELECTION BAR ════════ */}
        <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => setShowPendingOnly(value => !value)}
              className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] cursor-pointer ${showPendingOnly ? 'bg-amber-500 text-white border-amber-600' : 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'}`}
            >
              {showPendingOnly ? 'Showing Pending Only' : 'Show Pending Fields'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
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
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
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
                    <th className="p-2 w-28 text-center">Pending / Edit</th>
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
                          {st.certificateNo ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] border border-indigo-200 dark:border-indigo-800">
                              <Lock size={9} />
                              <span>#{st.certificateNo}</span>
                              <button
                                type="button"
                                onClick={(e) => handleRevokeSingleStudent(st, e)}
                                title={`Revoke Certificate #${st.certificateNo} from this student`}
                                className="p-0.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded transition-colors cursor-pointer"
                              >
                                <Unlock size={9} />
                              </button>
                            </span>
                          ) : isChecked ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-black text-xs border border-rose-300 dark:border-rose-800 shadow-2xs">
                              #{calculatedCertNo}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-bold text-xs">
                              —
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-white leading-tight flex-wrap">
                            <span>{st.studentName}</span>
                            {st.certificateNo && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[9px] border border-emerald-300 dark:border-emerald-800 shrink-0">
                                <CheckCircle2 size={9} />
                                <span>Issued #{st.certificateNo}</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleRevokeSingleStudent(st, e)}
                                  title={`Revoke Certificate #${st.certificateNo}`}
                                  className="p-0.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded transition-colors cursor-pointer"
                                >
                                  <Unlock size={9} />
                                </button>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {st.gender === 'F' ? 'D/o' : 'S/o'} {st.fatherName} • M: {st.motherName}
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
                        <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openPendingFieldsEditor(st)}
                            title={st.pendingFields.length > 0 ? `Pending: ${st.pendingFields.join(', ')}` : 'Review or update certificate fields'}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-bold text-[9.5px] cursor-pointer ${st.pendingFields.length > 0 ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'}`}
                          >
                            <Edit3 size={10} />
                            {st.pendingFields.length > 0 ? `${st.pendingFields.length} Pending` : 'Complete'}
                          </button>
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
            💡 Assign numbers once, then reprint indefinitely with the same locked number. Each certificate generates <strong>2 A4 pages</strong>.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {selectedIssuedCount > 0 && (
              <button
                type="button"
                onClick={handleRevokeCertificateNumbers}
                disabled={isRevokingCertNo || isCommittingToDb}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                title="Revoke and release issued certificate numbers for selected students"
              >
                {isRevokingCertNo ? <RefreshCw size={14} className="animate-spin" /> : <Unlock size={13} />}
                <span>{isRevokingCertNo ? 'Revoking...' : `Revoke TC-DC No. (${selectedIssuedCount})`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAssignCertificateNumbers}
              disabled={totalFiltered === 0 || isCommittingToDb || isRevokingCertNo}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isCommittingToDb ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={13} />}
              <span>{isCommittingToDb ? 'Assigning...' : `Assign & Lock (${totalSelected || totalFiltered})`}</span>
            </button>

            <button
              type="button"
              onClick={handleExportRegistryExcel}
              disabled={totalFiltered === 0}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Export Registry (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleBatchPrint}
              disabled={totalFiltered === 0 || isCommittingToDb}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-98 text-white font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isCommittingToDb ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Locking in Firebase...</span>
                </>
              ) : (
                <>
                  <Printer size={15} />
                  <span>Batch Print ({totalSelected > 0 ? `${totalSelected} Selected` : `All ${totalFiltered}`})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
    {editingStudent && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between">
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Complete Certificate Fields</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{editingStudent.studentName} • Reg: {editingStudent.regNo || '—'} • Changes are saved permanently to Firestore.</p>
            </div>
            <button type="button" onClick={() => setEditingStudent(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17} /></button>
          </div>
          <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['studentName', "Student's Name"],
              ['fatherName', "Father's Name"],
              ['motherName', "Mother's Name"],
              ['regNo', 'Registration No.'],
              ['admNo', 'Admission No.'],
              ['admDate', 'Admission Date'],
              ['dob', 'Date of Birth'],
              ['village', 'Village / Address'],
              ['examRollNo', 'Exam Roll No.'],
              ['examMode', 'Exam Mode'],
              ['marksObtained', 'Marks Obtained'],
              ['maxMarks', 'Maximum Marks'],
              ['division', 'Division / Distinction'],
              ['reappSubjects', 'Re-appear Subjects']
            ].map(([key, label]) => (
              <label key={key} className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                <span className="flex items-center justify-between mb-1">
                  {label}
                  {editingStudent.pendingFields.some(field => field.toLowerCase().includes(label.replace('.', '').toLowerCase().split(' / ')[0])) && <span className="text-amber-600">Pending</span>}
                </span>
                <input
                  type="text"
                  value={editValues[key] || ''}
                  onChange={(e) => setEditValues(values => ({ ...values, [key]: e.target.value }))}
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-semibold normal-case text-slate-900 dark:text-white"
                />
              </label>
            ))}
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span className="block mb-1">Gender</span>
              <select value={editValues.gender || ''} onChange={(e) => setEditValues(values => ({ ...values, gender: e.target.value }))} className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-semibold normal-case text-slate-900 dark:text-white">
                <option value="">Select gender</option>
                <option value="Female (F)">Female</option>
                <option value="Male (M)">Male</option>
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span className="block mb-1">Exam Result</span>
              <select value={editValues.resultStatus || ''} onChange={(e) => setEditValues(values => ({ ...values, resultStatus: e.target.value }))} className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-semibold normal-case text-slate-900 dark:text-white">
                <option value="">Select result</option>
                <option value="Passed">Passed</option>
                <option value="Reap">Re-appear</option>
                <option value="Failed">Failed</option>
                <option value="Awaiting Result">Awaiting Result / In-Course</option>
              </select>
            </label>
          </div>
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
            <button type="button" onClick={() => setEditingStudent(null)} disabled={isSavingFields} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-xs">Cancel</button>
            <button type="button" onClick={handleSavePendingFields} disabled={isSavingFields} className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 disabled:opacity-50">
              {isSavingFields ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Save Permanently
            </button>
          </div>
        </div>
      </div>
    )}
    </>,
    document.body
  );
}
