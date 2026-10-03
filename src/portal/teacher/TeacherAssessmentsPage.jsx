import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, RefreshCw, AlertCircle, CheckCircle2,
  Printer, ShieldCheck, History, Clock, Search, Save, Send,
  ChevronDown, X, Info, Sparkles, Award, AlertTriangle, FileText, Check,
  SlidersHorizontal, Zap
} from 'lucide-react';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, doc as fsDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getCachedCollection, invalidateCollectionCache, getMasterRegistersScoped } from '../../services/dbCache';
import { saveAcademicRecord } from '../../services/academicRecordService';
import { logTeacherActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';
import ConfirmModal from '../components/ConfirmModal';
import { sanitizeForFirestore } from '../../utils/firestoreSanitizer';
import { printIndividualAwardRoll, printHistoricalSubmission, isSubmissionOwnedByTeacher } from '../../utils/practicalsPdfGenerator';
import {
  getSchoolEvaluationTypesForTeacher,
  getSubjectOverride,
  isTeacherSubjectMatch,
  normalizeSubjectIdentity,
  formatPracticalDocId,
  getTeacherAssignedSubjectsForClass,
  isSchoolAssessmentType
} from '../../utils/practicalsSettingsManager';
import {
  isClassMatch,
  getSessionEndYear,
  isSessionMatch,
  isSubjectOrStreamMatch,
  extractStudentClass,
  hasAssignedClassRoll,
  getStudentName,
  getRegNo,
  getExamRoll,
  extractRawAdmNo,
  extractRawSubjectsString,
  getAbbreviatedSubjects,
  numberToWords,
  renderSubjectsWithHighlight,
  SECONDARY_7_SUBJECTS,
  HIGHER_SECONDARY_15_SUBJECTS
} from './PracticalsPage';

const CURRENT_SESSION = '2025-26';
const AVAILABLE_CLASSES = ['9th', '10th', '11th', '12th'];

export default function TeacherAssessmentsPage() {
  const { user } = useOutletContext();
  const location = useLocation();

  // Teacher Profile info
  const userName = user?.displayName || user?.name || 'Teacher';
  const userEmail = user?.email || auth.currentUser?.email || '';

  // Class Selection state
  const teacherAssignedClasses = useMemo(() => {
    return Array.isArray(user?.assignedClasses) ? user.assignedClasses : [];
  }, [user]);

  const [selectedClass, setSelectedClass] = useState(() => {
    if (location.state?.selectedClass) return location.state.selectedClass;
    if (teacherAssignedClasses.length > 0) {
      const raw = String(teacherAssignedClasses[0]);
      if (raw.includes('12')) return '12th';
      if (raw.includes('11')) return '11th';
      if (raw.includes('10')) return '10th';
      if (raw.includes('9')) return '9th';
    }
    return '11th';
  });

  const userHasSelectedClassRef = useRef(Boolean(location.state?.selectedClass));

  // Default class to teacher's first assigned class once on initial profile load (if not navigating from state)
  useEffect(() => {
    if (userHasSelectedClassRef.current || location.state?.selectedClass) return;
    if (teacherAssignedClasses.length > 0) {
      const raw = String(teacherAssignedClasses[0] || '');
      const clean = raw.includes('11') ? '11th' : (raw.includes('12') ? '12th' : (raw.includes('10') ? '10th' : (raw.includes('9') ? '9th' : '11th')));
      setSelectedClass(clean);
    }
  }, [teacherAssignedClasses, location.state?.selectedClass]);

  const [selectedSession, setSelectedSession] = useState(location.state?.yearSuffix || CURRENT_SESSION);
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION, '2024-25', '2023-24']);

  // Roster Scope: 'stream' (Subject/Stream only) vs 'all_class' (All Class Students)
  const [rosterScope, setRosterScope] = useState('stream');

  // Sorting & Filtering State
  const [sortBy, setSortBy] = useState('rollAsc'); // 'rollAsc' | 'rollDesc' | 'nameAsc' | 'formAsc'
  const [searchTerm, setSearchTerm] = useState('');
  const [showFailOnly, setShowFailOnly] = useState(false);
  const [showFilterSettings, setShowFilterSettings] = useState(true);

  // Bulk Selection & Quick Fill
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [quickFillMark, setQuickFillMark] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);

  // Subjects for selected class
  const displaySubjects = useMemo(() => {
    return (selectedClass === '9th' || selectedClass === '10th')
      ? SECONDARY_7_SUBJECTS
      : HIGHER_SECONDARY_15_SUBJECTS;
  }, [selectedClass]);

  // All teacher assigned subjects across entire profile
  const allTeacherAssignedSubjects = useMemo(() => {
    if (Array.isArray(user?.assignedSubjects) && user.assignedSubjects.length > 0) {
      return user.assignedSubjects.map(s => typeof s === 'string' ? s : (s?.subject || '')).filter(Boolean);
    }
    const rawSubj = user?.subject || user?.teachingSubject || '';
    if (!rawSubj) return [];
    return String(rawSubj).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  }, [user?.assignedSubjects, user?.subject, user?.teachingSubject]);

  // Class-specific assigned subjects for currently selected class
  const teacherClassAssignedSubjects = useMemo(() => {
    const assigned = getTeacherAssignedSubjectsForClass(user, selectedClass);
    if (assigned && assigned.length > 0) return assigned;
    // Fallback: match allTeacherAssignedSubjects against current curriculum
    const isSecondary = selectedClass === '9th' || selectedClass === '10th';
    const targetList = isSecondary ? SECONDARY_7_SUBJECTS : HIGHER_SECONDARY_15_SUBJECTS;
    const matched = allTeacherAssignedSubjects.filter(sub =>
      targetList.some(t => isTeacherSubjectMatch(sub, t.name) || isTeacherSubjectMatch(sub, t.code))
    );
    if (matched.length > 0) return matched;
    return [];
  }, [user, selectedClass, allTeacherAssignedSubjects]);

  // Overall primary teacher registered subject string
  const teacherRegisteredSubject = useMemo(() => {
    if (teacherClassAssignedSubjects.length > 0) {
      return teacherClassAssignedSubjects.join(', ');
    }
    if (allTeacherAssignedSubjects.length > 0) {
      return allTeacherAssignedSubjects.join(', ');
    }
    const rawSubj = user?.subject || user?.teachingSubject || '';
    if (!rawSubj) return '';
    const norm = normalizeSubjectIdentity(rawSubj);
    return norm ? norm.name : String(rawSubj).trim();
  }, [teacherClassAssignedSubjects, allTeacherAssignedSubjects, user?.subject, user?.teachingSubject]);

  const [selectedSubject, setSelectedSubject] = useState(() => {
    if (location.state?.selectedSubject) return location.state.selectedSubject;
    if (teacherClassAssignedSubjects.length > 0) {
      const match = displaySubjects.find(s => isTeacherSubjectMatch(teacherClassAssignedSubjects[0], s.name) || isTeacherSubjectMatch(teacherClassAssignedSubjects[0], s.code));
      if (match) return match.name;
    }
    return displaySubjects[0]?.name || 'General English';
  });

  const userHasManuallySelectedSubjectRef = useRef(Boolean(location.state?.selectedSubject));

  // Automatically default & synchronize selectedSubject to teacher's assigned subject whenever user hydrates or class changes
  useEffect(() => {
    // If navigation state supplied a subject and user hasn't explicitly selected one yet, keep navigation state
    if (location.state?.selectedSubject && !userHasManuallySelectedSubjectRef.current) {
      return;
    }

    let assignedMatch = null;
    if (teacherClassAssignedSubjects.length > 0) {
      for (const sub of teacherClassAssignedSubjects) {
        const sNorm = normalizeSubjectIdentity(sub);
        const exactMatch = displaySubjects.find(m => {
          const mNorm = normalizeSubjectIdentity(m.code || m.name);
          return mNorm && sNorm && mNorm.code === sNorm.code;
        });
        if (exactMatch) {
          assignedMatch = exactMatch.name;
          break;
        }
        const match = displaySubjects.find(s => isTeacherSubjectMatch(sub, s.name) || isTeacherSubjectMatch(sub, s.code));
        if (match) {
          assignedMatch = match.name;
          break;
        }
      }
    }
    if (!assignedMatch && allTeacherAssignedSubjects.length > 0) {
      for (const sub of allTeacherAssignedSubjects) {
        const sNorm = normalizeSubjectIdentity(sub);
        const exactMatch = displaySubjects.find(m => {
          const mNorm = normalizeSubjectIdentity(m.code || m.name);
          return mNorm && sNorm && mNorm.code === sNorm.code;
        });
        if (exactMatch) {
          assignedMatch = exactMatch.name;
          break;
        }
        const match = displaySubjects.find(s => isTeacherSubjectMatch(sub, s.name) || isTeacherSubjectMatch(sub, s.code));
        if (match) {
          assignedMatch = match.name;
          break;
        }
      }
    }

    const isCurrentInDisplay = displaySubjects.some(s => s.name.toLowerCase() === String(selectedSubject || '').toLowerCase());

    if (assignedMatch && (!userHasManuallySelectedSubjectRef.current || !isCurrentInDisplay)) {
      setSelectedSubject(assignedMatch);
    } else if (!isCurrentInDisplay) {
      setSelectedSubject(displaySubjects[0]?.name || 'General English');
    }
  }, [user, selectedClass, teacherClassAssignedSubjects, allTeacherAssignedSubjects, displaySubjects]);

  // Is current subject officially assigned to this teacher?
  const isCurrentSubjectAssigned = useMemo(() => {
    if (!selectedSubject) return false;
    if (teacherClassAssignedSubjects.length > 0) {
      return teacherClassAssignedSubjects.some(s => isTeacherSubjectMatch(s, selectedSubject));
    }
    if (allTeacherAssignedSubjects.length > 0) {
      return allTeacherAssignedSubjects.some(s => isTeacherSubjectMatch(s, selectedSubject));
    }
    return false;
  }, [selectedSubject, teacherClassAssignedSubjects, allTeacherAssignedSubjects]);

  // Partitioned subject options (assigned vs other subjects)
  const { assignedSubjectOptions, otherSubjectOptions } = useMemo(() => {
    const assigned = [];
    const others = [];
    displaySubjects.forEach(sub => {
      const isAssigned = (teacherClassAssignedSubjects.length > 0
        ? teacherClassAssignedSubjects.some(s => isTeacherSubjectMatch(s, sub.name) || isTeacherSubjectMatch(s, sub.code))
        : allTeacherAssignedSubjects.some(s => isTeacherSubjectMatch(s, sub.name) || isTeacherSubjectMatch(s, sub.code))
      );
      if (isAssigned) {
        assigned.push(sub);
      } else {
        others.push(sub);
      }
    });
    return { assignedSubjectOptions: assigned, otherSubjectOptions: others };
  }, [displaySubjects, teacherClassAssignedSubjects, allTeacherAssignedSubjects]);

  // Settings
  const [evalSettings, setEvalSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(fsDoc(db, 'adminPracticalsSettings', 'config')).catch(() => null);
        if (snap && snap.exists()) {
          setEvalSettings(snap.data());
        }
      } catch (e) {
        console.warn('Failed to load assessment settings:', e);
      }
    };
    fetchSettings();
  }, []);

  // Available Evaluation Types (Pre-Board, Golden Test, Unit Test, etc.)
  const availableEvalTypes = useMemo(() => {
    return getSchoolEvaluationTypesForTeacher(evalSettings, selectedClass, selectedSession);
  }, [evalSettings, selectedClass, selectedSession]);

  const [evaluationType, setEvaluationType] = useState(() => {
    return location.state?.practicalType || location.state?.evaluationType || 'Pre-Board Test';
  });

  // Ensure evaluationType is valid
  useEffect(() => {
    if (availableEvalTypes.length > 0 && !availableEvalTypes.some(e => e.value === evaluationType)) {
      setEvaluationType(availableEvalTypes[0].value);
    }
  }, [availableEvalTypes, evaluationType]);

  // Active Subject & Config Resolution
  const currentSubjectObj = useMemo(() => {
    return displaySubjects.find(s => s.name.toLowerCase() === selectedSubject.toLowerCase() || s.code.toLowerCase() === selectedSubject.toLowerCase()) ||
      displaySubjects[0] ||
      { code: 'EN', name: 'General English', defaultMax: 50 };
  }, [displaySubjects, selectedSubject]);

  const activeEvalOption = availableEvalTypes.find(e => e.value === evaluationType);
  const activeEvalConfig = activeEvalOption?.evalConfig;

  // Max marks & pass marks calculation
  const subjectOverride = getSubjectOverride(activeEvalConfig?.subjectOverrides, currentSubjectObj.code, selectedClass);
  const maxMarks = subjectOverride?.maxMarks
    ? Number(subjectOverride.maxMarks)
    : (activeEvalConfig?.maxMarks ? Number(activeEvalConfig.maxMarks) : currentSubjectObj.defaultMax || 50);
  const minMarks = subjectOverride?.minMarks
    ? Number(subjectOverride.minMarks)
    : (activeEvalConfig?.minMarks ? Number(activeEvalConfig.minMarks) : Math.ceil(maxMarks * 0.36));

  // Student Roster & Marks
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingRecord, setExistingRecord] = useState(null); // Loaded canonical or pending doc
  const [submissionStatus, setSubmissionStatus] = useState('unsubmitted'); // 'unsubmitted' | 'draft' | 'pending' | 'approved' | 'rejected'

  // Submissions Log Drawer
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    badgeText: '',
    confirmText: '',
    confirmBtnStyle: 'success',
    icon: CheckCircle2,
    onConfirm: () => {}
  });

  // Target canonical document ID
  const canonicalDocId = useMemo(() => {
    return formatPracticalDocId(selectedClass, currentSubjectObj.name, evaluationType, selectedSession);
  }, [selectedClass, currentSubjectObj.name, evaluationType, selectedSession]);

  const pendingDocId = `pending_${canonicalDocId}`;

  // Unique key helper for student selection
  const getStudentKey = useCallback((st) => {
    return String(st.classRollNo || st.rollNo || st.regNo || st.formNo || st.id || st.studentName || st.name);
  }, []);

  // Fetch Student Roster & Existing Marks using Dual-Source Loader (masterRegisters + admissions)
  const fetchRosterData = useCallback(async () => {
    setLoading(true);
    setSelectedKeys(new Set());
    try {
      // 1. Fetch live or pending marks from practicalsData
      let loadedDoc = null;
      let status = 'unsubmitted';

      const [pendingSnap, canonicalSnap, masterRes, admRes] = await Promise.all([
        getDoc(fsDoc(db, 'practicalsData', pendingDocId)).catch(() => null),
        getDoc(fsDoc(db, 'practicalsData', canonicalDocId)).catch(() => null),
        getMasterRegistersScoped({ forceAll: false }).catch(() => []),
        getCachedCollection('admissions', false, 15 * 60 * 1000).catch(() => [])
      ]);

      if (pendingSnap && pendingSnap.exists()) {
        loadedDoc = { id: pendingSnap.id, ...pendingSnap.data() };
        if (loadedDoc.status === 'rejected') status = 'rejected';
        else if (loadedDoc.status === 'draft' || loadedDoc.isDraft) status = 'draft';
        else status = 'pending';
      } else if (canonicalSnap && canonicalSnap.exists()) {
        loadedDoc = { id: canonicalSnap.id, ...canonicalSnap.data() };
        status = 'approved';
      }

      setExistingRecord(loadedDoc);
      setSubmissionStatus(status);

      // Build saved marks lookup from loadedDoc
      const savedMarksMap = {};
      if (loadedDoc && Array.isArray(loadedDoc.records)) {
        loadedDoc.records.forEach(r => {
          const rRoll = String(r.rollNo || r.classRollNo || '').trim();
          const rBoard = String(r.boardRollNo || r.boardRoll || r.examRollNo || '').trim();
          const rForm = String(r.formNo || '').trim();
          const rName = String(r.name || r.studentName || '').toLowerCase().trim();
          const rReg = String(r.regNo || r.boardRegNo || r.registrationNo || '').trim();

          const recObj = {
            rollNo: rRoll || rBoard,
            classRollNo: rRoll || rBoard,
            boardRoll: rBoard,
            regNo: rReg,
            name: r.name || r.studentName,
            fatherName: r.fatherName || r.parentName || '',
            formNo: rForm || rRoll,
            marks: r.marks !== undefined && r.marks !== null ? String(r.marks) : (r.practicalMarks !== undefined ? String(r.practicalMarks) : ''),
            isAbsent: r.isAbsent || r.marks === 'AB' || r.practicalMarks === 'AB'
          };

          if (rRoll) savedMarksMap[rRoll] = recObj;
          if (rBoard) savedMarksMap[rBoard] = recObj;
          if (rForm) savedMarksMap[rForm] = recObj;
          if (rName) savedMarksMap[rName] = recObj;
          if (rReg) {
            const cleanRReg = rReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (cleanRReg.length >= 8) savedMarksMap['reg_' + cleanRReg] = recObj;
          }
        });
      }

      let allCandidates = [];

      // A. Master Registers
      const masterDocs = Array.isArray(masterRes) ? masterRes : [];
      masterDocs.forEach(d => {
        const items = d.items || d.data || d.records;
        const docSession = d.Session || d.session || d.groupKey?.split('_')[0] || d.id?.split('_')[0] || '';
        const docClass = d.class || d.Class || d.groupKey?.split('_')[1] || '';

        if (Array.isArray(items)) {
          items.forEach(it => {
            allCandidates.push({
              ...it,
              session: it.Session || it.session || docSession,
              class: it.class || it.Class || it['Class'] || docClass
            });
          });
        } else {
          allCandidates.push({
            ...d,
            session: d.Session || d.session || docSession,
            class: d.class || d.Class || d['Class'] || docClass
          });
        }
      });

      // B. Admissions
      const admDocs = Array.isArray(admRes) ? admRes : [];
      admDocs.forEach(d => {
        const items = d.items || d.students || d.records;
        const docSession = d.Session || d.session || CURRENT_SESSION;
        const docClass = d.class || d.Class || d['Admission sought for class'] || '';

        if (Array.isArray(items)) {
          items.forEach(it => {
            allCandidates.push({
              ...it,
              session: it.Session || it.session || docSession,
              class: it['Admission sought for class'] || it['Class for which Admission Sought'] || it['Class Enrolled'] || it.className || it.class || it.Class || it['Class'] || docClass
            });
          });
        } else {
          allCandidates.push({
            ...d,
            session: d.Session || d.session || docSession,
            class: d['Admission sought for class'] || d['Class for which Admission Sought'] || d['Class Enrolled'] || d.className || d.class || d.Class || docClass
          });
        }
      });

      // C. Build Rich Index Maps for Multi-Key Matching
      const richByReg = new Map();
      const richByForm = new Map();
      const richByRoll = new Map();
      const richByBoard = new Map();
      const richByAdm = new Map();
      const richByName = new Map();

      const indexRichItem = (it) => {
        if (!it) return;
        const itClass = extractStudentClass(it);
        const isMatchCls = isClassMatch(itClass, selectedClass);

        const setIfBetter = (map, key, item) => {
          if (!key || key === '—' || key === 'N/A' || key === '#N/A') return;
          const existing = map.get(key);
          if (!existing) {
            map.set(key, item);
          } else {
            const existingCls = extractStudentClass(existing);
            const existingMatches = isClassMatch(existingCls, selectedClass);
            if (!existingMatches && isMatchCls) {
              map.set(key, item);
            }
          }
        };

        const rReg = getRegNo(it);
        if (rReg) {
          const cleanFull = rReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (cleanFull.length >= 8) setIfBetter(richByReg, cleanFull, it);
          setIfBetter(richByReg, rReg.trim().toUpperCase(), it);
        }

        const rForm = String(it.formNo || it['Form No.'] || it['Form Number'] || it.FormNo || '').trim();
        setIfBetter(richByForm, rForm, it);

        const rRoll = String(it.classRollNo || it.rollNo || it['Class Roll No'] || it['Roll No'] || '').trim();
        if (isMatchCls) setIfBetter(richByRoll, rRoll, it);

        const rExamRoll = getExamRoll(it, selectedClass);
        if (rExamRoll) setIfBetter(richByBoard, rExamRoll, it);

        const rAdm = extractRawAdmNo(it);
        setIfBetter(richByAdm, rAdm, it);

        const rName = getStudentName(it).toLowerCase().trim();
        if (rName && rName !== 'student') setIfBetter(richByName, rName, it);
      };

      allCandidates.forEach(it => indexRichItem(it));

      // D. Filter Candidates Strictly by Class + Session + Subject + Assigned Class Roll
      const isSecondaryClass = selectedClass === '9th' || selectedClass === '10th' || selectedClass === '9' || selectedClass === '10';
      const targetSubjCode = currentSubjectObj.code;
      const targetSubjName = currentSubjectObj.name;

      let allDiscoveredStudents = [];

      allCandidates.forEach(st => {
        const stClass = extractStudentClass(st);
        const stSession = st.session || st.Session || st['Academic Session'];

        const matchSubjOrAll = isSecondaryClass || rosterScope === 'all_class' || isSubjectOrStreamMatch(st, targetSubjCode, targetSubjName);

        if (
          hasAssignedClassRoll(st) &&
          isClassMatch(stClass, selectedClass) &&
          isSessionMatch(stSession, selectedSession) &&
          matchSubjOrAll
        ) {
          const rRoll = String(
            st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st['Class R.No'] ||
            st['Class R. No.'] || st.classRollNo || st.rollNo || ''
          ).trim();
          const rName = getStudentName(st);
          const rForm = st.formNo || st['Form No.'] || st['Form Number'] || '';
          const rReg = getRegNo(st);
          const rExamRoll = getExamRoll(st, selectedClass);

          // Check if marks exist in savedMarksMap
          let existingMarks = '';
          let existingAb = false;

          let rec = null;
          if (rRoll && savedMarksMap[rRoll]) rec = savedMarksMap[rRoll];
          else if (rForm && savedMarksMap[rForm]) rec = savedMarksMap[rForm];
          else if (rExamRoll && savedMarksMap[rExamRoll]) rec = savedMarksMap[rExamRoll];
          else if (rReg) {
            const cleanReg = rReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (savedMarksMap['reg_' + cleanReg]) rec = savedMarksMap['reg_' + cleanReg];
          }
          if (!rec && rName && savedMarksMap[rName.toLowerCase().trim()]) {
            rec = savedMarksMap[rName.toLowerCase().trim()];
          }

          if (rec) {
            existingMarks = rec.marks !== undefined ? rec.marks : '';
            existingAb = rec.isAbsent || existingMarks === 'AB';
            if (existingAb) existingMarks = 'AB';
          }

          allDiscoveredStudents.push({
            ...st,
            id: st.id || `st_${rRoll}_${rForm}`,
            rollNo: rRoll,
            classRollNo: rRoll,
            name: rName,
            studentName: rName,
            fatherName: st["Father's Name"] || st['Father Name'] || st.fatherName || st.parentage || '',
            formNo: rForm,
            regNo: rReg,
            examRollNo: rExamRoll,
            rawSubjects: extractRawSubjectsString(st, selectedClass) || st.subjects || '',
            subjects: extractRawSubjectsString(st, selectedClass) || st['Subs'] || st.subjects || st['Subjects'] || currentSubjectObj.name,
            subjectsAbbr: getAbbreviatedSubjects(st, selectedClass) || currentSubjectObj.name,
            marks: existingMarks,
            isAbsent: existingAb
          });
        }
      });

      // E. Deduplicate students using composite key to prevent cross-class/session collisions
      const uniqueMap = new Map();
      allDiscoveredStudents.forEach(st => {
        if (!hasAssignedClassRoll(st)) return;
        const stCls = extractStudentClass(st) || selectedClass;
        const clsDigits = String(stCls).replace(/\D/g, '') || String(selectedClass).replace(/\D/g, '');
        const sesScope = getSessionEndYear(String(st.session || st.Session || selectedSession || '')) || selectedSession;
        const rollKey = String(st.rollNo || '').trim();

        let key;
        if (rollKey) {
          key = `${clsDigits}_${sesScope}_roll_${rollKey.toLowerCase()}`;
        } else {
          const regId = getRegNo(st) || st.formNo || '';
          key = regId
            ? `${clsDigits}_${sesScope}_reg_${regId.toLowerCase().trim()}`
            : `${clsDigits}_${sesScope}_name_${getStudentName(st).toLowerCase().trim()}`;
        }

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, st);
        } else {
          const prev = uniqueMap.get(key);
          const hasPrevMarks = prev.marks !== '' && prev.marks !== undefined;
          const hasNewMarks = st.marks !== '' && st.marks !== undefined;
          if (!hasPrevMarks && hasNewMarks) {
            uniqueMap.set(key, { ...prev, ...st });
          }
        }
      });

      const uniqueRoster = Array.from(uniqueMap.values());
      setStudents(uniqueRoster);
    } catch (err) {
      console.error('Failed to load roster:', err);
      showToast('Failed to load student roster', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, currentSubjectObj.name, currentSubjectObj.code, evaluationType, selectedSession, rosterScope, pendingDocId, canonicalDocId]);

  useEffect(() => {
    fetchRosterData();
  }, [fetchRosterData]);

  // Real-time Targeted Firestore Sync for School-Based Assessment Award (Pending & Canonical)
  // Strictly listens ONLY to active canonicalDocId & pendingDocId to stay well under Spark 50k read limits
  useEffect(() => {
    if (!selectedClass || !currentSubjectObj.name || !evaluationType) return;

    let unsubPending = () => {};
    let unsubCanonical = () => {};

    unsubPending = onSnapshot(fsDoc(db, 'practicalsData', pendingDocId), (pendingSnap) => {
      if (pendingSnap.exists()) {
        const pData = { id: pendingSnap.id, ...pendingSnap.data() };
        setExistingRecord(pData);
        if (pData.status === 'rejected') setSubmissionStatus('rejected');
        else if (pData.status === 'draft' || pData.isDraft) setSubmissionStatus('draft');
        else setSubmissionStatus('pending');
      } else {
        setExistingRecord(prev => {
          if (prev?.id === pendingDocId) {
            return null;
          }
          return prev;
        });
        setSubmissionStatus(prev => (prev === 'pending' || prev === 'draft' || prev === 'rejected') ? 'unsubmitted' : prev);
      }
    }, (err) => {
      console.warn('Real-time assessment pending sync note:', err?.message || err);
    });

    unsubCanonical = onSnapshot(fsDoc(db, 'practicalsData', canonicalDocId), (canonicalSnap) => {
      if (canonicalSnap.exists()) {
        const cData = { id: canonicalSnap.id, ...canonicalSnap.data() };
        if (cData.status === 'approved' || cData.isPendingApproval === false) {
          setExistingRecord(cData);
          setSubmissionStatus('approved');

          // If approved or updated by admin, sync records into current table
          if (Array.isArray(cData.records) && cData.records.length > 0) {
            setStudents(prev => {
              if (!prev || prev.length === 0) return prev;
              const marksMap = new Map();
              cData.records.forEach(r => {
                const rRoll = String(r.rollNo || r.classRollNo || '').trim();
                const rForm = String(r.formNo || '').trim();
                const rName = String(r.name || r.studentName || '').toLowerCase().trim();
                const rReg = String(r.regNo || r.boardRegNo || '').trim().toUpperCase();
                const val = r.marks !== undefined && r.marks !== null ? String(r.marks) : (r.practicalMarks !== undefined ? String(r.practicalMarks) : '');
                if (rRoll) marksMap.set(`roll_${rRoll}`, val);
                if (rForm) marksMap.set(`form_${rForm}`, val);
                if (rReg && rReg.length >= 8) marksMap.set(`reg_${rReg}`, val);
                if (rName) marksMap.set(`name_${rName}`, val);
              });

              return prev.map(st => {
                const rRoll = String(st.rollNo || st.classRollNo || '').trim();
                const rForm = String(st.formNo || '').trim();
                const rName = String(st.studentName || st.name || '').toLowerCase().trim();
                const rReg = String(st.regNo || '').trim().toUpperCase();

                const m = marksMap.get(`roll_${rRoll}`) || marksMap.get(`form_${rForm}`) || (rReg.length >= 8 ? marksMap.get(`reg_${rReg}`) : null) || marksMap.get(`name_${rName}`);
                if (m !== undefined) {
                  return {
                    ...st,
                    marks: m,
                    isAbsent: m === 'AB'
                  };
                }
                return st;
              });
            });
          }
        }
      }
    }, (err) => {
      console.warn('Real-time assessment canonical sync note:', err?.message || err);
    });

    return () => {
      try { unsubPending(); } catch (_) {}
      try { unsubCanonical(); } catch (_) {}
    };
  }, [canonicalDocId, pendingDocId, selectedClass, currentSubjectObj.name, evaluationType]);

  // Handle Marks Input Changes
  const handleMarksChange = (studentOrIdx, val) => {
    const rawVal = String(val).trim().toUpperCase();
    if (rawVal !== '' && rawVal !== 'A' && rawVal !== 'AB') {
      const num = Number(rawVal);
      if (isNaN(num) || num < 0 || num > maxMarks) {
        showToast(`Marks must be between 0 and ${maxMarks}`, 'warning');
        return;
      }
    }

    setStudents(prev => {
      let targetIdx = -1;
      if (typeof studentOrIdx === 'number') {
        targetIdx = studentOrIdx;
      } else if (studentOrIdx && typeof studentOrIdx === 'object') {
        targetIdx = prev.findIndex(s => getStudentKey(s) === getStudentKey(studentOrIdx));
      }
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const copy = [...prev];
      const isExplicitAbs = rawVal === 'A' || rawVal === 'AB';

      copy[targetIdx] = {
        ...copy[targetIdx],
        marks: isExplicitAbs ? 'AB' : rawVal,
        isAbsent: isExplicitAbs
      };
      return copy;
    });
  };

  const handleToggleAbsent = (studentOrIdx) => {
    setStudents(prev => {
      let targetIdx = -1;
      if (typeof studentOrIdx === 'number') {
        targetIdx = studentOrIdx;
      } else if (studentOrIdx && typeof studentOrIdx === 'object') {
        targetIdx = prev.findIndex(s => getStudentKey(s) === getStudentKey(studentOrIdx));
      }
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const copy = [...prev];
      const cur = copy[targetIdx];
      const willBeAbsent = !cur.isAbsent;
      copy[targetIdx] = {
        ...cur,
        isAbsent: willBeAbsent,
        marks: willBeAbsent ? 'AB' : ''
      };
      return copy;
    });
  };

  // Keyboard Navigation: Enter moves focus to next student
  const handleInputKeyDown = (e, currentIndex, mode = 'desktop') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      const nextId = `assessment-mark-input-${mode}-${nextIndex}`;
      const nextEl = document.getElementById(nextId);
      if (nextEl) {
        nextEl.focus();
        try { nextEl.select(); } catch (_) {}
      } else {
        e.target?.blur();
      }
    }
  };

  // Filter & Sort Pipeline
  const displayedStudents = useMemo(() => {
    let list = [...students];

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(st => {
        const name = (st.name || st.studentName || '').toLowerCase();
        const roll = String(st.rollNo || st.classRollNo || '');
        const form = String(st.formNo || '');
        const reg = String(st.regNo || '').toLowerCase();
        const examRoll = String(st.examRollNo || '');
        const parent = String(st.fatherName || st.parentName || '').toLowerCase();
        const subjs = String(st.subjects || st.rawSubjects || st.subjectsAbbr || '').toLowerCase();

        return name.includes(q) || roll.includes(q) || form.includes(q) || reg.includes(q) ||
          examRoll.includes(q) || parent.includes(q) || subjs.includes(q);
      });
    }

    // Fail / Absent only filter
    if (showFailOnly) {
      list = list.filter(st => {
        const isAb = st.isAbsent || st.marks === 'AB';
        if (isAb) return true;
        if (st.marks === '' || st.marks === undefined || st.marks === null) return true;
        const num = Number(st.marks);
        return !isNaN(num) && num < minMarks;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'rollAsc' || sortBy === 'rollDesc') {
        const rA = parseInt(a.rollNo, 10);
        const rB = parseInt(b.rollNo, 10);
        if (!isNaN(rA) && !isNaN(rB)) {
          return sortBy === 'rollAsc' ? rA - rB : rB - rA;
        }
        return sortBy === 'rollAsc'
          ? String(a.rollNo || '').localeCompare(String(b.rollNo || ''))
          : String(b.rollNo || '').localeCompare(String(a.rollNo || ''));
      }
      if (sortBy === 'nameAsc') {
        return (a.name || a.studentName || '').localeCompare(b.name || b.studentName || '');
      }
      if (sortBy === 'formAsc') {
        const fA = parseInt(a.formNo, 10);
        const fB = parseInt(b.formNo, 10);
        if (!isNaN(fA) && !isNaN(fB)) return fA - fB;
        return String(a.formNo || '').localeCompare(String(b.formNo || ''));
      }
      return 0;
    });

    return list;
  }, [students, searchTerm, showFailOnly, sortBy, minMarks]);

  // Bulk Selection Helpers
  const emptyCount = useMemo(() => {
    return displayedStudents.filter(s => (s.marks === '' || s.marks === undefined || s.marks === null) && !s.isAbsent).length;
  }, [displayedStudents]);

  const isAllSelected = useMemo(() => {
    if (displayedStudents.length === 0) return false;
    return displayedStudents.every(s => selectedKeys.has(getStudentKey(s)));
  }, [displayedStudents, selectedKeys, getStudentKey]);

  const isSomeSelected = useMemo(() => {
    if (displayedStudents.length === 0) return false;
    const count = displayedStudents.filter(s => selectedKeys.has(getStudentKey(s))).length;
    return count > 0 && count < displayedStudents.length;
  }, [displayedStudents, selectedKeys, getStudentKey]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedKeys(new Set());
    } else {
      const next = new Set();
      displayedStudents.forEach(s => next.add(getStudentKey(s)));
      setSelectedKeys(next);
    }
  };

  const handleToggleRow = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectEmptyOnly = () => {
    const next = new Set();
    displayedStudents.forEach(s => {
      const isEmpty = (s.marks === '' || s.marks === undefined || s.marks === null) && !s.isAbsent;
      if (isEmpty) next.add(getStudentKey(s));
    });
    setSelectedKeys(next);
  };

  // Quick Bulk Fill Execution
  const handleApplyQuickFill = (action = 'empty') => {
    const rawVal = quickFillMark.trim().toUpperCase();
    if (action !== 'clear' && !rawVal) return;

    if (action !== 'clear' && rawVal !== 'A' && rawVal !== 'AB') {
      const num = Number(rawVal);
      if (isNaN(num) || num < 0 || num > maxMarks) {
        showToast(`Please enter a valid mark between 0 and ${maxMarks} or 'A'`, 'warning');
        return;
      }
    }

    const markToApply = action === 'clear' ? '' : (rawVal === 'A' || rawVal === 'AB' ? 'AB' : String(Number(rawVal)));
    const isAb = markToApply === 'AB';

    setStudents(prev => {
      return prev.map(s => {
        const key = getStudentKey(s);
        const isSelected = selectedKeys.has(key);
        const isEmpty = (s.marks === '' || s.marks === undefined || s.marks === null) && !s.isAbsent;

        if (action === 'all') {
          return { ...s, marks: markToApply, isAbsent: isAb };
        } else if (action === 'empty') {
          if (isEmpty) {
            return { ...s, marks: markToApply, isAbsent: isAb };
          }
        } else if (action === 'selected') {
          if (isSelected) {
            return { ...s, marks: markToApply, isAbsent: isAb };
          }
        } else if (action === 'clear') {
          if (selectedKeys.size > 0) {
            if (isSelected) return { ...s, marks: '', isAbsent: false };
          } else {
            return { ...s, marks: '', isAbsent: false };
          }
        }
        return s;
      });
    });

    if (action === 'clear') {
      setSelectedKeys(new Set());
      showToast('Cleared marks successfully.', 'info');
    } else {
      showToast(`Bulk filled marks (${markToApply}) successfully.`, 'success');
    }
    setShowQuickFill(false);
  };

  // Live Statistics
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let passed = 0;
    let failed = 0;
    let highest = 0;
    let totalMarks = 0;

    students.forEach(s => {
      if (s.isAbsent || s.marks === 'AB') {
        absent++;
      } else if (s.marks !== '' && !isNaN(Number(s.marks))) {
        present++;
        const val = Number(s.marks);
        totalMarks += val;
        if (val > highest) highest = val;
        if (val >= minMarks) passed++;
        else failed++;
      }
    });

    const average = present > 0 ? (totalMarks / present).toFixed(1) : 0;
    return { present, absent, passed, failed, highest, average, total: students.length };
  }, [students, minMarks]);

  // Save Draft
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const records = students.map(s => ({
        rollNo: s.rollNo,
        classRollNo: s.rollNo,
        name: s.name || s.studentName,
        studentName: s.name || s.studentName,
        fatherName: s.fatherName,
        parentName: s.fatherName,
        formNo: s.formNo,
        regNo: s.regNo,
        examRollNo: s.examRollNo,
        marks: s.isAbsent ? 'AB' : s.marks,
        practicalMarks: s.isAbsent ? 'AB' : s.marks,
        isAbsent: s.isAbsent
      }));

      const payload = sanitizeForFirestore({
        id: pendingDocId,
        targetDocId: canonicalDocId,
        canonicalDocId,
        className: selectedClass,
        class: selectedClass,
        subject: currentSubjectObj.name,
        subjectCode: currentSubjectObj.code,
        practicalType: evaluationType,
        evaluationType,
        examTitle: evaluationType,
        sessionCanonical: selectedSession,
        yearSuffix: selectedSession,
        session: selectedSession,
        maxMarks,
        minMarks,
        isCrossSubject: !isCurrentSubjectAssigned,
        status: 'draft',
        isDraft: true,
        isPendingApproval: false,
        submittedBy: userName,
        teacherEmail: userEmail,
        updatedAt: new Date().toISOString(),
        records
      });

      await saveAcademicRecord('practicalsData', pendingDocId, payload);
      invalidateCollectionCache('practicalsData');

      setSubmissionStatus('draft');
      showToast('Assessment draft saved successfully.', 'success');
    } catch (err) {
      console.error('Failed to save draft:', err);
      showToast('Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Submit for Admin Approval
  const handleSubmitForApproval = () => {
    const unrecorded = students.filter(s => s.marks === '' && !s.isAbsent);
    if (unrecorded.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Unrecorded Student Marks',
        subtitle: `There are ${unrecorded.length} students without entered marks. Do you want to submit anyway? Any blank marks will be recorded as absent.`,
        badgeText: 'Review Marks',
        confirmText: 'Mark Blank as Absent & Submit',
        confirmBtnStyle: 'warning',
        icon: AlertTriangle,
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          executeFinalSubmission(true);
        }
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Submit Assessment for Approval?',
      subtitle: `Submit ${evaluationType} marks for ${currentSubjectObj.name} (${selectedClass}) for administrator verification. Total examinees: ${students.length}.`,
      badgeText: 'Final Submission',
      confirmText: 'Submit for Approval',
      confirmBtnStyle: 'success',
      icon: Send,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        executeFinalSubmission(false);
      }
    });
  };

  const executeFinalSubmission = async (markBlankAsAbsent) => {
    setSaving(true);
    try {
      const records = students.map(s => {
        const isBlank = s.marks === '' && !s.isAbsent;
        const marks = isBlank && markBlankAsAbsent ? 'AB' : s.marks;
        const isAb = s.isAbsent || marks === 'AB';
        return {
          rollNo: s.rollNo,
          classRollNo: s.rollNo,
          name: s.name || s.studentName,
          studentName: s.name || s.studentName,
          fatherName: s.fatherName,
          parentName: s.fatherName,
          formNo: s.formNo,
          regNo: s.regNo,
          examRollNo: s.examRollNo,
          marks: isAb ? 'AB' : marks,
          practicalMarks: isAb ? 'AB' : marks,
          isAbsent: isAb
        };
      });

      const payload = sanitizeForFirestore({
        id: pendingDocId,
        targetDocId: canonicalDocId,
        canonicalDocId,
        className: selectedClass,
        class: selectedClass,
        subject: currentSubjectObj.name,
        subjectCode: currentSubjectObj.code,
        practicalType: evaluationType,
        evaluationType,
        examTitle: evaluationType,
        sessionCanonical: selectedSession,
        yearSuffix: selectedSession,
        session: selectedSession,
        maxMarks,
        minMarks,
        isCrossSubject: !isCurrentSubjectAssigned,
        status: 'pending_approval',
        isDraft: false,
        isPendingApproval: true,
        submittedBy: userName,
        teacherEmail: userEmail,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        records
      });

      await saveAcademicRecord('practicalsData', pendingDocId, payload);
      invalidateCollectionCache('practicalsData');

      logTeacherActivity({
        actionType: 'submit_assessment',
        actionTitle: 'Submitted School Assessment for Approval',
        details: `Submitted ${evaluationType} for ${currentSubjectObj.name} (${selectedClass}) with ${records.length} students.`,
        metadata: { docId: pendingDocId, evaluationType, selectedClass, subject: currentSubjectObj.name }
      });

      setSubmissionStatus('pending');
      showToast(`Submitted ${evaluationType} marks for administrator approval!`, 'success');
    } catch (err) {
      console.error('Failed to submit assessment:', err);
      showToast('Failed to submit evaluation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Print School Assessment Award Roll
  const handlePrint = () => {
    printIndividualAwardRoll({
      subjectCode: currentSubjectObj.code,
      subjectName: currentSubjectObj.name,
      className: `Class ${selectedClass}`,
      session: selectedSession,
      records: displayedStudents.map(s => ({
        rollNo: s.rollNo,
        classRollNo: s.rollNo,
        name: s.name || s.studentName,
        studentName: s.name || s.studentName,
        fatherName: s.fatherName || s.parentName,
        parentName: s.fatherName || s.parentName,
        formNo: s.formNo,
        regNo: s.regNo,
        examRollNo: s.examRollNo,
        boardRoll: s.examRollNo,
        boardRollNo: s.examRollNo,
        practicalMarks: s.isAbsent ? 'AB' : (s.marks !== undefined && s.marks !== null ? s.marks : ''),
        marks: s.isAbsent ? 'AB' : (s.marks !== undefined && s.marks !== null ? s.marks : '')
      })),
      isExternal: false,
      evaluationType,
      practicalType: evaluationType,
      examTitle: evaluationType,
      maxMarks,
      minMarks
    });
  };

  // Fetch Submissions History for Drawer
  const fetchMyHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const rawDocs = await getCachedCollection('practicalsData', true, 5 * 60 * 1000).catch(() => []);
      const assessmentSubmissions = (rawDocs || [])
        .filter(d => {
          if (!d) return false;
          const rawId = String(d.id || d.docId || '');
          if (rawId.startsWith('history_') || rawId.startsWith('bin_')) return false;

          const evalType = d.practicalType || d.evaluationType || d.examTitle || d.title || '';
          if (!isSchoolAssessmentType(evalType)) return false;

          return isSubmissionOwnedByTeacher(d, user, auth.currentUser);
        })
        .map(d => {
          const rawId = String(d.id || d.docId || '');
          const evalType = d.practicalType || d.evaluationType || d.examTitle || d.title || 'Pre-Board Test';
          const records = Array.isArray(d.records) ? d.records : (Array.isArray(d.students) ? d.students : []);

          let displayDate = 'N/A';
          const rawTime = d.updatedAt || d.submittedAt;
          if (rawTime) {
            const dateObj = typeof rawTime?.toDate === 'function' ? rawTime.toDate() : new Date(rawTime);
            if (!isNaN(dateObj.getTime())) {
              displayDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
          }

          return {
            ...d,
            id: rawId,
            className: d.className || d.class || 'N/A',
            subject: d.subject || d.subjectName || 'N/A',
            evaluationType: evalType,
            session: d.yearSuffix || d.sessionCanonical || d.session || '2025-26',
            recordsCount: records.length,
            displayDate
          };
        });

      setMySubmissions(assessmentSubmissions);
    } catch (e) {
      console.warn('Failed to load assessment history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  // Auto-open Submissions History if navigated with query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'history' || params.get('history') === 'true' || location.state?.openHistory) {
      setShowHistoryModal(true);
      fetchMyHistory();
    }
  }, [location, fetchMyHistory]);

  useEffect(() => {
    if (showHistoryModal) {
      fetchMyHistory();
    }
  }, [showHistoryModal, fetchMyHistory]);

  return (
    <div className="portal-page w-full min-h-[85vh] py-2 sm:py-3 px-2 sm:px-4 space-y-2.5" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="School-Based Assessment Portal | Govt HSS Shangus"
        description="Teacher marks entry and evaluation portal for Pre-Board Tests, Golden Tests, Term End and Unit Assessments."
        path="/portal/teacher/assessments"
      />

      <div className="max-w-6xl mx-auto space-y-2.5 pb-16">
        {/* Navigation & Header Card */}
        <div className="rounded-2xl p-2.5 sm:p-3 border shadow-xs" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/portal/teacher"
                className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-teal-50 hover:text-teal-700 transition-colors shadow-2xs shrink-0"
                title="Return to Teacher Dashboard"
              >
                <ArrowLeft size={16} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate m-0">
                    School-Based Assessment Portal
                  </h1>
                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                    Faculty Entry
                  </span>
                  {teacherRegisteredSubject && (
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 shrink-0 flex items-center gap-1" title={`Assigned Subject: ${teacherRegisteredSubject}`}>
                      <Sparkles size={10} className="text-purple-600 dark:text-purple-400" />
                      <span>Assigned: {teacherRegisteredSubject}</span>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate m-0 mt-0.5">
                  Pre-Board Examinations, Golden Tests, Term End, and Unit Assessments
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <History size={13} className="text-teal-600 dark:text-teal-400" />
                <span className="hidden xs:inline">Submissions Log</span>
                <span className="xs:hidden">Log</span>
              </button>

              <button
                type="button"
                onClick={() => fetchRosterData()}
                disabled={loading || saving}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Refresh Roster"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-teal-600' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Master Control Card & Toolbar (Parity with Practicals Portal) */}
        <div className="rounded-xl p-3 border shadow-2xs space-y-2.5" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          {/* Master Toolbar Row: Select All, Sort, Filters Toggle, Quick Fill, Print */}
          <div className="flex items-center justify-between gap-1 sm:gap-1.5 pt-0.5">
            {/* Left: Select All Checkbox */}
            <label className="h-8 min-h-[32px] max-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" title={isAllSelected ? "Deselect all" : "Select all"}>
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                onChange={handleToggleSelectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
              />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">All</span>
            </label>

            {/* Middle: Sort Dropdown */}
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 min-h-[32px] max-h-[32px] px-2 rounded-lg border text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
                title="Sort examinees"
              >
                <option value="rollAsc">Roll ↑</option>
                <option value="rollDesc">Roll ↓</option>
                <option value="nameAsc">Name A-Z</option>
                <option value="formAsc">Form #</option>
              </select>
            </div>

            {/* Right: Action Buttons Group */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Filters Toggle Button with Live Student Count */}
              <button
                type="button"
                onClick={() => setShowFilterSettings(!showFilterSettings)}
                className={`h-8 min-h-[32px] max-h-[32px] px-2.5 sm:px-3 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                  showFilterSettings
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
                title={`Toggle evaluation filters (${displayedStudents.length} of ${students.length} students)`}
              >
                <SlidersHorizontal size={13} className={showFilterSettings ? 'text-white' : 'text-teal-600 dark:text-teal-400 shrink-0'} />
                <span className="font-extrabold text-[11px]">Filters</span>
                <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black leading-none flex items-center gap-1 ${
                  showFilterSettings
                    ? 'bg-white/25 text-white'
                    : 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300'
                }`}>
                  <span>
                    {displayedStudents.length}
                    {displayedStudents.length !== students.length ? `/${students.length}` : ''}
                  </span>
                  <span className="hidden sm:inline font-sans text-[9px] font-bold opacity-85">Students</span>
                  {showFailOnly && <span className="text-rose-500 font-sans font-black text-[9px]">• Fail</span>}
                </span>
                <ChevronDown size={11} className={`transition-transform duration-200 shrink-0 ${showFilterSettings ? 'rotate-180' : ''}`} />
              </button>

              {/* Quick Fill Button */}
              <button
                type="button"
                onClick={() => setShowQuickFill(!showQuickFill)}
                className={`h-8 min-h-[32px] max-h-[32px] px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 shrink-0 ${
                  showQuickFill
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs cursor-pointer'
                    : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer'
                }`}
                title="Quick Bulk Fill: Fill marks for all, empty, or selected students in one go"
              >
                <Zap size={13} className={showQuickFill ? 'text-white' : 'text-amber-500'} />
                <span className="hidden sm:inline">Fill</span>
                {selectedKeys.size > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-teal-600 text-white text-[8px] font-bold">
                    {selectedKeys.size}
                  </span>
                )}
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="h-8 min-h-[32px] max-h-[32px] px-2.5 rounded-lg font-bold text-[11px] shadow-2xs flex items-center justify-center gap-1 bg-teal-600 hover:bg-teal-500 text-white border border-teal-600 cursor-pointer active:scale-95 shrink-0"
                title="Print Assessment Award Roll"
              >
                <Printer size={13} />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Secondary Expandable Filter Inputs Panel */}
          {showFilterSettings && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {/* Class Selector */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Class
                  </label>
                  <select
                    value={selectedClass}
                    onChange={e => {
                      userHasSelectedClassRef.current = true;
                      userHasManuallySelectedSubjectRef.current = false;
                      setSelectedClass(e.target.value);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {AVAILABLE_CLASSES.map(cls => (
                      <option key={cls} value={cls}>Class {cls}</option>
                    ))}
                  </select>
                </div>

                {/* Roster Scope */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Roster Scope
                  </label>
                  <select
                    value={rosterScope}
                    onChange={e => setRosterScope(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    title="Choose between evaluating only students enrolled in this subject/stream or all class students"
                  >
                    <option value="stream">Subject / Stream Only</option>
                    <option value="all_class">All Class Students</option>
                  </select>
                </div>

                {/* Subject Selector */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 block m-0">
                      Subject
                    </label>
                    {isCurrentSubjectAssigned ? (
                      <span className="text-[9px] font-black text-teal-600 dark:text-teal-400 flex items-center gap-0.5" title="Assigned Subject">
                        <Check size={10} /> Assigned Subject
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5" title="Cross-Subject Evaluation">
                        <AlertCircle size={10} /> Cross-Subject
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedSubject}
                    onChange={e => {
                      userHasManuallySelectedSubjectRef.current = true;
                      setSelectedSubject(e.target.value);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {assignedSubjectOptions.length > 0 ? (
                      <>
                        <optgroup label="⭐ Your Assigned Subjects">
                          {assignedSubjectOptions.map(sub => (
                            <option key={sub.code} value={sub.name}>
                              ⭐ {sub.name} ({sub.code}) — Assigned
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="All Curriculum Subjects">
                          {otherSubjectOptions.map(sub => (
                            <option key={sub.code} value={sub.name}>
                              {sub.name} ({sub.code})
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      displaySubjects.map(sub => (
                        <option key={sub.code} value={sub.name}>
                          {sub.name} ({sub.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Examination / Assessment Type */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Eval. Type
                  </label>
                  <select
                    value={evaluationType}
                    onChange={e => setEvaluationType(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {availableEvalTypes.map(et => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>

                {/* Academic Session */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Session
                  </label>
                  <select
                    value={selectedSession}
                    onChange={e => setSelectedSession(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Search and Fail-Only Filter Bar */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate by Name, Roll, Form #, Reg #, Exam Roll #..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showFailOnly}
                      onChange={e => setShowFailOnly(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span>Show Reappear / Absent Only</span>
                  </label>
                  {(searchTerm || showFailOnly) && (
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(''); setShowFailOnly(false); }}
                      className="text-[11px] font-bold text-teal-600 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Assessment Info Banner & Current Status */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {evaluationType} • {currentSubjectObj.name}
              </span>
              {isCurrentSubjectAssigned ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/60 flex items-center gap-1">
                  <Check size={10} />
                  <span>Assigned Subject</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200/60 flex items-center gap-1">
                  <AlertCircle size={10} />
                  <span>Cross-Subject</span>
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60">
                Max Marks: {maxMarks}
              </span>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
                Pass Marks: {minMarks}
              </span>
              {rosterScope === 'stream' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/60">
                  Filtered to enrolled stream/subject
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200/60">
                  All Class Students Scope
                </span>
              )}
            </div>

            {/* Current Status Badge */}
            <div>
              {submissionStatus === 'approved' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  Approved & Live in Gazette
                </span>
              )}
              {submissionStatus === 'pending' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300">
                  <Clock size={12} className="text-amber-600" />
                  Submitted (Pending Admin Approval)
                </span>
              )}
              {submissionStatus === 'rejected' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300">
                  <AlertTriangle size={12} className="text-rose-600" />
                  Revision Requested by Admin
                </span>
              )}
              {submissionStatus === 'draft' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300">
                  Draft Saved (Not Submitted)
                </span>
              )}
              {submissionStatus === 'unsubmitted' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300">
                  Ready for Marks Entry
                </span>
              )}
            </div>
          </div>

          {/* Revision Feedback Notice */}
          {submissionStatus === 'rejected' && existingRecord?.rejectionReason && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                <AlertCircle size={14} />
                <span>Administrator Requested Revision:</span>
              </div>
              <p className="m-0 pl-5 text-[11px] font-medium">{existingRecord.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Live Statistics Ribbon */}
        {students.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">{stats.total}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-emerald-500 uppercase block">Present</span>
              <span className="text-sm font-black text-emerald-600">{stats.present}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-rose-500 uppercase block">Absent</span>
              <span className="text-sm font-black text-rose-600">{stats.absent}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-indigo-500 uppercase block">Passed</span>
              <span className="text-sm font-black text-indigo-600">{stats.passed}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-amber-500 uppercase block">Reappear</span>
              <span className="text-sm font-black text-amber-600">{stats.failed}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg / Top</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">{stats.average} / {stats.highest}</span>
            </div>
          </div>
        )}

        {/* Quick Bulk Fill Drawer (Desktop) */}
        {showQuickFill && (
          <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2.5 animate-fadeIn shadow-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Zap size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 m-0 uppercase tracking-wide">
                    Quick Bulk Fill Marks
                  </h4>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium m-0">
                    Assign a mark to empty cells, selected students ({selectedKeys.size}), or all students ({displayedStudents.length}).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickFill(false)}
                className="p-1 rounded-lg text-amber-700 hover:text-amber-900 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder={`0-${maxMarks} or A`}
                value={quickFillMark}
                onChange={e => setQuickFillMark(e.target.value.toUpperCase())}
                className="w-24 text-center py-1 px-2 font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />

              {/* Preset Chips */}
              <div className="flex items-center gap-1">
                {[String(maxMarks), String(Math.max(0, maxMarks - 2)), String(minMarks), 'A'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuickFillMark(val)}
                    className="px-2 py-0.5 rounded text-[10px] font-black bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                  >
                    {val === 'A' ? 'Absent (A)' : `${val}M`}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => handleApplyQuickFill('empty')}
                  disabled={!quickFillMark.trim()}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Fill Empty Only ({emptyCount})
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickFill('selected')}
                  disabled={selectedKeys.size === 0 || !quickFillMark.trim()}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Fill Selected ({selectedKeys.size})
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickFill('all')}
                  disabled={!quickFillMark.trim()}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Fill All ({displayedStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickFill('clear')}
                  className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                >
                  Clear {selectedKeys.size > 0 ? `(${selectedKeys.size})` : 'All'}
                </button>
              </div>
            </div>

            {/* Fast Select Shortcuts */}
            <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60 text-[10.5px] text-amber-800 dark:text-amber-300">
              <span className="font-bold">Fast Select:</span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="font-bold text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {isAllSelected ? 'Deselect All' : `All (${displayedStudents.length})`}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleSelectEmptyOnly}
                className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Empty Only ({emptyCount})
              </button>
              {selectedKeys.size > 0 && (
                <>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedKeys(new Set())}
                    className="font-bold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Student Marks Entry Table / Card Section */}
        <div className="rounded-xl border shadow-xs overflow-hidden" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          {loading ? (
            <div className="py-20 text-center text-xs font-bold text-slate-400 space-y-2">
              <RefreshCw size={22} className="animate-spin mx-auto text-teal-600" />
              <div>Connecting to official database & preloading {currentSubjectObj.name} examinees for {selectedSession}…</div>
            </div>
          ) : displayedStudents.length === 0 ? (
            <div className="py-16 text-center space-y-2 px-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FileText size={20} />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 m-0">
                No enrolled candidates matching the selected filters.
              </p>
              <p className="text-[11px] text-slate-400 m-0">
                Try switching Roster Scope to "All Class Students" or check student admissions in Class {selectedClass}.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-black uppercase text-[9.5px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-2 w-14 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                            onChange={handleToggleSelectAll}
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-black">#</span>
                        </div>
                      </th>
                      <th
                        className="py-2 px-2.5 w-16 cursor-pointer hover:text-teal-600 select-none"
                        onClick={() => setSortBy(sortBy === 'rollAsc' ? 'rollDesc' : 'rollAsc')}
                      >
                        Roll {sortBy.startsWith('roll') ? (sortBy === 'rollAsc' ? '↑' : '↓') : ''}
                      </th>
                      <th
                        className="py-2 px-2.5 cursor-pointer hover:text-teal-600 select-none"
                        onClick={() => setSortBy(sortBy === 'nameAsc' ? 'rollAsc' : 'nameAsc')}
                      >
                        Student Details & Subjects Offered {sortBy === 'nameAsc' ? '↑' : ''}
                      </th>
                      <th className="py-2 px-2 text-center w-72">
                        Marks Obt. ({maxMarks}M) & In Words
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                    {displayedStudents.map((st, idx) => {
                      const isAbsent = st.isAbsent || st.marks === 'A' || st.marks === 'AB';
                      const valToConvert = isAbsent ? 'A' : (st.marks !== '' && st.marks !== undefined ? st.marks : '');
                      const inWords = valToConvert ? numberToWords(valToConvert) : '';
                      const allSubjs = st.subjectsAbbr || st.rawSubjects || st.subjects || 'N/A';
                      const key = getStudentKey(st);
                      const isSelected = selectedKeys.has(key);

                      const numMarks = Number(st.marks);
                      const hasMarks = st.marks !== '' && st.marks !== undefined && !isNaN(numMarks);
                      const isPass = hasMarks && numMarks >= minMarks;

                      return (
                        <tr
                          key={key}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors ${
                            isSelected
                              ? 'bg-teal-50/70 dark:bg-teal-950/40'
                              : isAbsent
                              ? 'bg-amber-500/5'
                              : ''
                          }`}
                        >
                          {/* Row Selection & Index */}
                          <td className="py-1.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRow(key)}
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                              <span className="font-mono font-black text-slate-400 text-[11px]">#{idx + 1}</span>
                            </div>
                          </td>

                          {/* Roll Number Badge */}
                          <td className="py-1.5 px-2.5 font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                            {st.rollNo || '—'}
                          </td>

                          {/* Student Details with Rich Badges */}
                          <td className="py-1.5 px-2.5 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight">
                                {st.name || st.studentName}
                              </span>
                              {st.formNo && String(st.formNo) !== String(st.rollNo) && String(st.formNo).length > 2 && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 text-[9px]">
                                  Form #{st.formNo}
                                </span>
                              )}
                              {st.regNo && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20 text-[9px]">
                                  Reg #{st.regNo}
                                </span>
                              )}
                              {st.examRollNo && (
                                <span className="px-1.5 py-0.2 rounded font-mono font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px]">
                                  Exam Roll: {st.examRollNo}
                                </span>
                              )}
                            </div>

                            {/* Enrolled Subjects with Active Subject Highlighted */}
                            <div className="text-[9.5px] font-bold text-teal-700 dark:text-teal-300 leading-tight">
                              <span className="font-mono font-black text-teal-800 dark:text-teal-200 bg-teal-500/15 px-1 py-0.2 rounded border border-teal-500/30 mr-1">
                                Subs:
                              </span>
                              {renderSubjectsWithHighlight(allSubjs, currentSubjectObj)}
                            </div>
                          </td>

                          {/* Marks Input & In-Words Pill */}
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1.5 justify-center">
                              <input
                                id={`assessment-mark-input-desktop-${idx}`}
                                data-student-idx={idx}
                                type="text"
                                enterKeyHint={idx === displayedStudents.length - 1 ? 'done' : 'next'}
                                placeholder={`0-${maxMarks} / A`}
                                value={st.marks}
                                onFocus={(e) => {
                                  try { e.target.select(); } catch (_) {}
                                }}
                                onChange={(e) => handleMarksChange(st, e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, idx, 'desktop')}
                                className={`w-20 px-2 py-0 rounded-md border text-[11px] font-black h-7 focus:outline-hidden focus:ring-1 focus:ring-teal-500 uppercase text-center leading-none ${
                                  isAbsent
                                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-bold'
                                    : st.marks !== '' && st.marks !== undefined
                                    ? 'bg-teal-50/50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 font-bold'
                                    : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleToggleAbsent(st)}
                                className={`h-7 px-2 rounded-md font-mono text-[10px] font-black border transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 leading-none ${
                                  isAbsent
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-amber-600 dark:hover:text-amber-400 border-slate-200 dark:border-slate-700'
                                }`}
                                title="Toggle Absent (AB)"
                              >
                                AB
                              </button>
                              {inWords ? (
                                <span className={`px-1.5 py-0.5 rounded-md border text-[9.5px] font-black whitespace-nowrap ${
                                  isAbsent
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : isPass
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {inWords} {!isAbsent && Number(st.marks) > 0 ? 'Only' : ''}
                                </span>
                              ) : (
                                <span className="text-[9.5px] text-slate-400 font-semibold italic">Enter mark</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Action Footer */}
          {students.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Printer size={13} />
                  <span>Print Assessment Roll</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95"
                >
                  <Save size={13} />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitForApproval}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Send size={13} />
                  <span>Submit for Admin Approval</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submissions History Drawer */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-2xl space-y-3 border-slate-200 dark:border-slate-800 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <History size={15} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate m-0">
                    My School Assessment Submissions
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium m-0">
                    Showing your submitted evaluations (Pre-Board, Golden Test, Unit Test, etc.)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Filter */}
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by subject, class, or test type..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>

            {/* Submissions List */}
            {loadingHistory ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400 space-y-2">
                <RefreshCw size={18} className="animate-spin mx-auto text-teal-600" />
                <div>Fetching past assessments…</div>
              </div>
            ) : mySubmissions.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No past school assessment submissions recorded under your account.
              </div>
            ) : (
              <div className="overflow-y-auto space-y-1.5 flex-1 max-h-[60vh]">
                {mySubmissions
                  .filter(item => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.toLowerCase().trim();
                    return `${item.className} ${item.subject} ${item.evaluationType}`.toLowerCase().includes(q);
                  })
                  .map((item, idx) => {
                    const isPending = item.id.startsWith('pending_') || item.status === 'pending_approval';
                    const isRejected = item.status === 'rejected';

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-700 bg-white dark:bg-slate-950/70 transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-xs text-slate-900 dark:text-white">
                              Class {item.className} • {item.subject}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              {item.evaluationType}
                            </span>
                            {item.isCrossSubject && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                                Cross
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-400 m-0">
                            {item.recordsCount} examinees • Session {item.session} • {item.displayDate}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {isPending ? (
                            isRejected ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                Revision
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                                Pending
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              Approved
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (!isSubmissionOwnedByTeacher(item, user, auth.currentUser)) {
                                showToast('Access Restricted: You can only print your own assessment submissions.', 'error');
                                return;
                              }
                              const ok = printHistoricalSubmission(item);
                              if (!ok) {
                                showToast('No student records found in this submission.', 'warning');
                              }
                            }}
                            className="h-6 px-2 rounded-md text-[10.5px] font-bold bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="Print or Save/Download PDF of this Assessment Award Roll"
                          >
                            <Printer size={11} className="text-teal-600 dark:text-teal-400" />
                            <span>Print</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              userHasSelectedClassRef.current = true;
                              userHasManuallySelectedSubjectRef.current = true;
                              setSelectedClass(item.className);
                              setSelectedSubject(item.subject);
                              setEvaluationType(item.evaluationType);
                              setSelectedSession(item.session);
                              setShowHistoryModal(false);
                            }}
                            className="h-6 px-2 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10.5px] font-bold border border-teal-200 dark:border-teal-800 transition-all cursor-pointer active:scale-95"
                            title="Load this assessment into the live grid"
                          >
                            Load
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[10px] text-slate-400 truncate">
                Click <strong className="text-slate-600 dark:text-slate-300">Print</strong> to print PDF directly, or <strong className="text-teal-600">Load</strong> to edit.
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 shrink-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        subtitle={confirmModal.subtitle}
        badgeText={confirmModal.badgeText}
        confirmText={confirmModal.confirmText}
        confirmBtnStyle={confirmModal.confirmBtnStyle}
        icon={confirmModal.icon}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
