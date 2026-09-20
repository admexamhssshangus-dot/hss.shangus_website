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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-teal-50/50 dark:from-slate-800/40 dark:via-slate-800/20 dark:to-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Bulk Google Contacts Exporter
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Legacy Ported
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Export student cohorts into Google Contacts-compatible CSV format with smart display names & full records.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* Top Filter Grid */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Filter size={13} className="text-blue-500" /> Filter Cohort
              </span>
              {activePresetFilter && activePresetFilter.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    Preset: {activePresetFilter.size} records pre-selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePresetFilter(null)}
                    className="text-[10px] text-rose-500 hover:text-rose-600 underline font-bold cursor-pointer"
                    title="Remove pre-selection to filter all students"
                  >
                    (Clear to show all)
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Session Selector */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Session
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full text-xs font-bold py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="All">All Sessions</option>
                  {availableSessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Class Selector */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full text-xs font-bold py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {availableClasses.map(c => (
                    <option key={c} value={c}>{c === 'All' ? 'All Classes' : `Class ${c}`}</option>
                  ))}
                </select>
              </div>

              {/* Stream Selector */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Stream
                </label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full text-xs font-bold py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {availableStreams.map(st => (
                    <option key={st} value={st}>{st === 'All' ? 'All Streams' : st}</option>
                  ))}
                </select>
              </div>

              {/* Only with Roll No Checkbox */}
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={onlyWithRollNo}
                    onChange={(e) => setOnlyWithRollNo(e.target.checked)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight select-none">
                    Only with Roll Nos
                  </span>
                </label>
              </div>
            </div>

            {/* Quick Search & Specific Form Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* General Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, parent, phone or form number..."
                  className="w-full text-xs font-bold pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Form Numbers Specific input */}
              <div>
                <input
                  type="text"
                  value={formNumberFilter}
                  onChange={(e) => setFormNumberFilter(e.target.value)}
                  placeholder="Specific Form Numbers (e.g. 1042, 1043, 1050)..."
                  className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Validation & Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 leading-tight">
                  {metrics.ready}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-500">
                  Ready to Export
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-400 leading-tight">
                  {metrics.missingPhone}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600/80 dark:text-amber-500">
                  Missing/Short Phone
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                <Users size={16} />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 leading-tight">
                  {metrics.total}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80 dark:text-blue-500">
                  Total Matching
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview of Google Contact Names */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-amber-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Google Contacts Display Name Live Preview
                </span>
                <span className="text-[10px] text-slate-400">
                  (Showing up to 10 sample entries)
                </span>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase">
                Format: [Roll.] Name-Father,student (Class_Sess)Gender,Stream_Subs
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-bold">
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
                      className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-black text-slate-400 shrink-0">
                            #{formNo}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate font-mono text-[11px] sm:text-xs text-blue-700 dark:text-blue-400">
                            {dispName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySample(dispName)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                            title="Copy formatted display name"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-[11px]">
                        <div className="flex items-center gap-1 font-mono">
                          <Phone size={11} className={hasValidMob ? 'text-emerald-500' : 'text-amber-500'} />
                          <span className={hasValidMob ? 'text-slate-700 dark:text-slate-300' : 'text-amber-600 font-bold'}>
                            {mob || 'No Mobile'}
                          </span>
                        </div>
                        {parentMob && (
                          <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                            P: {parentMob}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
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

          {/* Expandable Import Instructions */}
          <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-300 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle size={14} />
                <span>How to import this CSV into Google Contacts (Step-by-Step)</span>
              </div>
              {showInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showInstructions && (
              <div className="px-4 pb-4 text-xs text-blue-900/80 dark:text-blue-200/90 space-y-2 border-t border-blue-100 dark:border-blue-900/40 pt-3">
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Click <strong>Download Google Contacts CSV</strong> below to save the file.</li>
                  <li>
                    Open{' '}
                    <a
                      href="https://contacts.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1"
                    >
                      Google Contacts (contacts.google.com) <ExternalLink size={11} />
                    </a>
                  </li>
                  <li>In the left sidebar menu, click <strong>Import</strong>.</li>
                  <li>Click <strong>Select file</strong> and choose the downloaded CSV.</li>
                  <li>Click <strong>Import</strong>. Google Contacts will automatically tag all imported students into a distinct label for effortless bulk messaging or classroom WhatsApp sync!</li>
                </ol>
              </div>
            )}
          </div>

        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Exporting <span className="font-bold text-slate-800 dark:text-slate-200">{metrics.ready}</span> contacts as standard 38-column Google Contacts CSV.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || metrics.ready === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <Download size={14} className={isExporting ? 'animate-bounce' : ''} />
              <span>{isExporting ? 'Generating CSV...' : 'Download Google Contacts CSV'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
