// =================================================================
// HSS SHANGUS — Custom Student Roster & Document Builder Suite
// =================================================================
// Allows teachers and administrators to filter any cohort of students,
// select arbitrary database fields, add temporary/ad-hoc custom columns
// (fees, signatures, remarks), adjust row heights and column widths,
// and export directly to Word (.docx), Print/PDF, Excel (.xlsx), and CSV.
// =================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Printer, FileText, FileSpreadsheet, Download, Plus, Trash2,
  ChevronLeft, ChevronRight, Sliders, CheckSquare, Square,
  Layers, Check, Sparkles, AlertCircle, FilePlus, Eye, Settings2, RefreshCw, User
} from 'lucide-react';
import { generateCustomRosterDocx } from '../../utils/customRosterDocxGenerator';
import {
  printCustomRosterTable,
  exportCustomRosterExcel,
  exportCustomRosterCsv
} from '../../utils/customRosterExportUtils';
import { getStudentPhotoUrl } from '../../utils/imageCompressor';

// Standard Available Database Fields
const AVAILABLE_DB_COLUMNS = [
  { key: 'sno', label: 'S.No.', defaultSelected: true, defaultWidthPct: 5, align: 'center' },
  { key: 'studentPhoto', label: 'Photo', defaultSelected: false, defaultWidthPct: 8, align: 'center' },
  { key: 'classRollNo', label: 'R.No.', defaultSelected: true, defaultWidthPct: 7, align: 'center' },
  { key: 'boardRegNo', label: 'Reg. No.', defaultSelected: true, defaultWidthPct: 12, align: 'left' },
  { key: 'admNo', label: 'Adm. No.', defaultSelected: false, defaultWidthPct: 8, align: 'center' },
  { key: 'studentName', label: "Student's Name", defaultSelected: true, defaultWidthPct: 18, align: 'left' },
  { key: 'fatherName', label: "Parentage / Father's Name", defaultSelected: true, defaultWidthPct: 18, align: 'left' },
  { key: 'motherName', label: "Mother's Name", defaultSelected: false, defaultWidthPct: 15, align: 'left' },
  { key: 'gender', label: 'Gender', defaultSelected: false, defaultWidthPct: 6, align: 'center' },
  { key: 'dob', label: 'DOB', defaultSelected: false, defaultWidthPct: 10, align: 'center' },
  { key: 'className', label: 'Class', defaultSelected: false, defaultWidthPct: 7, align: 'center' },
  { key: 'session', label: 'Session', defaultSelected: false, defaultWidthPct: 9, align: 'center' },
  { key: 'stream', label: 'Stream', defaultSelected: false, defaultWidthPct: 10, align: 'center' },
  { key: 'subjects', label: 'Stream & Subjects', defaultSelected: true, defaultWidthPct: 22, align: 'left' },
  { key: 'mobile', label: 'Mobile No.', defaultSelected: false, defaultWidthPct: 12, align: 'center' },
  { key: 'aadhaarNo', label: 'Aadhaar / PEN', defaultSelected: false, defaultWidthPct: 12, align: 'center' },
  { key: 'village', label: 'Village / Address', defaultSelected: false, defaultWidthPct: 12, align: 'left' },
  { key: 'category', label: 'Social Category', defaultSelected: false, defaultWidthPct: 9, align: 'center' },
  { key: 'status', label: 'Status', defaultSelected: false, defaultWidthPct: 8, align: 'center' }
];

// Quick Custom Column Templates
const QUICK_CUSTOM_TEMPLATES = [
  { name: 'Exam Fee', defaultValue: '₹500', widthPct: 10, align: 'center' },
  { name: 'ID Card Fee', defaultValue: '₹100', widthPct: 10, align: 'center' },
  { name: 'Admission Fee', defaultValue: '₹1,000', widthPct: 10, align: 'center' },
  { name: 'Practical Fee', defaultValue: '₹200', widthPct: 10, align: 'center' },
  { name: 'Excursion Fee', defaultValue: '₹350', widthPct: 10, align: 'center' },
  { name: 'Student Signature', defaultValue: '', widthPct: 14, align: 'center' },
  { name: 'Parent Signature', defaultValue: '', widthPct: 14, align: 'center' },
  { name: 'Receipt No.', defaultValue: '', widthPct: 10, align: 'center' },
  { name: 'Remarks', defaultValue: '', widthPct: 12, align: 'left' }
];

// Row Height Presets (in px and dxa)
const ROW_HEIGHT_PRESETS = [
  { label: 'Compact', px: 26, dxa: 300, desc: 'Maximum students per page' },
  { label: 'Standard', px: 36, dxa: 450, desc: 'Balanced standard readability' },
  { label: 'Signature / Writing', px: 52, dxa: 650, desc: 'Ideal for pen signatures & fee notes' },
  { label: 'Spacious Writing', px: 68, dxa: 850, desc: 'Ample blank space for manual records' }
];

export default function CustomRosterBuilderModal({
  isOpen,
  onClose,
  allStudents = [],
  availableSessions = []
}) {
  // ─── Filter States ───
  const [selectedSession, setSelectedSession] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [selectedGender, setSelectedGender] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [useAbbreviatedSubjects, setUseAbbreviatedSubjects] = useState(true);

  // ─── Document Layout & Header States ───
  const [docTitle, setDocTitle] = useState('STUDENT RECORD & FEE COLLECTION SHEET');
  const [docSubtitle, setDocSubtitle] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [selectedRowHeightIdx, setSelectedRowHeightIdx] = useState(2); // Default to Signature / Writing (52px)
  const [signatories, setSignatories] = useState(['Class Incharge', 'Dealing Assistant', 'Principal']);

  // ─── Column Configuration ───
  const [selectedCols, setSelectedCols] = useState(() => {
    return AVAILABLE_DB_COLUMNS.filter(c => c.defaultSelected).map(c => ({
      key: c.key,
      label: c.label,
      widthPct: c.defaultWidthPct,
      align: c.align,
      isCustom: false
    }));
  });

  const [customCols, setCustomCols] = useState([
    { key: 'custom_exam_fee', label: 'Exam Fee', defaultValue: '₹500', widthPct: 10, align: 'center', isCustom: true },
    { key: 'custom_signature', label: 'Student Signature', defaultValue: '', widthPct: 14, align: 'center', isCustom: true }
  ]);

  const [newColName, setNewColName] = useState('');
  const [newColDefaultVal, setNewColDefaultVal] = useState('');
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Real Dynamic Filter Options Derived from Database Records ───
  const dynamicSessions = useMemo(() => {
    const counts = {};
    allStudents.forEach(st => {
      const s = String(st.session || st.Session || '').trim();
      if (s && s !== '—') counts[s] = (counts[s] || 0) + 1;
    });
    const list = Object.keys(counts).sort().reverse();
    return list.map(sess => ({ value: sess, label: `${sess} (${counts[sess]})` }));
  }, [allStudents]);

  const dynamicClasses = useMemo(() => {
    const counts = {};
    allStudents.forEach(st => {
      const cls = String(st.className || st.class || st.Class || st['Admission sought for class'] || '').trim();
      if (cls && cls !== '—') counts[cls] = (counts[cls] || 0) + 1;
    });
    const order = ['9th', '10th', '11th', '12th'];
    const list = Object.keys(counts).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
    return list.map(cls => ({ value: cls, label: `Class ${cls} (${counts[cls]})` }));
  }, [allStudents]);

  const dynamicStreams = useMemo(() => {
    const counts = {};
    allStudents.forEach(st => {
      const stm = String(st.stream || st.Stream || '').trim();
      if (stm && stm !== '—') counts[stm] = (counts[stm] || 0) + 1;
    });
    const list = Object.keys(counts).sort();
    return list.map(stm => ({ value: stm, label: `${stm} (${counts[stm]})` }));
  }, [allStudents]);

  const dynamicStatuses = useMemo(() => {
    const counts = {};
    allStudents.forEach(st => {
      const stat = String(st.status || st.Status || 'Submitted').trim();
      if (stat && stat !== '—') counts[stat] = (counts[stat] || 0) + 1;
    });
    const list = Object.keys(counts).sort();
    return list.map(stat => ({ value: stat, label: `${stat} (${counts[stat]})` }));
  }, [allStudents]);

  // ─── Filter Students ───
  const filteredStudents = useMemo(() => {
    if (!Array.isArray(allStudents)) return [];

    return allStudents.filter(st => {
      if (!st) return false;

      // Session
      if (selectedSession !== 'ALL') {
        const sess = String(st.session || st.Session || '').toLowerCase();
        if (!sess.includes(selectedSession.toLowerCase())) return false;
      }

      // Class
      if (selectedClass !== 'ALL') {
        const cls = String(st.className || st.class || st.Class || st['Admission sought for class'] || '').toLowerCase();
        const normSelected = selectedClass.toLowerCase();
        if (!cls.includes(normSelected)) return false;
      }

      // Stream
      if (selectedStream !== 'ALL') {
        const stm = String(st.stream || st.Stream || '').toLowerCase();
        if (!stm.includes(selectedStream.toLowerCase())) return false;
      }

      // Gender
      if (selectedGender !== 'ALL') {
        const g = String(st.gender || st.Gender || '').trim().toLowerCase();
        if (selectedGender === 'M' && !g.startsWith('m')) return false;
        if (selectedGender === 'F' && !g.startsWith('f')) return false;
      }

      // Status
      if (selectedStatus !== 'ALL') {
        const stat = String(st.status || st.Status || '').toLowerCase();
        if (!stat.includes(selectedStatus.toLowerCase())) return false;
      }

      return true;
    });
  }, [allStudents, selectedSession, selectedClass, selectedStream, selectedGender, selectedStatus]);

  // Combined Active Columns for Table
  const activeTableColumns = useMemo(() => {
    return [...selectedCols, ...customCols];
  }, [selectedCols, customCols]);

  // Normalize Student Data for Table View & Exports
  const processedRows = useMemo(() => {
    return filteredStudents.map((st, idx) => {
      const row = {};

      // S.No.
      row['sno'] = idx + 1;

      // Photo
      row['studentPhoto'] = getStudentPhotoUrl(st);

      // Roll No
      row['classRollNo'] = st.classRollNo || st.rollNo || st['Class Roll No'] || st['Class Roll No.'] || '—';

      // Reg No
      row['boardRegNo'] = st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Reg. No.'] || '—';

      // Adm No
      row['admNo'] = st.admNo || st['Admission Number'] || st['Adm. No.'] || '—';

      // Student Name
      row['studentName'] = st.studentName || st.name || st["Student's Name"] || '—';

      // Father Name
      row['fatherName'] = st.fatherName || st["Father's Name"] || st["Father's/Guardian's Name (as per school records)"] || '—';

      // Mother Name
      row['motherName'] = st.motherName || st["Mother's Name"] || '—';

      // Gender
      const rawG = String(st.gender || st.Gender || '').trim();
      row['gender'] = rawG.toLowerCase().startsWith('f') ? 'Female (F)' : rawG.toLowerCase().startsWith('m') ? 'Male (M)' : (rawG || '—');

      // DOB
      row['dob'] = st.dob || st.DOB || st['Date of Birth'] || '—';

      // Class
      row['className'] = st.className || st.class || st.Class || '—';

      // Session
      row['session'] = st.session || st.Session || '—';

      // Stream
      const stm = String(st.stream || st.Stream || '').trim();
      let stmAbbr = '';
      if (stm.toLowerCase().includes('sci') || stm.toLowerCase().includes('med')) stmAbbr = 'S';
      else if (stm.toLowerCase().includes('hum') || stm.toLowerCase().includes('art')) stmAbbr = 'H';
      else if (stm.toLowerCase().includes('com')) stmAbbr = 'C';
      else if (stm.toLowerCase().includes('gen')) stmAbbr = 'G';
      else if (stm && stm !== '—') stmAbbr = stm.charAt(0).toUpperCase();

      row['stream'] = stm || '—';

      // Subjects
      let rawSubs = '';
      if (useAbbreviatedSubjects) {
        rawSubs = st.streamDisplay || st.subjectsShort || st.subjects || '—';
      } else {
        const subs = [st.subjects1, st.subjects2, st.subjects3, st.subjects4, st.subjects5, st.subjects6].filter(Boolean).filter(s => s !== '—');
        rawSubs = subs.length > 0 ? subs.join(', ') : (st.subjects || '—');
      }

      if (rawSubs && rawSubs !== '—') {
        row['subjects'] = stmAbbr ? `${rawSubs} (${stmAbbr})` : rawSubs;
      } else {
        row['subjects'] = stmAbbr ? `(${stmAbbr})` : '—';
      }

      // Mobile
      row['mobile'] = st.mobile || st.studentMobile || st.parentContact || '—';

      // Aadhaar
      row['aadhaarNo'] = st.aadhaarNo || st.penNo || st.aadhaar || '—';

      // Village
      row['village'] = st.village || st.town || st.address || '—';

      // Category
      row['category'] = st.socialCategory || st.category || '—';

      // Status
      row['status'] = st.status || st.Status || 'Submitted';

      // Custom fields (copy default value)
      customCols.forEach(c => {
        row[c.key] = c.defaultValue || '';
      });

      return row;
    });
  }, [filteredStudents, useAbbreviatedSubjects, customCols]);

  if (!isOpen) return null;

  // Metadata Badges for Header
  const metaBadges = [
    selectedClass !== 'ALL' ? `Class: ${selectedClass}` : 'All Classes',
    selectedSession !== 'ALL' ? `Session: ${selectedSession}` : 'All Sessions',
    selectedStream !== 'ALL' ? `Stream: ${selectedStream}` : null,
    `Total Students: ${filteredStudents.length}`,
    `Date: ${new Date().toLocaleDateString('en-GB')}`
  ].filter(Boolean);

  // Toggle Standard Column Selection
  const toggleDbColumn = (colDef) => {
    const exists = selectedCols.some(c => c.key === colDef.key);
    if (exists) {
      if (selectedCols.length <= 1) return; // keep at least 1 column
      setSelectedCols(selectedCols.filter(c => c.key !== colDef.key));
    } else {
      setSelectedCols([...selectedCols, {
        key: colDef.key,
        label: colDef.label,
        widthPct: colDef.defaultWidthPct,
        align: colDef.align,
        isCustom: false
      }]);
    }
  };

  // Add a Custom Column
  const handleAddCustomColumn = (name, defVal) => {
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}_${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newCol = {
      key,
      label: name.trim(),
      defaultValue: defVal || '',
      widthPct: 12,
      align: 'center',
      isCustom: true
    };
    setCustomCols([...customCols, newCol]);
    setNewColName('');
    setNewColDefaultVal('');
    setShowAddCustomModal(false);
  };

  // Remove a Custom Column
  const handleRemoveCustomColumn = (key) => {
    setCustomCols(customCols.filter(c => c.key !== key));
  };

  // Move Column Left/Right
  const moveColumn = (index, direction) => {
    const list = [...selectedCols];
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setSelectedCols(list);
  };

  // Export to Word (.docx)
  const handleExportDocx = async () => {
    setIsExporting(true);
    try {
      await generateCustomRosterDocx({
        title: docTitle || 'STUDENT ROSTER',
        subtitle: docSubtitle,
        metaBadges,
        columns: activeTableColumns,
        rows: processedRows,
        orientation,
        rowHeightDxa: ROW_HEIGHT_PRESETS[selectedRowHeightIdx].dxa,
        signatories
      });
    } catch (err) {
      console.error('Word export error:', err);
      alert('Failed to generate Word document. Please check console.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Print / PDF
  const handlePrint = () => {
    printCustomRosterTable({
      title: docTitle || 'STUDENT ROSTER',
      subtitle: docSubtitle,
      metaBadges,
      columns: activeTableColumns,
      rows: processedRows,
      orientation,
      rowHeightPx: ROW_HEIGHT_PRESETS[selectedRowHeightIdx].px,
      signatories
    });
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    exportCustomRosterExcel({
      title: docTitle || 'Student_Roster',
      columns: activeTableColumns,
      rows: processedRows
    });
  };

  // Export to CSV
  const handleExportCsv = () => {
    exportCustomRosterCsv({
      title: docTitle || 'Student_Roster',
      columns: activeTableColumns,
      rows: processedRows
    });
  };

  const currentRowHeightPx = ROW_HEIGHT_PRESETS[selectedRowHeightIdx].px;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[1240px] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* ── Modal Header ── */}
        <div className="px-4 py-3 bg-gradient-to-r from-amber-600 via-amber-700 to-indigo-800 text-white flex items-center justify-between shadow-md flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-md">
              <FileSpreadsheet size={20} className="text-amber-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Custom Student List & Document Builder</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-extrabold uppercase tracking-wide">
                  DOCX • PDF • Excel • Print
                </span>
              </h2>
              <p className="text-xs text-amber-100/90 font-medium">
                Create custom printable student lists, fee sheets, exam rosters & signature registers with official school header
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Main Controls & Configuration Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-800 dark:text-slate-200 text-xs">
          
          {/* SECTION 1: FILTER BAR */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                <Sliders size={13} className="text-amber-600 dark:text-amber-400" />
                <span>1. Cohort & Student Filters</span>
              </span>
              <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                {filteredStudents.length} Students Selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* Session */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Session</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                >
                  <option value="ALL">All Sessions ({allStudents.length})</option>
                  {dynamicSessions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                >
                  <option value="ALL">All Classes ({allStudents.length})</option>
                  {dynamicClasses.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Stream */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                >
                  <option value="ALL">All Streams ({allStudents.length})</option>
                  {dynamicStreams.map((stm) => (
                    <option key={stm.value} value={stm.value}>{stm.label}</option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                >
                  <option value="ALL">All Genders ({allStudents.length})</option>
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Form Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                >
                  <option value="ALL">All Statuses ({allStudents.length})</option>
                  {dynamicStatuses.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: COLUMN SELECTION & CUSTOM AD-HOC COLUMNS */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                <Layers size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>2. Select Database Columns ({selectedCols.length} active)</span>
              </span>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold">
                  <input
                    type="checkbox"
                    checked={useAbbreviatedSubjects}
                    onChange={(e) => setUseAbbreviatedSubjects(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  <span>Abbreviated Subjects (e.g. GE, PH, CH)</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Plus size={13} />
                  <span>+ Add Temporary Column</span>
                </button>
              </div>
            </div>

            {/* Database Available Fields Pill Grid */}
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_DB_COLUMNS.map((col) => {
                const isSelected = selectedCols.some(c => c.key === col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleDbColumn(col)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {isSelected ? <CheckSquare size={12} className="text-white" /> : <Square size={12} className="opacity-40" />}
                    <span>{col.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Temporary Ad-Hoc Columns List */}
            {customCols.length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <div className="text-[10px] uppercase font-black tracking-wider text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>Temporary Custom Fields (Independent from permanent database)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customCols.map((c) => (
                    <div
                      key={c.key}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/80 flex items-center gap-2 text-amber-950 dark:text-amber-200"
                    >
                      <span className="font-black text-[11px]">{c.label}</span>
                      {c.defaultValue && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100">
                          Default: {c.defaultValue}
                        </span>
                      )}
                      {!c.defaultValue && (
                        <span className="text-[9px] font-mono px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Blank box (for signature)
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomColumn(c.key)}
                        title="Remove this custom column"
                        className="p-0.5 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950 rounded cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: DOCUMENT TITLE, ROW HEIGHT & PRINT CONTROLS */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <span className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
              <Settings2 size={13} className="text-teal-600 dark:text-teal-400" />
              <span>3. Document Layout, Row Height & Print Styling</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Document Title */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Document Title (Printed on School Letterhead)</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. CLASS 12TH EXAM FEE & SIGNATURE REGISTER"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-xs text-slate-900 dark:text-white uppercase"
                />
              </div>

              {/* Page Orientation */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Page Orientation</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`py-1.5 rounded-lg font-black text-xs border cursor-pointer ${
                      orientation === 'portrait'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Portrait (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`py-1.5 rounded-lg font-black text-xs border cursor-pointer ${
                      orientation === 'landscape'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>
            </div>

            {/* Row Height Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                Row Height Preset (Space for pen signatures and manual writing):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROW_HEIGHT_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSelectedRowHeightIdx(idx)}
                    className={`p-2 rounded-xl text-left border cursor-pointer transition-all ${
                      selectedRowHeightIdx === idx
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-950 dark:text-amber-200 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-black text-[11px]">
                      <span>{preset.label}</span>
                      <span className="font-mono text-[10px] opacity-70">({preset.px}px)</span>
                    </div>
                    <div className="text-[9.5px] opacity-75 mt-0.5 leading-tight">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: LIVE PRINT & DOCUMENT PREVIEW TABLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                <Eye size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>4. Live Document Preview</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Official Letterhead Header Included by Default
              </span>
            </div>

            {/* Document Paper Container */}
            <div className="bg-white text-slate-900 border border-slate-300 rounded-xl p-4 sm:p-6 shadow-sm overflow-x-auto">
              
              {/* Institution Letterhead */}
              <div className="text-center border-b-2 border-[#800000] pb-2 mb-3">
                <h1 className="text-base sm:text-lg font-black text-[#800000] tracking-wide m-0">
                  GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS
                </h1>
                <p className="text-[10px] text-slate-600 font-semibold m-0 mt-0.5">
                  District Anantnag, Kashmir — 192201 | Official Institutional Record
                </p>
                <h2 className="text-xs sm:text-sm font-extrabold uppercase underline tracking-wider text-slate-900 mt-2">
                  {docTitle || 'STUDENT ROSTER & RECORD SHEET'}
                </h2>
                {docSubtitle && (
                  <p className="text-[10px] text-slate-500 italic mt-0.5">{docSubtitle}</p>
                )}
                <div className="flex items-center justify-center gap-2 sm:gap-4 text-[10px] font-bold text-slate-700 mt-1.5 flex-wrap">
                  {metaBadges.map((b, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <span>{b}</span>
                      {i < metaBadges.length - 1 && <span className="text-slate-400">|</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900">
                      {activeTableColumns.map((col) => (
                        <th
                          key={col.key}
                          style={{ textAlign: col.align || 'left', width: `${col.widthPct || 10}%` }}
                          className="border border-slate-400 px-2 py-1.5 font-black uppercase text-[10px] tracking-tight"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {processedRows.slice(0, 15).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50/80">
                        {activeTableColumns.map((col) => (
                          <td
                            key={col.key}
                            style={{ height: `${currentRowHeightPx}px`, textAlign: col.align || 'left' }}
                            className="border border-slate-300 px-2 py-1 text-[11px] font-medium align-middle"
                          >
                            {col.key === 'studentPhoto' || col.key === 'photo' ? (
                              <div className="flex items-center justify-center p-0.5">
                                {row.studentPhoto ? (
                                  <img
                                    src={row.studentPhoto}
                                    alt={row.studentName || 'Student'}
                                    className="w-7 h-9 object-cover rounded border border-slate-300 shadow-2xs mx-auto bg-slate-100 block"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = 'none';
                                      if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`w-7 h-9 border border-dashed border-slate-300 rounded bg-slate-50 flex-col items-center justify-center text-[7px] text-slate-400 font-bold mx-auto ${
                                    row.studentPhoto ? 'hidden' : 'flex'
                                  }`}
                                >
                                  <User size={10} className="text-slate-300 mb-0.5" />
                                  <span>Photo</span>
                                </div>
                              </div>
                            ) : (
                              row[col.key] || (col.isCustom ? (col.defaultValue || '') : '—')
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {processedRows.length > 15 && (
                <div className="text-center py-2 text-[10px] text-slate-500 font-mono italic bg-slate-50 border-x border-b border-slate-300">
                  ... Showing first 15 rows in preview ({processedRows.length} total students will be exported/printed) ...
                </div>
              )}

              {/* Signatories Block */}
              <div className="flex items-center justify-between pt-8 px-4 text-center mt-4">
                {signatories.map((sig, idx) => (
                  <div key={idx} className="w-36 sm:w-48">
                    <div className="border-b border-slate-600 mb-1"></div>
                    <div className="font-extrabold text-[10px] text-slate-900 uppercase">{sig}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal Footer with 1-Click Export Buttons ── */}
        <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
            Exporting <span className="font-black text-slate-900 dark:text-white font-mono">{processedRows.length}</span> students across <span className="font-black text-slate-900 dark:text-white font-mono">{activeTableColumns.length}</span> columns
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={processedRows.length === 0}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>

            {/* Excel (.xlsx) */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={processedRows.length === 0}
              className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={13} />
              <span>Export Excel (.xlsx)</span>
            </button>

            {/* Word (.docx) */}
            <button
              type="button"
              onClick={handleExportDocx}
              disabled={processedRows.length === 0 || isExporting}
              className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
              <span>Download Word (.docx)</span>
            </button>

            {/* Print / PDF */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={processedRows.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── Sub-Modal: Add Temporary Custom Column ── */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-[999999] bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <FilePlus size={15} className="text-amber-600" />
                <span>Add Temporary Custom Column</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Quick Common Templates:</label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CUSTOM_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => {
                      handleAddCustomColumn(tpl.name, tpl.defaultValue);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-slate-800 dark:text-slate-200 text-[10px] font-black border border-slate-300 dark:border-slate-700 cursor-pointer"
                  >
                    + {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Column Label / Header Name</label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. Science Lab Fee, Bus Pass No, Remarks"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Default Value / Placeholder</label>
                <input
                  type="text"
                  value={newColDefaultVal}
                  onChange={(e) => setNewColDefaultVal(e.target.value)}
                  placeholder="e.g. ₹500, Paid, or leave empty for blank signature box"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                />
                <p className="text-[9.5px] text-slate-500 mt-0.5">Leave blank if you want an empty cell for manual pen signatures or hand writing.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newColName.trim()}
                onClick={() => handleAddCustomColumn(newColName, newColDefaultVal)}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs disabled:opacity-50 cursor-pointer shadow-sm"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
