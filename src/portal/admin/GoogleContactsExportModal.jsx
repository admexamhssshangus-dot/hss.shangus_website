// =================================================================
// HSS SHANGUS — Google Contacts Bulk Exporter Modal
// =================================================================
// High-fidelity administrative suite to filter student cohorts, preview
// standardized contact cards, and export directly to Google Contacts CSV.
// =================================================================

import React, { useState, useMemo } from 'react';
import {
  X, Download, Users, Phone, Search, Filter, CheckCircle2,
  AlertTriangle, ExternalLink, HelpCircle, FileSpreadsheet,
  ChevronDown, ChevronUp, Sparkles, Check, Copy, UserCheck
} from 'lucide-react';
import {
  buildGoogleContactDisplayName,
  cleanPhoneNumber,
  downloadGoogleContactsCsv,
  extractRollVal,
  extractClassVal,
  extractSessionVal,
  parseFormNumberRange
} from '../../utils/googleContactsExporter';
import { showToast } from '../../components/common/GlobalToast';

export default function GoogleContactsExportModal({
  isOpen,
  onClose,
  students = [],
  initialSelectedIds = null,
  activeSession = '2025-26'
}) {
  // Filter States
  const [selectedSession, setSelectedSession] = useState(activeSession || '2025-26');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedStream, setSelectedStream] = useState('All');
  const [onlyWithRollNo, setOnlyWithRollNo] = useState(false);
  const [formNumberFilter, setFormNumberFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [activePresetFilter, setActivePresetFilter] = useState(initialSelectedIds);

  // Sync initialSelectedIds when changed externally
  React.useEffect(() => {
    setActivePresetFilter(initialSelectedIds);
  }, [initialSelectedIds]);

  // Available Filter Options derived from students data
  const availableSessions = useMemo(() => {
    const set = new Set();
    students.forEach(s => {
      const sess = extractSessionVal(s, '');
      if (sess) set.add(sess);
    });
    if (!set.has('2025-26')) set.add('2025-26');
    if (!set.has('2024-25')) set.add('2024-25');
    return Array.from(set).sort().reverse();
  }, [students]);

  const availableClasses = useMemo(() => {
    const set = new Set();
    students.forEach(s => {
      const c = extractClassVal(s);
      if (c) set.add(c);
    });
    return ['All', ...Array.from(set).sort()];
  }, [students]);

  const availableStreams = useMemo(() => {
    const set = new Set();
    students.forEach(s => {
      const st = s.stream || s['Stream'] || s['Stream for Class 11th'] || '';
      if (st && st !== '—' && st !== '-') set.add(String(st).trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [students]);

  // Parse custom Form Numbers input (supports commas, spaces, and ranges like 101-125)
  const parsedFormNumbers = useMemo(() => {
    return parseFormNumberRange(formNumberFilter);
  }, [formNumberFilter]);

  // Filter Matching Students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Initial selection filter (if opened for specific selected rows)
      if (activePresetFilter && activePresetFilter.size > 0) {
        const id = student.id || student._id || student.docId || student._docId;
        const fn = student.formNo || student['Form Number'];
        const hasMatch = (id && activePresetFilter.has(String(id))) || 
                         (fn && activePresetFilter.has(String(fn)));
        if (!hasMatch) return false;
      }

      // 2. Session filter
      if (selectedSession && selectedSession !== 'All') {
        const sess = extractSessionVal(student, '');
        if (sess && sess.toLowerCase() !== selectedSession.toLowerCase()) return false;
      }

      // 3. Class filter
      if (selectedClass !== 'All') {
        const c = extractClassVal(student);
        if (c.toLowerCase() !== selectedClass.toLowerCase()) return false;
      }

      // 4. Stream filter
      if (selectedStream !== 'All') {
        const st = String(student.stream || student['Stream'] || student['Stream for Class 11th'] || '').trim();
        if (st.toLowerCase() !== selectedStream.toLowerCase()) return false;
      }

      // 5. Only with Roll Numbers
      if (onlyWithRollNo) {
        const roll = extractRollVal(student);
        if (!roll) return false;
      }

      // 6. Form Number list filter
      if (parsedFormNumbers && parsedFormNumbers.size > 0) {
        const fn = String(student.formNo || student['Form Number'] || '').trim().toLowerCase();
        if (!parsedFormNumbers.has(fn)) return false;
      }

      // 7. Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = String(student.studentName || student["Student's Name (as per school records)"] || student.name || '').toLowerCase();
        const father = String(student.fatherName || student["Father's/Guardian's Name (as per school records)"] || '').toLowerCase();
        const fn = String(student.formNo || student['Form Number'] || '').toLowerCase();
        const mob = cleanPhoneNumber(student.mobile || student['Mobile No. (with working WhatsApp)'] || '');
        if (!name.includes(q) && !father.includes(q) && !fn.includes(q) && !mob.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [students, activePresetFilter, selectedSession, selectedClass, selectedStream, onlyWithRollNo, parsedFormNumbers, searchQuery]);

  // Validation Metrics
  const metrics = useMemo(() => {
    let ready = 0;
    let missingPhone = 0;
    let missingName = 0;

    filteredStudents.forEach(s => {
      const name = String(s.studentName || s["Student's Name (as per school records)"] || s.name || '').trim();
      const mob = cleanPhoneNumber(s.mobile || s['Mobile No. (with working WhatsApp)'] || '');
      if (!name) missingName++;
      else if (!mob || mob.length < 10) missingPhone++;
      else ready++;
    });

    return { ready, missingPhone, missingName, total: filteredStudents.length };
  }, [filteredStudents]);

  // Handle CSV Download
  const handleExport = () => {
    if (metrics.ready === 0) {
      showToast('No valid student records with phone numbers found to export.', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const fileName = `HSS_Shangus_Google_Contacts_${selectedClass !== 'All' ? selectedClass + '_' : ''}${selectedSession}_${new Date().toISOString().slice(0, 10)}.csv`;
      const result = downloadGoogleContactsCsv(filteredStudents, {
        session: selectedSession,
        fileName
      });

      if (result.exportedCount > 0) {
        showToast(`🎉 Successfully exported ${result.exportedCount} contacts ready for Google Contacts!`, 'success');
      } else {
        showToast('Export failed: No valid records exported.', 'error');
      }
    } catch (err) {
      showToast(`Export error: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Quick Copy Sample Display Name
  const handleCopySample = (sampleName) => {
    if (!sampleName) return;
    navigator.clipboard.writeText(sampleName);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
    showToast('Copied contact preview format to clipboard!', 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-1.5 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl sm:max-w-3xl w-full max-h-[96vh] sm:max-h-[88vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Compact Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-teal-50/50 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-800/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Users size={14} />
            </div>
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Bulk Google Contacts Exporter
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hidden xs:inline-flex">
                Legacy Ported
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-1.5"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3.5 space-y-2 sm:space-y-2.5">

          {/* Compact Filter Box */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Filter size={11} className="text-blue-500" /> Filter Cohort
              </span>
              {activePresetFilter && activePresetFilter.size > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    Preset: {activePresetFilter.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePresetFilter(null)}
                    className="text-[9px] text-rose-500 hover:text-rose-600 underline font-bold cursor-pointer"
                    title="Clear pre-selection to filter all students"
                  >
                    (Clear)
                  </button>
                </div>
              )}
            </div>

            {/* Selectors Row: 3 columns on mobile, 4 columns on sm+ */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 sm:gap-1.5">
              {/* Session Selector */}
              <div>
                <label className="block text-[8.5px] font-bold uppercase text-slate-400 mb-0.5">
                  Session
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full text-[11px] font-semibold py-1 px-1.5 sm:px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 outline-none h-7"
                >
                  <option value="All">All Sessions</option>
                  {availableSessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Class Selector */}
              <div>
                <label className="block text-[8.5px] font-bold uppercase text-slate-400 mb-0.5">
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full text-[11px] font-semibold py-1 px-1.5 sm:px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 outline-none h-7"
                >
                  {availableClasses.map(c => (
                    <option key={c} value={c}>{c === 'All' ? 'All Classes' : `Class ${c}`}</option>
                  ))}
                </select>
              </div>

              {/* Stream Selector */}
              <div>
                <label className="block text-[8.5px] font-bold uppercase text-slate-400 mb-0.5">
                  Stream
                </label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full text-[11px] font-semibold py-1 px-1.5 sm:px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 outline-none h-7"
                >
                  {availableStreams.map(st => (
                    <option key={st} value={st}>{st === 'All' ? 'All Streams' : st}</option>
                  ))}
                </select>
              </div>

              {/* Only with Roll No Checkbox - Shown on desktop in 4th col, on mobile next to search */}
              <div className="hidden sm:flex flex-col justify-end">
                <label className="flex items-center gap-1.5 py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors h-7 select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithRollNo}
                    onChange={(e) => setOnlyWithRollNo(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 focus:ring-1 focus:ring-blue-500 rounded cursor-pointer shrink-0"
                  />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                    Only Roll Nos
                  </span>
                </label>
              </div>
            </div>

            {/* Search & Form Range Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-1.5 pt-0.5">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, phone, form..."
                    className="w-full text-[11px] font-medium pl-6 pr-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 outline-none h-7"
                  />
                </div>

                {/* Mobile-only compact Roll No toggle button */}
                <label className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer h-7 shrink-0">
                  <input
                    type="checkbox"
                    checked={onlyWithRollNo}
                    onChange={(e) => setOnlyWithRollNo(e.target.checked)}
                    className="w-3 h-3 text-blue-600 rounded cursor-pointer"
                  />
                  <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
                    Roll Only
                  </span>
                </label>
              </div>

              <div>
                <input
                  type="text"
                  value={formNumberFilter}
                  onChange={(e) => setFormNumberFilter(e.target.value)}
                  placeholder="Form Nos / Ranges (e.g. 101-125, 130)..."
                  className="w-full text-[11px] font-medium px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 outline-none h-7"
                />
              </div>
            </div>
          </div>

          {/* Slim Modern Stats Ribbon - Immune to overflow & truncation */}
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            <div className="py-1 px-1.5 sm:py-1.5 sm:px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 flex items-center justify-center gap-1.5 sm:gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 leading-none">
                {metrics.ready}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-500 truncate">
                Ready
              </span>
            </div>

            <div className="py-1 px-1.5 sm:py-1.5 sm:px-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/60 flex items-center justify-center gap-1.5 sm:gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
              <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-400 leading-none">
                {metrics.missingPhone}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-500 truncate">
                No Phone
              </span>
            </div>

            <div className="py-1 px-1.5 sm:py-1.5 sm:px-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/90 dark:border-blue-800/60 flex items-center justify-center gap-1.5 sm:gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
              <span className="text-xs sm:text-sm font-black text-blue-700 dark:text-blue-400 leading-none">
                {metrics.total}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-700/80 dark:text-blue-500 truncate">
                Total
              </span>
            </div>
          </div>

          {/* Compact Live Preview of Google Contact Names */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
            <div className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles size={11} className="text-amber-500 shrink-0" />
                <span className="text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Contact Display Name Preview
                </span>
                <span className="text-[9px] text-slate-400 hidden xs:inline shrink-0">
                  (First 10)
                </span>
              </div>
              <span className="text-[8.5px] sm:text-[9px] font-mono text-slate-400 hidden md:inline truncate max-w-[260px]">
                [Roll.] Name-Father,student (Class_Sess)Gender,Stream_Subs
              </span>
            </div>

            <div className="max-h-40 sm:max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredStudents.length === 0 ? (
                <div className="py-5 text-center text-slate-400 font-bold text-xs">
                  No students match the current filters.
                </div>
              ) : (
                filteredStudents.slice(0, 10).map((st, idx) => {
                  const dispName = buildGoogleContactDisplayName(st, selectedSession);
                  const mob = cleanPhoneNumber(st.mobile || st['Mobile No. (with working WhatsApp)'] || '');
                  const parentMob = cleanPhoneNumber(st.parentContact || st["Parent's Mobile No. (must be working)"] || '');
                  const formNo = st.formNo || st['Form Number'] || '—';
                  const hasValidMob = mob && mob.length >= 10;

                  return (
                    <div
                      key={st.id || idx}
                      className="px-2 py-1.5 sm:px-3 sm:py-1.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Top Line: Form No, Name, Copy */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-mono text-[9px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded shrink-0">
                            #{formNo}
                          </span>
                          <span className="font-bold text-blue-700 dark:text-blue-400 truncate font-mono text-[10.5px] sm:text-xs">
                            {dispName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopySample(dispName)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 cursor-pointer"
                          title="Copy display name"
                        >
                          <Copy size={11} />
                        </button>
                      </div>

                      {/* Bottom Line: Phone & Status Badge */}
                      <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] mt-0.5 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1 font-mono">
                          <Phone size={9} className={hasValidMob ? 'text-emerald-500' : 'text-amber-500'} />
                          <span className={hasValidMob ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-amber-600 font-bold'}>
                            {mob || 'No Phone'}
                          </span>
                          {parentMob && (
                            <span className="text-slate-400 hidden xs:inline font-mono">
                              / P: {parentMob}
                            </span>
                          )}
                        </div>

                        <span className={`px-1.5 py-0.2 rounded text-[8px] sm:text-[8.5px] font-black uppercase ${
                          hasValidMob
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {hasValidMob ? 'Valid' : 'Skip Phone'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Compact Instructions Accordion */}
          <div className="rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full px-2.5 py-1 sm:py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-blue-800 dark:text-blue-300 cursor-pointer hover:bg-blue-100/40 dark:hover:bg-blue-900/30 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <HelpCircle size={11} />
                <span>How to import into Google Contacts</span>
              </div>
              {showInstructions ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {showInstructions && (
              <div className="px-2.5 pb-2 text-[9.5px] sm:text-[10.5px] text-blue-900/80 dark:text-blue-200/90 space-y-1 border-t border-blue-100 dark:border-blue-900/40 pt-1.5">
                <ol className="list-decimal list-inside space-y-0.5 pl-0.5">
                  <li>Click <strong>Export CSV</strong> to save the contacts file.</li>
                  <li>
                    Open{' '}
                    <a
                      href="https://contacts.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5"
                    >
                      Google Contacts <ExternalLink size={9} />
                    </a>
                  </li>
                  <li>In the sidebar, click <strong>Import</strong> &rarr; <strong>Select file</strong> and upload.</li>
                </ol>
              </div>
            )}
          </div>

        </div>

        {/* Compact Footer Bar */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Exporting <strong className="text-slate-800 dark:text-slate-200 font-black">{metrics.ready}</strong> contacts
              <span className="hidden sm:inline"> as standard 38-column CSV</span>.
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || metrics.ready === 0}
                className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <Download size={12} className={isExporting ? 'animate-bounce' : ''} />
                <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
