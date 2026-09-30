/**
 * JKBOSE Subject-wise Roll Number Return Statement View
 * 
 * Interactive Administrative Module providing:
 * 1. Real-time Subject Roll Return statements formatted as per JKBOSE Sub-Office circular.
 * 2. Automatic Range Compression ("2101 TO 2145, 2150, 2155 TO 2160").
 * 3. Class-wise and Multi-Class support (10th, 11th, 12th, or combined).
 * 4. Dedicated Dropped Examinee Management Drawer (mark dropped, set reason, audit, restore).
 * 5. 1-Click Exports in Word (.docx), Excel (.xlsx), and Print/PDF.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  FileText, Download, Printer, Users, UserX, UserCheck, Search,
  Filter, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw,
  Building, Award, Hash, Calendar, Layers, ShieldCheck, ChevronDown,
  ChevronUp, Check, X, Sparkles, BookOpen, ExternalLink, HelpCircle
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { updateCachedItem } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import {
  buildJkboseSubjectRollData,
  extractExamineeRollNumber,
  formatRollNumberSeries,
  normalizeExamineeClass,
  CANONICAL_SUBJECT_ORDER
} from '../../utils/jkboseRollSeriesFormatter';
import { isStudentAdmissionApproved, isStudentExamDropped, getAssignedClassRollNumber } from '../../utils/studentApprovalStatus';
import {
  getStudentDisplayName,
  getStudentFatherName,
  getStudentClass,
  getStudentStream,
  getStudentSession,
  isStudentInSession,
  fetchStudentsForSessionOnDemand
} from '../../utils/studentDataFetcher';
import { generateJkboseDocx } from '../../utils/jkboseDocxGenerator';
import { generateJkboseExcel } from '../../utils/jkboseExcelGenerator';
import { printJkboseStatement } from '../../utils/jkbosePdfGenerator';

const COMMON_DROPPED_REASONS = [
  'Attendance shortage',
  'Did not register with board',
  'Fee default / unpaid admission',
  'Discontinued / left institution',
  'Failed institutional pre-board',
  'Medical grounds',
  'Other / administrative reason',
];

export default function JkboseSubjectRollReturnView({
  students = [],
  allStudents = [],
  onClose,
  onDataUpdated,
  user
}) {
  // Session configuration & on-demand fetching
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [onDemandStudents, setOnDemandStudents] = useState([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // View state & configuration
  const [selectedClass, setSelectedClass] = useState('12th'); // '12th' | '11th' | '10th' | 'all'
  const [institutionName, setInstitutionName] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [examName, setExamName] = useState('ANNUAL REGULAR 2026');
  const [centreNo, setCentreNo] = useState('Centre No. 31601');
  const [session, setSession] = useState('Session 2025-26');
  const [rollType, setRollType] = useState('auto'); // 'auto' | 'board' | 'class'

  // Discover all available sessions dynamically
  const availableSessions = useMemo(() => {
    const set = new Set(['2025-26', '2024-25', '2023-24', '2022-23', '2021-22', '2020-21']);
    const pool = [...(students || []), ...(allStudents || [])];
    pool.forEach((s) => {
      const ses = getStudentSession(s);
      if (ses) {
        const clean = ses.replace(/session\s*/i, '').replace(/[\u2013\u2014]/g, '-').trim();
        if (clean) set.add(clean);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [students, allStudents]);

  // Fetch students on demand whenever selectedSession changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingSession(true);
    fetchStudentsForSessionOnDemand(selectedSession)
      .then((records) => {
        if (!isCancelled && Array.isArray(records)) {
          setOnDemandStudents(records);
        }
      })
      .catch((err) => console.warn('On demand session load note:', err))
      .finally(() => {
        if (!isCancelled) setIsLoadingSession(false);
      });
    return () => { isCancelled = true; };
  }, [selectedSession]);

  // Resolves the active dataset for the selected session
  const dataset = useMemo(() => {
    const base = (allStudents && allStudents.length > 0) ? allStudents : (students || []);
    const inMemMatches = base.filter((s) => isStudentInSession(s, selectedSession));

    // Combine in-memory matches with any on-demand fetched records without duplicates
    const combined = [...inMemMatches];
    const seen = new Set(
      inMemMatches.map((s) => String(s.id || s._docId || s.formNo || getAssignedClassRollNumber(s)).toLowerCase())
    );

    onDemandStudents.forEach((st) => {
      const key = String(st.id || st._docId || st.formNo || getAssignedClassRollNumber(st)).toLowerCase();
      if (!seen.has(key) && isStudentInSession(st, selectedSession)) {
        seen.add(key);
        combined.push(st);
      }
    });

    if (combined.length > 0) return combined;
    if (onDemandStudents.length > 0) return onDemandStudents;
    return inMemMatches;
  }, [allStudents, students, selectedSession, onDemandStudents]);

  // Expandable subject details row in live preview table
  const [expandedSubject, setExpandedSubject] = useState(null);

  // Dropped Examinees Drawer state
  const [isDroppedDrawerOpen, setIsDroppedDrawerOpen] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState('all'); // 'all' | 'active' | 'dropped'
  const [drawerSearch, setDrawerSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [savingStudentId, setSavingStudentId] = useState(null);

  // Dropped Reason prompt modal
  const [pendingDropStudent, setPendingDropStudent] = useState(null);
  const [dropReason, setDropReason] = useState(COMMON_DROPPED_REASONS[0]);
  const [customDropReason, setCustomDropReason] = useState('');

  // Toast alert
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  // Compile subject-wise return data
  const returnData = useMemo(() => {
    return buildJkboseSubjectRollData(dataset, { selectedClass, rollType });
  }, [dataset, selectedClass, rollType]);

  const activeClassData = useMemo(() => {
    if (selectedClass === 'all') {
      return returnData.classWiseData['12th'] || Object.values(returnData.classWiseData)[0] || null;
    }
    return returnData.classWiseData[selectedClass] || null;
  }, [returnData, selectedClass]);

  // Overall KPIs
  const aggregateKpis = useMemo(() => {
    let approved = 0;
    let dropped = 0;
    let active = 0;
    let subjectsCount = 0;

    const classesToCount = selectedClass === 'all'
      ? Object.keys(returnData.classWiseData)
      : [selectedClass];

    classesToCount.forEach((cls) => {
      const data = returnData.classWiseData[cls];
      if (data) {
        approved += data.kpis.totalApproved || 0;
        dropped += data.kpis.totalDropped || 0;
        active += data.kpis.activeExaminees || 0;
        subjectsCount += data.subjects.length;
      }
    });

    return { approved, dropped, active, subjectsCount };
  }, [returnData, selectedClass]);

  // Filter students for the Drawer
  const drawerStudents = useMemo(() => {
    return dataset.filter((s) => {
      const normClass = normalizeExamineeClass(getStudentClass(s) || s.appliedClass || s.class || s.enrolledClass || '');
      if (selectedClass !== 'all' && normClass !== selectedClass) return false;
      if (!isStudentAdmissionApproved(s)) return false;

      const isDropped = isStudentExamDropped(s);
      if (drawerFilter === 'active' && isDropped) return false;
      if (drawerFilter === 'dropped' && !isDropped) return false;

      if (drawerSearch.trim()) {
        const q = drawerSearch.trim().toLowerCase();
        const name = getStudentDisplayName(s).toLowerCase();
        const roll = String(getAssignedClassRollNumber(s) || s.rollNo || s.classRollNo || s.examRollNo || '').toLowerCase();
        const reg = String(s.registrationNo || s.boardRegNo || s.regNo || '').toLowerCase();
        const father = getStudentFatherName(s).toLowerCase();
        if (!name.includes(q) && !roll.includes(q) && !reg.includes(q) && !father.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [dataset, selectedClass, drawerFilter, drawerSearch]);

  // Mark a student as dropped or active in Firestore
  const handleToggleExamDropped = async (student, shouldDrop, reasonText = '') => {
    const docId = student.id || student._id || student.docId;
    if (!docId) {
      showToast('error', 'Cannot update student: missing document ID.');
      return;
    }

    setSavingStudentId(docId);
    try {
      const updates = {
        isExamDropped: shouldDrop,
        examStatus: shouldDrop ? 'dropped' : 'active',
        examDroppedReason: shouldDrop ? (reasonText || 'Administrative exclusion') : null,
        examDroppedAt: shouldDrop ? new Date().toISOString() : null,
        examDroppedBy: user?.email || 'admin',
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'admissions', docId), updates);

      // Update local cache
      const updatedStudent = { ...student, ...updates };
      updateCachedItem('admissions', updatedStudent);

      if (onDataUpdated) {
        onDataUpdated(updatedStudent);
      }

      logAdminActivity({
        action: shouldDrop ? 'EXAMINEE_DROPPED' : 'EXAMINEE_RESTORED',
        details: `${shouldDrop ? 'Marked as dropped from exam' : 'Restored to exam return'}: ${student.studentName || docId} (${updates.examDroppedReason || ''})`,
        adminEmail: user?.email || 'admin',
      });

      showToast(
        'success',
        shouldDrop
          ? `🚫 ${student.studentName || 'Student'} marked as dropped from examination.`
          : `✅ ${student.studentName || 'Student'} restored to examination return.`
      );
    } catch (err) {
      console.error('Failed to update student exam dropped status:', err);
      showToast('error', 'Failed to update status: ' + (err.message || err));
    } finally {
      setSavingStudentId(null);
      setPendingDropStudent(null);
    }
  };

  // Bulk mark selected students
  const handleBulkExamStatus = async (shouldDrop) => {
    if (selectedStudentIds.size === 0) return;
    const count = selectedStudentIds.size;
    const confirmMsg = shouldDrop
      ? `Mark ${count} selected student(s) as DROPPED from JKBOSE examination?`
      : `RESTORE ${count} selected student(s) as ACTIVE examinees in JKBOSE examination?`;

    if (!window.confirm(confirmMsg)) return;

    let successCount = 0;
    for (const docId of selectedStudentIds) {
      const student = dataset.find((s) => (s.id || s._id) === docId);
      if (student) {
        try {
          const updates = {
            isExamDropped: shouldDrop,
            examStatus: shouldDrop ? 'dropped' : 'active',
            examDroppedReason: shouldDrop ? 'Bulk status update' : null,
            examDroppedAt: shouldDrop ? new Date().toISOString() : null,
            examDroppedBy: user?.email || 'admin',
            updatedAt: new Date().toISOString(),
          };
          await updateDoc(doc(db, 'admissions', docId), updates);
          updateCachedItem('admissions', { ...student, ...updates });
          successCount++;
        } catch (_) {}
      }
    }

    if (onDataUpdated) onDataUpdated();
    setSelectedStudentIds(new Set());
    showToast('success', `Bulk update complete: ${successCount} student(s) updated.`);
  };

  // Export Handlers
  const handleExportDocx = async () => {
    try {
      showToast('info', 'Generating Word (.docx) document...');
      await generateJkboseDocx({
        classWiseData: returnData.classWiseData,
        selectedClass,
        institutionName,
        examName,
        centreNo,
        session,
      });
      showToast('success', 'Word (.docx) return statement downloaded successfully!');
    } catch (err) {
      showToast('error', 'Word export failed: ' + (err.message || err));
    }
  };

  const handleExportExcel = () => {
    try {
      showToast('info', 'Generating Excel (.xlsx) workbook...');
      generateJkboseExcel({
        classWiseData: returnData.classWiseData,
        selectedClass,
        institutionName,
        examName,
        centreNo,
        session,
      });
      showToast('success', 'Excel (.xlsx) return statement downloaded successfully!');
    } catch (err) {
      showToast('error', 'Excel export failed: ' + (err.message || err));
    }
  };

  const handlePrintPdf = () => {
    try {
      printJkboseStatement({
        classWiseData: returnData.classWiseData,
        selectedClass,
        institutionName,
        examName,
        centreNo,
        session,
      });
    } catch (err) {
      showToast('error', 'Print dispatch failed: ' + (err.message || err));
    }
  };

  return (
    <div className="w-full space-y-4 pb-12 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 max-w-md transition-all ${
          toast.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
            : toast.type === 'info'
            ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200'
        }`}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Top Banner / Module Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all mr-1 cursor-pointer"
                  title="Return to Admin Dashboard"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Official JKBOSE Sub-Office Return
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                Range Compressed ("TO" series)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              JKBOSE Subject-wise Roll Number Statement
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Generates the mandatory institution subject return for JKBOSE examinees. Continuous roll numbers are compressed with <strong>"TO"</strong> and single rolls separated by <strong>Comma</strong>, excluding exam-dropped examinees.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportDocx}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <FileText size={15} />
              <span>Word (.docx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Download size={15} />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer size={15} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Class Selector Bar & Live Parameters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        {/* Class Selection Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
              Select Class:
            </span>
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {[
                { id: '12th', label: 'Class 12th (HSE-II)' },
                { id: '11th', label: 'Class 11th (HSE-I)' },
                { id: '10th', label: 'Class 10th (SSE)' },
                { id: 'all', label: 'All Classes (Classwise)' },
              ].map((tab) => {
                const isSelected = selectedClass === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedClass(tab.id);
                      setExpandedSubject(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs scale-[1.02]'
                        : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dropped Examinees Trigger Button */}
          <button
            type="button"
            onClick={() => setIsDroppedDrawerOpen(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <UserX size={15} />
            <span>Manage Dropped Examinees ({aggregateKpis.dropped})</span>
          </button>
        </div>

        {/* Customizable Return Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Institution Name
            </label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Examination
            </label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Centre Number
            </label>
            <input
              type="text"
              value={centreNo}
              onChange={(e) => setCentreNo(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
              <span>Session</span>
              {isLoadingSession && <span className="text-[9.5px] text-amber-500 animate-pulse font-bold">Syncing…</span>}
            </label>
            <select
              value={selectedSession}
              onChange={(e) => {
                const newSes = e.target.value;
                setSelectedSession(newSes);
                setSession(`Session ${newSes}`);
              }}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {availableSessions.map((ses) => (
                <option key={ses} value={ses}>Session {ses}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Roll No Source
            </label>
            <select
              value={rollType}
              onChange={(e) => setRollType(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="auto">Auto (Board Exam Roll &gt; Class Roll)</option>
              <option value="board">Board Exam Roll No strictly</option>
              <option value="class">Assigned Class Roll No strictly</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
            Approved in {selectedClass === 'all' ? 'All Classes' : `Class ${selectedClass}`}
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {aggregateKpis.approved}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Enrolled institutional students</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Active in Return
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {aggregateKpis.active}
          </div>
          <div className="text-[10px] text-emerald-600/70 mt-0.5">Included in roll series statement</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Dropped from Exam
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {aggregateKpis.dropped}
          </div>
          <div className="text-[10px] text-rose-600/70 mt-0.5">Excluded as per JKBOSE rules</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Subject Returns
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {aggregateKpis.subjectsCount}
          </div>
          <div className="text-[10px] text-indigo-600/70 mt-0.5">Canonical subject mappings</div>
        </div>
      </div>

      {/* Live Statement Table Preview (Official Circular Layout) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Paper Header Preview */}
        <div className="p-5 sm:p-6 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-center space-y-1">
          <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
            {institutionName}
          </h2>
          <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
            SUBJECT-WISE ROLL NUMBER RETURN STATEMENT FOR EXAMINEES
          </div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 pt-1 flex items-center justify-center gap-3 flex-wrap">
            <span>
              <strong>EXAMINATION:</strong> {activeClassData ? activeClassData.label : 'CLASS'} — {examName} ({session})
            </span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
              {centreNo}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 italic pt-1">
            Continuous roll series are separated by <strong>"TO"</strong> & single Roll Numbers by <strong>Comma</strong>. Click any subject row to inspect enrolled student names.
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3.5 text-center w-16">S.No</th>
                <th className="py-3 px-4 w-60">Subject</th>
                <th className="py-3 px-4">Roll Numbers ( separate continuous series by "TO" & single Roll No's by "Comma" )</th>
                <th className="py-3 px-4 text-center w-32">Total Candidates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {(!activeClassData || activeClassData.subjects.length === 0) ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 italic font-medium">
                    No approved examinee data found for {selectedClass === 'all' ? 'the selected classes' : `Class ${selectedClass}`}.
                  </td>
                </tr>
              ) : (
                activeClassData.subjects.map((sub, idx) => {
                  const isExpanded = expandedSubject === sub.subject;
                  return (
                    <React.Fragment key={sub.subject}>
                      <tr
                        onClick={() => setExpandedSubject(isExpanded ? null : sub.subject)}
                        className={`transition-colors cursor-pointer ${
                          isExpanded
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                            : idx % 2 === 0
                            ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            : 'bg-slate-50/30 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-3 px-3.5 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900 dark:text-white flex items-center justify-between">
                          <span>{sub.subject}</span>
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-[11.5px]">
                          {sub.rollNumbersSeries.split(/(TO|, )/g).map((part, pIdx) => {
                            if (part === 'TO') {
                              return (
                                <strong key={pIdx} className="text-indigo-600 dark:text-indigo-400 font-black px-1 underline decoration-indigo-400">
                                  TO
                                </strong>
                              );
                            }
                            return <span key={pIdx}>{part}</span>;
                          })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-full font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {sub.candidateCount}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Inspect Drawer for this subject */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-950/60">
                          <td colSpan={4} className="p-4 border-y border-indigo-100 dark:border-indigo-900/40">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                                <span>Enrolled Examinees in {sub.subject} ({sub.candidateCount} candidates):</span>
                                <span className="text-[10px] text-slate-400 font-normal">Click row to collapse</span>
                              </div>
                              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                                {sub.rawRollNumbers.map((r, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                  >
                                    #{r}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {activeClassData && activeClassData.subjects.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 text-xs font-black">
                  <td colSpan={3} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    TOTAL UNIQUE EXAMINEES IN RETURN:
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {activeClassData.kpis.activeExaminees}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Paper Footer with Signatory Block Preview */}
        <div className="p-6 bg-slate-50/40 dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="font-bold">Verified from Institutional Enrollment Register.</div>
            <div>Date of Return: <strong>{new Date().toLocaleDateString('en-GB')}</strong></div>
          </div>
          <div className="text-right space-y-1 text-xs">
            <div className="font-black text-slate-900 dark:text-white">Principal / Head of Institution</div>
            <div className="font-semibold text-slate-600 dark:text-slate-400">{institutionName}</div>
            <div className="text-[10.5px] text-slate-400 italic pt-4">(Official Seal & Signature)</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DROPPED EXAMINEES MANAGEMENT DRAWER (SLIDE-OVER MODAL)                     */}
      {/* ========================================================================= */}
      {isDroppedDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <UserX size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Examinee Dropped Manager
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Label students who dropped out so they are excluded from JKBOSE returns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDroppedDrawerOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={drawerSearch}
                    onChange={(e) => setDrawerSearch(e.target.value)}
                    placeholder="Search examinee by name, roll no, or father name..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  {drawerSearch && (
                    <button
                      type="button"
                      onClick={() => setDrawerSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedSession}
                    onChange={(e) => {
                      const newSes = e.target.value;
                      setSelectedSession(newSes);
                      setSession(`Session ${newSes}`);
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                    title="Switch Session for Examinee Dropped Manager"
                  >
                    {availableSessions.map((ses) => (
                      <option key={ses} value={ses}>Session {ses}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'active', label: 'Active' },
                      { id: 'dropped', label: 'Dropped' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setDrawerFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          drawerFilter === f.id
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bulk Action Controls */}
              {selectedStudentIds.size > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-200">
                    {selectedStudentIds.size} student(s) selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkExamStatus(true)}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 transition-all cursor-pointer"
                    >
                      Mark Dropped
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkExamStatus(false)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all cursor-pointer"
                    >
                      Restore to Exam
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIds(new Set())}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Students List in Drawer */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {drawerStudents.length === 0 ? (
                <div className="py-16 text-center text-slate-400 italic text-xs">
                  No matching examinees found in {selectedClass === 'all' ? 'any class' : `Class ${selectedClass}`}.
                </div>
              ) : (
                drawerStudents.map((st) => {
                  const sId = st.id || st._id;
                  const isDropped = isStudentExamDropped(st);
                  const isSaving = savingStudentId === sId;
                  const rollNo = extractExamineeRollNumber(st, rollType);
                  const isSelected = selectedStudentIds.has(sId);

                  return (
                    <div
                      key={sId}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isDropped
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/60'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedStudentIds);
                            if (e.target.checked) next.add(sId);
                            else next.delete(sId);
                            setSelectedStudentIds(next);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {getStudentDisplayName(st)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Roll: {rollNo || 'Pending'}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                            <span>F: {getStudentFatherName(st)}</span>
                            <span>•</span>
                            <span>Class: {getStudentClass(st) || st.appliedClass || st.class || 'N/A'}</span>
                            <span>•</span>
                            <span>{getStudentStream(st) || st.stream || 'General'}</span>
                          </div>
                          {isDropped && st.examDroppedReason && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
                              <AlertTriangle size={11} />
                              <span>Reason: {st.examDroppedReason}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Toggle */}
                      <div>
                        {isDropped ? (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleToggleExamDropped(st, false)}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            <UserCheck size={13} />
                            <span>Restore</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => setPendingDropStudent(st)}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            <UserX size={13} />
                            <span>Drop</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">
                Showing <strong className="text-slate-900 dark:text-white font-bold">{drawerStudents.length}</strong> examinee(s) in <span className="text-amber-600 font-bold">Session {selectedSession}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsDroppedDrawerOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PROMPT MODAL: SPECIFY REASON FOR DROPPING EXAMINEE                        */}
      {/* ========================================================================= */}
      {pendingDropStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <UserX size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Drop Student from Examination?
                </h3>
                <p className="text-xs text-slate-500">
                  {pendingDropStudent.studentName || 'Student'} will be excluded from the JKBOSE statement return.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                Select Official Reason:
              </label>
              <select
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
              >
                {COMMON_DROPPED_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {dropReason.includes('Other') && (
                <input
                  type="text"
                  value={customDropReason}
                  onChange={(e) => setCustomDropReason(e.target.value)}
                  placeholder="Specify custom reason..."
                  className="w-full mt-2 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPendingDropStudent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason = dropReason.includes('Other') && customDropReason.trim()
                    ? customDropReason.trim()
                    : dropReason;
                  handleToggleExamDropped(pendingDropStudent, true, finalReason);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all cursor-pointer"
              >
                Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
