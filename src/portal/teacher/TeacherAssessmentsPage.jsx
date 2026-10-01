import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, RefreshCw, AlertCircle, CheckCircle2,
  Printer, ShieldCheck, History, Clock, Search, Save, Send,
  ChevronDown, X, Info, Sparkles, Award, AlertTriangle, FileText, Check
} from 'lucide-react';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, doc as fsDoc, getDoc } from 'firebase/firestore';
import { getCachedCollection, invalidateCollectionCache, getMasterRegistersScoped } from '../../services/dbCache';
import { saveAcademicRecord } from '../../services/academicRecordService';
import { logTeacherActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';
import ConfirmModal from '../components/ConfirmModal';
import { sanitizeForFirestore } from '../../utils/firestoreSanitizer';
import { printIndividualAwardRoll, isSubmissionOwnedByTeacher } from '../../utils/practicalsPdfGenerator';
import {
  getSchoolEvaluationTypesForTeacher,
  getSubjectOverride,
  SUBJECT_CONFIG_DEFS,
  isTeacherSubjectMatch,
  normalizeSubjectIdentity,
  formatPracticalDocId,
  getTeacherAssignedSubjectsForClass,
  isPracticalEvaluationType,
  isSchoolAssessmentType
} from '../../utils/practicalsSettingsManager';

const CURRENT_SESSION = '2025-26';
const AVAILABLE_CLASSES = ['9th', '10th', '11th', '12th'];

const SECONDARY_SUBJECTS = [
  { code: 'EN', name: 'General English', defaultMax: 50 },
  { code: 'MA', name: 'Mathematics', defaultMax: 50 },
  { code: 'SC', name: 'Science', defaultMax: 50 },
  { code: 'SS', name: 'Social Science', defaultMax: 50 },
  { code: 'UR', name: 'Urdu', defaultMax: 50 },
  { code: 'HI', name: 'Hindi', defaultMax: 50 },
  { code: 'CS', name: 'Computer Science', defaultMax: 50 }
];

const HIGHER_SECONDARY_SUBJECTS = SUBJECT_CONFIG_DEFS.map(s => ({
  code: s.code,
  name: s.name,
  defaultMax: 50
}));

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

  const [selectedSession, setSelectedSession] = useState(location.state?.yearSuffix || CURRENT_SESSION);
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION, '2024-25', '2023-24']);

  // Subjects for selected class
  const displaySubjects = useMemo(() => {
    return (selectedClass === '9th' || selectedClass === '10th')
      ? SECONDARY_SUBJECTS
      : HIGHER_SECONDARY_SUBJECTS;
  }, [selectedClass]);

  const teacherClassAssignedSubjects = useMemo(() => {
    return getTeacherAssignedSubjectsForClass(user, selectedClass) || [];
  }, [user, selectedClass]);

  const [selectedSubject, setSelectedSubject] = useState(() => {
    if (location.state?.selectedSubject) return location.state.selectedSubject;
    if (teacherClassAssignedSubjects.length > 0) {
      const match = displaySubjects.find(s => isTeacherSubjectMatch(teacherClassAssignedSubjects[0], s.name));
      if (match) return match.name;
    }
    return displaySubjects[0]?.name || 'General English';
  });

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
    return displaySubjects.find(s => s.name.toLowerCase() === selectedSubject.toLowerCase()) ||
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

  // Fetch Student Roster & Existing Marks
  const fetchRosterData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch live or pending marks from practicalsData
      let loadedDoc = null;
      let status = 'unsubmitted';

      const [pendingSnap, canonicalSnap] = await Promise.all([
        getDoc(fsDoc(db, 'practicalsData', pendingDocId)).catch(() => null),
        getDoc(fsDoc(db, 'practicalsData', canonicalDocId)).catch(() => null)
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

      // 2. Fetch Master Registers student list for this class & session
      const normCls = selectedClass.replace(/class/gi, '').trim();
      const masterDocs = await getMasterRegistersScoped(normCls, selectedSession).catch(() => []);

      let rawStudents = [];
      if (Array.isArray(masterDocs) && masterDocs.length > 0) {
        masterDocs.forEach(d => {
          const list = d.items || d.students || d.records || d.data;
          if (Array.isArray(list)) rawStudents.push(...list);
        });
      }

      // Fallback: fetch admissions if master registers is empty
      if (rawStudents.length === 0) {
        const admissions = await getCachedCollection('admissions', false, 15 * 60 * 1000).catch(() => []);
        rawStudents = (admissions || []).filter(st => {
          const c = String(st.class || st.className || '').toLowerCase();
          const s = String(st.session || st.academicSession || '');
          return c.includes(normCls.toLowerCase()) && (s.includes(selectedSession) || selectedSession.includes(s));
        });
      }

      // Deduplicate students by roll number or name
      const studentMap = new Map();
      rawStudents.forEach(st => {
        const roll = String(st.rollNo || st.classRollNo || st.RollNo || '').trim();
        const name = String(st.name || st.studentName || st.StudentName || '').trim();
        if (!name) return;
        const key = roll && roll !== '—' && roll !== 'N/A' ? `roll_${roll}` : `name_${name.toLowerCase()}`;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            id: st.id || key,
            rollNo: roll || '',
            name,
            fatherName: st.fatherName || st.parentage || st.FatherName || '',
            stream: st.stream || st.Stream || '',
            marks: '',
            isAbsent: false
          });
        }
      });

      const rosterList = Array.from(studentMap.values()).sort((a, b) => {
        const rA = parseInt(a.rollNo, 10);
        const rB = parseInt(b.rollNo, 10);
        if (!isNaN(rA) && !isNaN(rB)) return rA - rB;
        return a.name.localeCompare(b.name);
      });

      // 3. Merge previously submitted/saved marks into roster
      if (loadedDoc && Array.isArray(loadedDoc.records) && loadedDoc.records.length > 0) {
        const marksLookup = new Map();
        loadedDoc.records.forEach(r => {
          const rRoll = String(r.rollNo || r.roll || '').trim();
          const rName = String(r.name || r.studentName || '').toLowerCase().trim();
          if (rRoll) marksLookup.set(`roll_${rRoll}`, r);
          if (rName) marksLookup.set(`name_${rName}`, r);
        });

        rosterList.forEach(st => {
          const rRollKey = st.rollNo ? `roll_${st.rollNo}` : null;
          const rNameKey = `name_${st.name.toLowerCase()}`;
          const existing = (rRollKey && marksLookup.get(rRollKey)) || marksLookup.get(rNameKey);
          if (existing) {
            const rawMarks = existing.marks !== undefined ? existing.marks : (existing.practicalMarks || existing.score || '');
            const isAb = String(rawMarks).toUpperCase() === 'AB' || String(rawMarks).toUpperCase() === 'A' || existing.isAbsent;
            st.marks = isAb ? 'AB' : rawMarks;
            st.isAbsent = isAb;
          }
        });
      }

      setStudents(rosterList);
    } catch (err) {
      console.error('Failed to load roster data:', err);
      showToast('Error loading student roster', 'error');
    } finally {
      setLoading(false);
    }
  }, [canonicalDocId, pendingDocId, selectedClass, selectedSession]);

  useEffect(() => {
    fetchRosterData();
  }, [fetchRosterData]);

  // Handle Marks input
  const handleMarksChange = (idx, value) => {
    const raw = String(value).toUpperCase().trim();
    setStudents(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;

      if (raw === 'AB' || raw === 'A') {
        copy[idx] = { ...copy[idx], marks: 'AB', isAbsent: true };
      } else if (raw === '') {
        copy[idx] = { ...copy[idx], marks: '', isAbsent: false };
      } else {
        const num = Number(raw);
        if (!isNaN(num)) {
          if (num > maxMarks) {
            showToast(`Marks cannot exceed ${maxMarks} for ${currentSubjectObj.name}`, 'warning');
            return prev;
          }
          if (num < 0) return prev;
          copy[idx] = { ...copy[idx], marks: num, isAbsent: false };
        } else {
          return prev;
        }
      }
      return copy;
    });
  };

  const handleToggleAbsent = (idx) => {
    setStudents(prev => {
      const copy = [...prev];
      if (!copy[idx]) return prev;
      const willBeAbsent = !copy[idx].isAbsent;
      copy[idx] = {
        ...copy[idx],
        isAbsent: willBeAbsent,
        marks: willBeAbsent ? 'AB' : ''
      };
      return copy;
    });
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
        name: s.name,
        studentName: s.name,
        fatherName: s.fatherName,
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
    // Validation: check if all students have marks or AB
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
          name: s.name,
          studentName: s.name,
          fatherName: s.fatherName,
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

  // Print Award Roll
  const handlePrint = () => {
    printIndividualAwardRoll({
      subjectCode: currentSubjectObj.code,
      subjectName: currentSubjectObj.name,
      className: `Class ${selectedClass}`,
      session: selectedSession,
      records: students.map(s => ({
        rollNo: s.rollNo,
        name: s.name,
        studentName: s.name,
        fatherName: s.fatherName,
        practicalMarks: s.isAbsent ? 'AB' : s.marks,
        marks: s.isAbsent ? 'AB' : s.marks
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
                <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate m-0 flex items-center gap-1.5">
                  <span>School-Based Assessment Portal</span>
                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    Faculty Entry
                  </span>
                </h1>
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

        {/* Filter Toolbar */}
        <div className="rounded-xl p-3 border shadow-2xs space-y-2.5" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Class Selector */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Target Class
              </label>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              >
                {AVAILABLE_CLASSES.map(cls => (
                  <option key={cls} value={cls}>Class {cls}</option>
                ))}
              </select>
            </div>

            {/* Assessment Type Selector */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Examination / Assessment
              </label>
              <select
                value={evaluationType}
                onChange={e => setEvaluationType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              >
                {availableEvalTypes.map(et => (
                  <option key={et.value} value={et.value}>{et.label}</option>
                ))}
              </select>
            </div>

            {/* Subject Selector */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Subject
              </label>
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              >
                {displaySubjects.map(sub => (
                  <option key={sub.code} value={sub.name}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Session Selector */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Academic Session
              </label>
              <select
                value={selectedSession}
                onChange={e => setSelectedSession(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              >
                {availableSessions.map(sess => (
                  <option key={sess} value={sess}>{sess}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assessment Info Banner & Status */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {evaluationType} • {currentSubjectObj.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60">
                Max Marks: {maxMarks}
              </span>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
                Pass Marks: {minMarks}
              </span>
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

        {/* Student Marks Entry Table */}
        <div className="rounded-xl border shadow-xs overflow-hidden" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          {loading ? (
            <div className="py-20 text-center text-xs font-bold text-slate-400 space-y-2">
              <RefreshCw size={22} className="animate-spin mx-auto text-teal-600" />
              <div>Loading student roster and assessment records…</div>
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 text-center space-y-2 px-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FileText size={20} />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 m-0">
                No enrolled students found for Class {selectedClass} ({selectedSession}).
              </p>
              <p className="text-[11px] text-slate-400 m-0">
                Verify student admissions or master register records for this session.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 w-20">Roll No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Parentage</th>
                    <th className="py-2.5 px-3 w-36 text-center">Score ({maxMarks}M)</th>
                    <th className="py-2.5 px-3 w-24 text-center">Absent</th>
                    <th className="py-2.5 px-3 w-28 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students.map((st, idx) => {
                    const isAb = st.isAbsent || String(st.marks).toUpperCase() === 'AB';
                    const numMarks = Number(st.marks);
                    const hasMarks = st.marks !== '' && !isNaN(numMarks);
                    const isPass = hasMarks && numMarks >= minMarks;

                    return (
                      <tr key={st.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {st.rollNo || '—'}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                          {st.name}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {st.fatherName || '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isAb ? (
                            <span className="font-mono font-black text-xs text-rose-600">AB (Absent)</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              value={st.marks}
                              onChange={e => handleMarksChange(idx, e.target.value)}
                              placeholder={`0 - ${maxMarks}`}
                              className="w-24 text-center py-1 px-2 font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAbsent(idx)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              isAb
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {isAb ? 'Absent' : 'Mark AB'}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isAb ? (
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              Absent
                            </span>
                          ) : hasMarks ? (
                            isPass ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                Pass ({st.marks})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                                Reappear ({st.marks})
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
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

            {/* List */}
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
                              setSelectedClass(item.className);
                              setSelectedSubject(item.subject);
                              setEvaluationType(item.evaluationType);
                              setSelectedSession(item.session);
                              setShowHistoryModal(false);
                            }}
                            className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10.5px] font-bold cursor-pointer"
                          >
                            Load
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-right shrink-0">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
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
