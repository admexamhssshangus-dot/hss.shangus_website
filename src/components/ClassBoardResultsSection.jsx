import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Printer, ChevronDown, Check, GraduationCap, Calendar,
  Edit3, Plus, Trash2, RotateCcw, X, CheckCircle2,
  Trophy, Percent, Sparkles, RefreshCw
} from 'lucide-react';
import { BOARD_RESULTS_BY_CLASS, CLASS_10_BOARD_RESULTS, ALL_BOARD_RESULTS } from '../data/classBoardResults';
import {
  fetchAllBoardResults,
  saveBoardResultCohort,
  deleteBoardResultCohort,
  seedDefaultBoardResults
} from '../services/boardResultsService';
import { showToast } from './common/GlobalToast';

const AVAILABLE_CLASSES = [
  { id: '10th', label: 'Class 10th', sub: 'Matriculation' },
  { id: '11th', label: 'Class 11th', sub: 'Higher Sec. Part-I' },
  { id: '12th', label: 'Class 12th', sub: 'Higher Sec. Part-II' },
];

export default function ClassBoardResultsSection({
  className = '',
  defaultClass = '10th',
  isEditable = false,
  userEmail = 'admin'
}) {
  const [selectedClass, setSelectedClass] = useState(defaultClass);
  const [allCohorts, setAllCohorts] = useState(() => ALL_BOARD_RESULTS);
  const [loading, setLoading] = useState(false);

  // Load live cohorts from Cloud Firestore (with fallback to ALL_BOARD_RESULTS)
  const loadCohorts = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const data = await fetchAllBoardResults(force);
      if (Array.isArray(data) && data.length > 0) {
        setAllCohorts(data);
      }
    } catch (err) {
      console.warn('[ClassBoardResultsSection] Using cached/default board results:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCohorts();
  }, [loadCohorts]);

  const classCohorts = useMemo(() => {
    const filtered = allCohorts.filter(c => c.class === selectedClass);
    if (filtered.length > 0) return filtered;
    return BOARD_RESULTS_BY_CLASS[selectedClass] || CLASS_10_BOARD_RESULTS;
  }, [allCohorts, selectedClass]);

  const [selectedCohortId, setSelectedCohortId] = useState(() => classCohorts[0]?.id || '10th-regular-2024-25-oct-nov');
  const [showFullRoster, setShowFullRoster] = useState(false);
  const [rosterFilter, setRosterFilter] = useState('');

  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const classDropdownRef = useRef(null);
  const sessionDropdownRef = useRef(null);

  // Ensure selectedCohortId stays valid when class changes
  useEffect(() => {
    if (!classCohorts.some(c => c.id === selectedCohortId)) {
      if (classCohorts[0]) {
        setSelectedCohortId(classCohorts[0].id);
      }
    }
  }, [classCohorts, selectedCohortId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target)) {
        setIsClassDropdownOpen(false);
      }
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target)) {
        setIsSessionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const cohort = useMemo(() => {
    return classCohorts.find(c => c.id === selectedCohortId) || classCohorts[0];
  }, [classCohorts, selectedCohortId]);

  const handleClassChange = (newClass) => {
    setSelectedClass(newClass);
    const newCohorts = allCohorts.filter(c => c.class === newClass);
    const fallbackCohorts = newCohorts.length > 0 ? newCohorts : (BOARD_RESULTS_BY_CLASS[newClass] || CLASS_10_BOARD_RESULTS);
    setSelectedCohortId(fallbackCohorts[0]?.id || '');
    setShowFullRoster(false);
    setRosterFilter('');
    setIsClassDropdownOpen(false);
  };

  const handlePrint = () => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('clean-print-mode', 'result-table-print-mode');
      window.print();
      setTimeout(() => {
        document.body.classList.remove('clean-print-mode', 'result-table-print-mode');
      }, 1200);
    }
  };

  const filteredRoster = useMemo(() => {
    if (!cohort?.allCandidates) return [];
    if (!rosterFilter.trim()) return cohort.allCandidates;
    const q = rosterFilter.toLowerCase().trim();
    return cohort.allCandidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.rollNo.includes(q) ||
      (c.status && c.status.toLowerCase().includes(q)) ||
      (c.reappearSubjects && c.reappearSubjects.toLowerCase().includes(q))
    );
  }, [cohort, rosterFilter]);

  const [summaryLayout, setSummaryLayout] = useState('multicolumn'); // 'multicolumn' | 'horizontal'

  const multiColumnPairs = useMemo(() => {
    if (!cohort?.indicators) return [];
    const ind = cohort.indicators;

    const findInd = (pattern) => ind.find(i => pattern.test(i.label));

    const appeared = findInd(/appeared/i) || ind[0];
    const passed = findInd(/passed/i) || ind[2] || ind[1];
    const failed = findInd(/failed|reappear/i) || ind[1];
    const distinc = findInd(/distinc/i);
    const firstDiv = findInd(/1st div/i);
    const secondDiv = findInd(/2nd div/i);
    const thirdDiv = findInd(/3rd div/i);
    const overall = findInd(/result|pass percentage/i) || ind.find(i => i.highlight);

    if (appeared && distinc && firstDiv && secondDiv && overall) {
      return [
        { left: appeared, right: distinc },
        { left: passed, right: firstDiv },
        { left: failed, right: secondDiv },
        { left: thirdDiv || { label: 'total 3rd Div', count: '0' }, right: overall }
      ];
    }

    const half = Math.ceil(ind.length / 2);
    const rows = [];
    for (let i = 0; i < half; i++) {
      rows.push({
        left: ind[i],
        right: ind[i + half] || null
      });
    }
    return rows;
  }, [cohort]);

  const hasStreamColumn = selectedClass === '11th' || selectedClass === '12th' || cohort?.class === '11th' || cohort?.class === '12th';

  // ─────────────────────────────────────────────────────────────
  // CMS Edit Modal State & Handlers
  // ─────────────────────────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [savingCohort, setSavingCohort] = useState(false);

  // Add Session Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    session: '2025-26',
    examPeriod: 'Regular 2025-26 (Oct-Nov)',
    title: '',
    appeared: 150,
    passed: 120,
    failed: 30,
    distinction: 50,
    firstDiv: 50,
    secondDiv: 20,
    thirdDiv: 0,
    overallPercent: '80.00%'
  });

  const handleOpenEditModal = () => {
    if (!cohort) return;
    setEditFormData({
      id: cohort.id,
      class: cohort.class || selectedClass,
      session: cohort.session || '2024-25',
      examPeriod: cohort.examPeriod || '',
      title: cohort.title || `${cohort.class} Regular Result ${cohort.session}`,
      schoolName: cohort.schoolName || 'Govt. Higher Secondary School Shangus',
      category: cohort.category || 'Regular',
      appeared: cohort.summaryStats?.appeared ?? 0,
      passed: cohort.summaryStats?.passed ?? 0,
      failed: cohort.summaryStats?.failed ?? 0,
      distinction: cohort.summaryStats?.distinction ?? 0,
      firstDiv: cohort.summaryStats?.firstDiv ?? 0,
      secondDiv: cohort.summaryStats?.secondDiv ?? 0,
      thirdDiv: cohort.summaryStats?.thirdDiv ?? 0,
      overallPercent: cohort.summaryStats?.overallPercent || '0.00%',
      toppers: Array.isArray(cohort.toppers) ? JSON.parse(JSON.stringify(cohort.toppers)) : []
    });
    setIsEditModalOpen(true);
  };

  const handleAutoCalcPercentage = () => {
    if (!editFormData) return;
    const app = Number(editFormData.appeared) || 0;
    const pass = Number(editFormData.passed) || 0;
    const pct = app > 0 ? `${((pass / app) * 100).toFixed(2)}%` : '0.00%';
    setEditFormData(prev => ({ ...prev, overallPercent: pct }));
  };

  const handleAddTopperRow = () => {
    if (!editFormData) return;
    const newTopper = {
      rollNo: '',
      name: '',
      studentName: '',
      parentage: '',
      result: 'Distinc',
      marksObt: 450,
      maxMarks: 500,
      percentage: '90.0%',
      resultMarksDisplay: 'Distinc / 450',
      stream: hasStreamColumn ? 'Science' : 'General',
      grade: 'A1'
    };
    setEditFormData(prev => ({
      ...prev,
      toppers: [...prev.toppers, newTopper]
    }));
  };

  const handleUpdateTopper = (idx, field, val) => {
    if (!editFormData) return;
    const nextToppers = [...editFormData.toppers];
    const current = { ...nextToppers[idx], [field]: val };

    // Auto-update percentage and resultMarksDisplay when marks change
    if (field === 'marksObt' || field === 'maxMarks') {
      const obt = field === 'marksObt' ? Number(val) || 0 : Number(current.marksObt) || 0;
      const max = field === 'maxMarks' ? Number(val) || 500 : Number(current.maxMarks) || 500;
      const pct = max > 0 ? `${((obt / max) * 100).toFixed(1)}%` : '0.0%';
      current.percentage = pct;
      current.resultMarksDisplay = `${current.result || 'Distinc'} / ${obt}`;
      if (obt >= 450) current.grade = 'A1';
      else if (obt >= 400) current.grade = 'A2';
      else if (obt >= 350) current.grade = 'B1';
      else current.grade = 'B2';
    }

    if (field === 'result') {
      current.resultMarksDisplay = `${val || 'Distinc'} / ${current.marksObt || 0}`;
    }

    nextToppers[idx] = current;
    setEditFormData(prev => ({ ...prev, toppers: nextToppers }));
  };

  const handleRemoveTopper = (idx) => {
    if (!editFormData) return;
    setEditFormData(prev => ({
      ...prev,
      toppers: prev.toppers.filter((_, i) => i !== idx)
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editFormData) return;
    setSavingCohort(true);
    try {
      const saved = await saveBoardResultCohort(editFormData, userEmail);
      setAllCohorts(prev => {
        const idx = prev.findIndex(c => c.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      showToast('JKBOSE Board Results Statement saved successfully!', 'success');
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to save board result cohort:', err);
      showToast('Could not save results statement: ' + (err.message || 'Error'), 'error');
    } finally {
      setSavingCohort(false);
    }
  };

  // Add New Session
  const handleOpenAddModal = () => {
    setNewSessionData({
      session: '2025-26',
      examPeriod: `Regular 2025-26 (Oct-Nov)`,
      title: `${selectedClass} Regular Result 2025-26 (Oct-Nov)`,
      appeared: 100,
      passed: 80,
      failed: 20,
      distinction: 35,
      firstDiv: 35,
      secondDiv: 10,
      thirdDiv: 0,
      overallPercent: '80.00%'
    });
    setIsAddModalOpen(true);
  };

  const handleSaveNewSession = async (e) => {
    e.preventDefault();
    setSavingCohort(true);
    try {
      const slug = `${selectedClass}-${newSessionData.session.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
      const payload = {
        id: slug,
        class: selectedClass,
        session: newSessionData.session,
        examPeriod: newSessionData.examPeriod,
        title: newSessionData.title || `${selectedClass} Regular Result ${newSessionData.session}`,
        schoolName: 'Govt. Higher Secondary School Shangus',
        category: 'Regular',
        summaryStats: {
          appeared: Number(newSessionData.appeared) || 0,
          totalEnrolled: Number(newSessionData.appeared) || 0,
          passed: Number(newSessionData.passed) || 0,
          failed: Number(newSessionData.failed) || 0,
          distinction: Number(newSessionData.distinction) || 0,
          firstDiv: Number(newSessionData.firstDiv) || 0,
          secondDiv: Number(newSessionData.secondDiv) || 0,
          thirdDiv: Number(newSessionData.thirdDiv) || 0,
          overallPercent: newSessionData.overallPercent || '0.00%'
        },
        toppers: []
      };

      const saved = await saveBoardResultCohort(payload, userEmail);
      setAllCohorts(prev => [saved, ...prev]);
      setSelectedCohortId(saved.id);
      showToast(`Added examination session ${newSessionData.examPeriod}!`, 'success');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to create new session cohort:', err);
      showToast('Failed to create session: ' + err.message, 'error');
    } finally {
      setSavingCohort(false);
    }
  };

  // Delete Cohort
  const handleDeleteCohort = async () => {
    if (!cohort) return;
    if (classCohorts.length <= 1) {
      alert('Cannot delete the only remaining session for this class.');
      return;
    }
    if (!window.confirm(`Delete board result session "${cohort.examPeriod}"? This will remove its indicators and toppers ledger.`)) {
      return;
    }

    try {
      await deleteBoardResultCohort(cohort.id);
      setAllCohorts(prev => prev.filter(c => c.id !== cohort.id));
      showToast(`Session "${cohort.examPeriod}" deleted.`, 'info');
    } catch (err) {
      console.error('Failed to delete cohort:', err);
      showToast('Could not delete session: ' + err.message, 'error');
    }
  };

  // Restore Defaults
  const handleRestoreDefaults = async () => {
    if (!window.confirm('Restore official JKBOSE board examination cohorts into Cloud Firestore? Any manual edits will be reset to default institutional records.')) {
      return;
    }
    setLoading(true);
    try {
      const seeded = await seedDefaultBoardResults(true);
      setAllCohorts(seeded);
      showToast('Official JKBOSE board templates restored successfully!', 'success');
    } catch (err) {
      console.error('Failed to restore defaults:', err);
      showToast('Failed to restore defaults: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto font-sans ${className}`}>
      {/* Side-by-Side Class & Session Dropdowns */}
      <div className="grid grid-cols-2 gap-2 mb-2 print-hide w-full">
        {/* Class Dropdown */}
        <div className="relative" ref={classDropdownRef}>
          <button
            type="button"
            id="class-selector-dropdown-btn"
            aria-haspopup="listbox"
            aria-expanded={isClassDropdownOpen}
            onClick={() => {
              setIsClassDropdownOpen(prev => !prev);
              setIsSessionDropdownOpen(false);
            }}
            className={`w-full h-9 px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between gap-1 shadow-2xs transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500 ${
              isClassDropdownOpen
                ? 'bg-slate-50 dark:bg-slate-800 border-teal-700 dark:border-teal-500 ring-1 ring-teal-500/30'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-500 text-slate-900 dark:text-slate-100'
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0 truncate">
              <GraduationCap size={14} className="text-teal-700 dark:text-teal-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hidden xs:inline shrink-0">Class:</span>
              <span className="font-extrabold truncate text-slate-950 dark:text-white">Class {selectedClass}</span>
            </span>
            <ChevronDown
              size={13}
              className={`text-slate-600 dark:text-slate-400 shrink-0 transition-transform duration-200 ${isClassDropdownOpen ? 'rotate-180 text-teal-700' : ''}`}
            />
          </button>

          {isClassDropdownOpen && (
            <div
              role="listbox"
              aria-label="Select Class"
              className="absolute left-0 top-full mt-1 w-full min-w-[170px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl z-40 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                Select Class
              </div>
              {AVAILABLE_CLASSES.map((cls) => {
                const isSelected = selectedClass === cls.id;
                return (
                  <button
                    key={cls.id}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => handleClassChange(cls.id)}
                    className={`w-full px-2.5 py-2 text-left text-xs flex items-center gap-2.5 hover:bg-teal-50/80 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isSelected ? 'bg-teal-50 dark:bg-slate-800/90 font-bold text-teal-950 dark:text-teal-200' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-teal-700 border-teal-700 text-white shadow-2xs'
                          : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3.2} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate leading-snug font-semibold">{cls.label}</span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate">{cls.sub}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Session Dropdown */}
        <div className="relative" ref={sessionDropdownRef}>
          <button
            type="button"
            id="session-selector-dropdown-btn"
            aria-haspopup="listbox"
            aria-expanded={isSessionDropdownOpen}
            onClick={() => {
              setIsSessionDropdownOpen(prev => !prev);
              setIsClassDropdownOpen(false);
            }}
            className={`w-full h-9 px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between gap-1 shadow-2xs transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500 ${
              isSessionDropdownOpen
                ? 'bg-slate-50 dark:bg-slate-800 border-teal-700 dark:border-teal-500 ring-1 ring-teal-500/30'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-500 text-slate-900 dark:text-slate-100'
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0 truncate">
              <Calendar size={14} className="text-teal-700 dark:text-teal-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hidden xs:inline shrink-0">Session:</span>
              <span className="font-extrabold truncate text-slate-950 dark:text-white">{cohort?.examPeriod || 'Select Session'}</span>
            </span>
            <ChevronDown
              size={13}
              className={`text-slate-600 dark:text-slate-400 shrink-0 transition-transform duration-200 ${isSessionDropdownOpen ? 'rotate-180 text-teal-700' : ''}`}
            />
          </button>

          {isSessionDropdownOpen && (
            <div
              role="listbox"
              aria-label="Select Examination Session"
              className="absolute right-0 top-full mt-1 w-full min-w-[220px] sm:min-w-[260px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl z-40 py-1 overflow-hidden max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span>Select Examination Session</span>
                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">{classCohorts.length} sessions</span>
              </div>
              {classCohorts.map((item) => {
                const isSelected = item.id === cohort?.id;
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => {
                      setSelectedCohortId(item.id);
                      setShowFullRoster(false);
                      setRosterFilter('');
                      setIsSessionDropdownOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 text-left text-xs flex items-center gap-2.5 hover:bg-teal-50/80 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isSelected ? 'bg-teal-50 dark:bg-slate-800/90 font-bold text-teal-950 dark:text-teal-200' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-teal-700 border-teal-700 text-white shadow-2xs'
                          : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3.2} />}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate leading-snug font-semibold">{item.examPeriod}</span>
                      {item.summaryStats?.overallPercent && (
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-2">
                          <span>Pass: <strong className="text-emerald-800 dark:text-emerald-300 font-bold">{item.summaryStats.overallPercent}</strong></span>
                          <span>Appeared: {item.summaryStats.appeared}</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Admin Live Sync & Reset Bar (When in Editable Mode) */}
      {isEditable && (
        <div className="flex items-center justify-between text-[11px] mb-2 px-1 text-slate-500 dark:text-slate-400 print-hide">
          <span className="flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Editable Board Results • Backed by Firestore</span>
          </span>
          <button
            type="button"
            onClick={handleRestoreDefaults}
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer text-[10.5px] disabled:opacity-50"
            title="Restore official default board cohorts if needed"
          >
            <RotateCcw size={10} className={loading ? 'animate-spin' : ''} />
            <span>Reset Defaults</span>
          </button>
        </div>
      )}

      {/* Official Table Card */}
      <div className="printable-result-sheet bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 sm:p-5 shadow-2xs">
        
        {/* Print-Only Official Letterhead Header */}
        <div className="print-only text-center mb-4 pb-2 border-b-2 border-slate-800">
          <h2 className="text-base font-extrabold tracking-tight uppercase text-black">
            Government Higher Secondary School Shangus, Anantnag
          </h2>
          <p className="text-[11px] font-semibold text-slate-700">
            Office of the Academic Examination Committee • Jammu &amp; Kashmir Board of School Education (JKBOSE)
          </p>
          <div className="mt-1.5 inline-block px-3 py-0.5 border border-black rounded text-[11px] font-bold text-black uppercase">
            Official Board Examination Performance Statement &amp; Gazette Summary
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-800 px-1">
            <span><strong>Class:</strong> {cohort?.class}</span>
            <span><strong>Session / Cohort:</strong> {cohort?.examPeriod}</span>
            <span><strong>Institution:</strong> {cohort?.schoolName}</span>
            <span><strong>Date of Print:</strong> {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {/* Action Header on Screen */}
        <div className="flex items-center justify-between gap-1.5 mb-2.5 border-b border-slate-200 dark:border-slate-800 pb-2 print-hide">
          <div className="text-left min-w-0">
            <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block leading-none">
              Gazette Statement
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
              Class {cohort?.class} • {cohort?.examPeriod}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {/* Multi-Column / Horizontal Layout Switcher */}
            <div className="inline-flex p-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setSummaryLayout('multicolumn')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  summaryLayout === 'multicolumn'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Multi-column structured table (2×4)"
              >
                Columns
              </button>
              <button
                type="button"
                onClick={() => setSummaryLayout('horizontal')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  summaryLayout === 'horizontal'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Horizontal gazette summary"
              >
                Row
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
              title="Print clean official result sheet"
            >
              <Printer size={12} />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* CMS Edit Controls (When Editable) */}
            {isEditable && (
              <>
                <button
                  type="button"
                  id="edit-board-result-btn"
                  onClick={handleOpenEditModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-teal-800 hover:bg-teal-700 text-white shadow-2xs transition-colors cursor-pointer"
                  title="Edit statistics, counts, pass percentage and toppers"
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  id="add-board-session-btn"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                  title="Add new board exam session cohort"
                >
                  <Plus size={12} />
                  <span className="hidden md:inline">Add Session</span>
                </button>

                {classCohorts.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeleteCohort}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete current examination session cohort"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Header Title Section on Screen */}
        <div className="text-center mb-2.5">
          <h3 className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-500 tracking-tight">
            {cohort?.title}
          </h3>
          <div className="mt-0.5 inline-block bg-[#d1f2d9] dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded">
            <h4 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-emerald-200">
              {cohort?.schoolName}
            </h4>
          </div>
        </div>

        {/* Indicators Table (Multi-Column Structure or Horizontal Gazette) */}
        {summaryLayout === 'multicolumn' ? (
          <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded mb-4">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  <th className="py-1.5 px-3 font-bold w-[34%]">Category / Indicator</th>
                  <th className="py-1.5 px-3 font-bold text-right w-[16%]">Count</th>
                  <th className="py-1.5 px-3 font-bold w-[34%] border-l border-slate-300 dark:border-slate-700">Category / Indicator</th>
                  <th className="py-1.5 px-3 font-bold text-right w-[16%]">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {multiColumnPairs.map((pair, idx) => {
                  const leftHighlight = pair.left?.highlight;
                  const rightHighlight = pair.right?.highlight;
                  return (
                    <tr
                      key={idx}
                      className={idx % 2 === 1 ? 'bg-[#f4faf5]/70 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'}
                    >
                      {/* Left Column Pair */}
                      <td className={`py-1.5 px-3 ${leftHighlight ? 'font-bold text-slate-900 dark:text-white bg-[#d1f2d9] dark:bg-emerald-950/80' : ''}`}>
                        {pair.left?.label || '—'}
                      </td>
                      <td className={`py-1.5 px-3 text-right font-mono ${leftHighlight ? 'font-black text-red-700 dark:text-red-400 text-sm bg-[#d1f2d9] dark:bg-emerald-950/80' : 'font-semibold'}`}>
                        {pair.left?.count ?? '—'}
                      </td>

                      {/* Right Column Pair */}
                      <td className={`py-1.5 px-3 border-l border-slate-300 dark:border-slate-700 ${rightHighlight ? 'font-bold text-slate-900 dark:text-white bg-[#d1f2d9] dark:bg-emerald-950/80' : ''}`}>
                        {pair.right?.label || '—'}
                      </td>
                      <td className={`py-1.5 px-3 text-right font-mono ${rightHighlight ? 'font-black text-red-700 dark:text-red-400 text-sm bg-[#d1f2d9] dark:bg-emerald-950/80' : 'font-semibold'}`}>
                        {pair.right?.count ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded mb-4">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap">
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Appeared</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Passed</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Reappear</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Distinction</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">1st Div</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">2nd Div</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">3rd Div</th>
                  <th className="py-2 px-2 bg-[#d1f2d9] dark:bg-emerald-950/80 text-slate-900 dark:text-emerald-100 font-bold">Overall Result</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-slate-200">
                <tr className="font-mono text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900">
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort?.summaryStats?.appeared ?? 0}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-bold">{cohort?.summaryStats?.passed ?? 0}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400">{cohort?.summaryStats?.failed ?? 0}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort?.summaryStats?.distinction ?? 0}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort?.summaryStats?.firstDiv ?? 0}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort?.summaryStats?.secondDiv ?? 0}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort?.summaryStats?.thirdDiv ?? 0}</td>
                  <td className="py-2 px-2 bg-[#d1f2d9] dark:bg-emerald-950/80 text-red-600 dark:text-red-400 font-black text-sm sm:text-base">
                    {cohort?.summaryStats?.overallPercent || '0.00%'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* School Toppers Subsection */}
        {cohort?.toppers && cohort.toppers.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h4 className="text-center text-xs sm:text-sm font-bold text-red-600 dark:text-red-500">
                School toppers
              </h4>
              {isEditable && (
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="text-[10px] text-teal-700 dark:text-teal-400 underline font-semibold cursor-pointer print-hide"
                >
                  (Edit toppers)
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#9ca3af] dark:bg-slate-700 text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-600 font-bold">
                    <th className="py-1.5 px-2.5">Exam Roll No.</th>
                    <th className="py-1.5 px-2.5">
                      {cohort.id === '11th-regular-2024-25-mar-apr' ? 'Name (Parentage)' : 'Name'}
                    </th>
                    {hasStreamColumn ? (
                      <>
                        <th className="py-1.5 px-2.5 text-center">Result / Marks Obt.</th>
                        <th className="py-1.5 px-2.5 text-center">Stream</th>
                      </>
                    ) : (
                      <>
                        <th className="py-1.5 px-2 text-center">Result</th>
                        <th className="py-1.5 px-2.5 text-right">Marks Obt.</th>
                        <th className="py-1.5 px-2 text-center">Grade</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {cohort.toppers.map((t, idx) => (
                    <tr
                      key={t.rollNo || idx}
                      className={idx % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}
                    >
                      <td className="py-1.5 px-2.5 font-mono font-medium">{t.rollNo}</td>
                      <td className="py-1.5 px-2.5 font-semibold">
                        {t.parentage ? `${t.name || t.studentName} (${t.parentage})` : (t.name || t.studentName)}
                      </td>
                      {hasStreamColumn ? (
                        <>
                          <td className="py-1.5 px-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                            {t.resultMarksDisplay || `${t.result} / ${t.marksObt}`}
                          </td>
                          <td className="py-1.5 px-2.5 text-center font-medium text-slate-700 dark:text-slate-300">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                              {t.stream === 'Medical' ? 'Science' : t.stream}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 px-2 text-center font-medium">{t.result}</td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold">{t.marksObt}</td>
                          <td className="py-1.5 px-2 text-center font-semibold">{t.grade || '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Optional Gazette Roster Toggle */}
        {cohort?.allCandidates && cohort.allCandidates.length > 0 && (
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs print-hide">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFullRoster(!showFullRoster)}
                className="font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
              >
                {showFullRoster ? 'Hide all candidates' : `View all ${cohort.allCandidates.length} candidates roster`}
              </button>
            </div>

            {showFullRoster && (
              <div className="mt-2.5 space-y-2">
                <input
                  type="text"
                  value={rosterFilter}
                  onChange={(e) => setRosterFilter(e.target.value)}
                  placeholder="Filter by name, roll no, or reappear subjects..."
                  className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-500"
                />

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded max-h-72 overflow-y-auto">
                  <table className="w-full text-[11.5px] text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                      <tr>
                        <th className="py-1 px-2">#</th>
                        <th className="py-1 px-2">Roll No.</th>
                        <th className="py-1 px-2">Name</th>
                        <th className="py-1 px-2 text-center">Status</th>
                        <th className="py-1 px-2 text-right">Marks</th>
                        <th className="py-1 px-2 text-center">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {filteredRoster.map((c, i) => (
                        <tr key={c.rollNo} className={!c.status.startsWith('Qualified') ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                          <td className="py-1 px-2 text-slate-400">{i + 1}</td>
                          <td className="py-1 px-2 font-mono">{c.rollNo}</td>
                          <td className="py-1 px-2 font-medium">{c.name}</td>
                          <td className="py-1 px-2 text-center">{c.status}</td>
                          <td className="py-1 px-2 text-right font-mono">{c.marks ?? '—'}</td>
                          <td className="py-1 px-2 text-center text-[10.5px] text-slate-500">
                            {c.reappearSubjects ? `Reappear: ${c.reappearSubjects}` : c.division}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Print-Only Official Endorsement Signatures */}
        <div className="print-only mt-8 pt-4 border-t border-slate-400">
          <div className="flex justify-between items-end text-xs font-semibold text-black px-6 pt-10">
            <div className="text-center">
              <div className="w-36 border-t border-black mb-1"></div>
              <span>Incharge Examination</span>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 border border-dashed border-slate-400 rounded-full flex items-center justify-center text-[9px] text-slate-500 mb-2 mx-auto">
                Official Seal
              </div>
            </div>
            <div className="text-center">
              <div className="w-36 border-t border-black mb-1"></div>
              <span>Principal / Head of Institution</span>
            </div>
          </div>
          <p className="text-[9.5px] text-center text-slate-600 mt-4">
            Official Institutional Record • Govt. Higher Secondary School Shangus, Anantnag • Verified Against Official JKBOSE Gazette
          </p>
        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* EDIT COHORT STATEMENT & TOPPERS MODAL                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isEditModalOpen && editFormData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3.5 my-auto max-h-[92vh] overflow-y-auto text-xs text-slate-800 dark:text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Edit Board Results Statement &amp; Toppers
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Class {editFormData.class} • {editFormData.examPeriod}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              
              {/* 1. Session Information */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block">
                  1. Examination Session Details
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Exam Period Label
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.examPeriod}
                      onChange={(e) => setEditFormData({ ...editFormData, examPeriod: e.target.value })}
                      placeholder="e.g. Regular 2024–25 (Oct–Nov)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Academic Session
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.session}
                      onChange={(e) => setEditFormData({ ...editFormData, session: e.target.value })}
                      placeholder="e.g. 2024-25"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Headline Title
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      placeholder="e.g. 12th Regular Result 2024-25"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Gazette Indicators (2x4 Matrix) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block">
                    2. Institutional Gazette Performance Statistics (Counts)
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoCalcPercentage}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                  >
                    <Percent size={11} />
                    <span>Auto-calc Pass %</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Total Appeared
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.appeared}
                      onChange={(e) => setEditFormData({ ...editFormData, appeared: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      Total Passed
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.passed}
                      onChange={(e) => setEditFormData({ ...editFormData, passed: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-rose-700 dark:text-rose-400 mb-1">
                      Failed / Reappear
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.failed}
                      onChange={(e) => setEditFormData({ ...editFormData, failed: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-rose-700 dark:text-rose-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Total Distinctions
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.distinction}
                      onChange={(e) => setEditFormData({ ...editFormData, distinction: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Total 1st Division
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.firstDiv}
                      onChange={(e) => setEditFormData({ ...editFormData, firstDiv: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Total 2nd Division
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.secondDiv}
                      onChange={(e) => setEditFormData({ ...editFormData, secondDiv: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Total 3rd Division
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.thirdDiv}
                      onChange={(e) => setEditFormData({ ...editFormData, thirdDiv: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-red-700 dark:text-red-400 mb-1">
                      Pass Percentage
                    </label>
                    <input
                      type="text"
                      value={editFormData.overallPercent}
                      onChange={(e) => setEditFormData({ ...editFormData, overallPercent: e.target.value })}
                      placeholder="e.g. 67.61%"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 font-mono text-xs font-black text-red-700 dark:text-red-400"
                    />
                  </div>
                </div>
              </div>

              {/* 3. School Toppers List Management */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={13} className="text-amber-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                      3. School Toppers Merit Ledger ({editFormData.toppers.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTopperRow}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-800 hover:bg-teal-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Topper</span>
                  </button>
                </div>

                {editFormData.toppers.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                    No school toppers entered for this cohort yet. Click &quot;Add Topper&quot; above to add rank holders.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {editFormData.toppers.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <span className="font-bold text-[11px] text-teal-800 dark:text-teal-300">
                            #{idx + 1} Merit Position
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTopper(idx)}
                            className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                            title="Remove this topper"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Exam Roll No</label>
                            <input
                              type="text"
                              value={t.rollNo}
                              onChange={(e) => handleUpdateTopper(idx, 'rollNo', e.target.value)}
                              placeholder="e.g. 301003054"
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Student Name</label>
                            <input
                              type="text"
                              value={t.name || t.studentName}
                              onChange={(e) => handleUpdateTopper(idx, 'name', e.target.value)}
                              placeholder="e.g. Hadeeqa Tabasum"
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Parentage (Optional)</label>
                            <input
                              type="text"
                              value={t.parentage || ''}
                              onChange={(e) => handleUpdateTopper(idx, 'parentage', e.target.value)}
                              placeholder="Father&apos;s Name"
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Marks Obtained</label>
                            <input
                              type="number"
                              value={t.marksObt}
                              onChange={(e) => handleUpdateTopper(idx, 'marksObt', e.target.value)}
                              placeholder="493"
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Max Marks</label>
                            <input
                              type="number"
                              value={t.maxMarks || 500}
                              onChange={(e) => handleUpdateTopper(idx, 'maxMarks', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Result / Rank</label>
                            <input
                              type="text"
                              value={t.result}
                              onChange={(e) => handleUpdateTopper(idx, 'result', e.target.value)}
                              placeholder="Distinc / UT 8th"
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Stream</label>
                            <select
                              value={t.stream || 'Science'}
                              onChange={(e) => handleUpdateTopper(idx, 'stream', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-medium"
                            >
                              <option value="Science">Science</option>
                              <option value="Humanities/Arts">Humanities / Arts</option>
                              <option value="Commerce">Commerce</option>
                              <option value="Home Science">Home Science</option>
                              <option value="General">General</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingCohort}
                  className="px-4 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white font-black shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                >
                  {savingCohort ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Save &amp; Update Ledger</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ADD NEW EXAMINATION SESSION MODAL                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3.5 my-auto max-h-[92vh] overflow-y-auto text-xs text-slate-800 dark:text-slate-100">
            
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Add Examination Session Cohort
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Create a new results session for Class {selectedClass}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveNewSession} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    required
                    value={newSessionData.session}
                    onChange={(e) => setNewSessionData({ ...newSessionData, session: e.target.value })}
                    placeholder="2025-26"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Exam Period Label
                  </label>
                  <input
                    type="text"
                    required
                    value={newSessionData.examPeriod}
                    onChange={(e) => setNewSessionData({ ...newSessionData, examPeriod: e.target.value })}
                    placeholder="Regular 2025-26 (Oct-Nov)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Headline Title
                </label>
                <input
                  type="text"
                  required
                  value={newSessionData.title}
                  onChange={(e) => setNewSessionData({ ...newSessionData, title: e.target.value })}
                  placeholder={`Class ${selectedClass} Regular Result 2025-26`}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">Appeared</label>
                  <input
                    type="number"
                    min="0"
                    value={newSessionData.appeared}
                    onChange={(e) => setNewSessionData({ ...newSessionData, appeared: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-semibold text-emerald-700 mb-1">Passed</label>
                  <input
                    type="number"
                    min="0"
                    value={newSessionData.passed}
                    onChange={(e) => setNewSessionData({ ...newSessionData, passed: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-semibold text-rose-700 mb-1">Failed</label>
                  <input
                    type="number"
                    min="0"
                    value={newSessionData.failed}
                    onChange={(e) => setNewSessionData({ ...newSessionData, failed: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-rose-700"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-semibold text-red-700 mb-1">Pass %</label>
                  <input
                    type="text"
                    value={newSessionData.overallPercent}
                    onChange={(e) => setNewSessionData({ ...newSessionData, overallPercent: e.target.value })}
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-black text-red-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingCohort}
                  className="px-4 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white font-black shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                >
                  {savingCohort ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Create Session</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
