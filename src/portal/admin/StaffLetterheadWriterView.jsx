// =================================================================
// HSS SHANGUS — Clerk Official Staff Letterhead & Mail Merge Studio
// High-Density 3-Column Layout:
// Left: Template & Staff Picker | Centre: A4 Live Preview | Right: Tools, Actions & Placeholders
// =================================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Printer, FileText, Calendar, Edit3, Save, RotateCcw,
  Bold, Italic, Underline, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Table as TableIcon,
  Check, Copy, Users, Search, CheckSquare, Square,
  Sparkles, ArrowRight, ShieldCheck, ChevronDown, Download,
  Eye, RefreshCw, AlertCircle, BookmarkPlus, Info, Plus,
  FileCode, Layers, CheckCircle2
} from 'lucide-react';
import {
  STAFF_MERGE_VARIABLES,
  BUILTIN_STAFF_LETTER_TEMPLATES,
  getEmployeeVariablesMap,
  interpolateStaffVariables,
  printMergedStaffLetters,
  generateStaffLetterDocx
} from '../../utils/staffLetterMergeUtils';
import { saveGeneratedDocToHistory } from '../../services/docHistoryService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';
import { sanitizeRichHtml } from '../../utils/sanitizeRichHtml';

export default function StaffLetterheadWriterView({
  faculty = [],
  user = null,
  onOpenHistory = null
}) {
  // Document Core State
  const [selectedTemplateId, setSelectedTemplateId] = useState('salary_service_certificate');
  const [refNo, setRefNo] = useState('HSS/SHG/Sal-Cert/2026/01');
  const [dateStr, setDateStr] = useState(new Date().toLocaleDateString('en-GB'));
  const [bodyHtml, setBodyHtml] = useState(BUILTIN_STAFF_LETTER_TEMPLATES[0].bodyHtml);
  
  // View Mode for Centre Canvas: 'preview' (Live Interpolated Preview) or 'tokens' (Template Tokens)
  const [centreMode, setCentreMode] = useState('preview');

  // Signatory State
  const [clerkSignatory, setClerkSignatory] = useState('Dealing Assistant / Accounts Clerk');
  const [principalSignatory, setPrincipalSignatory] = useState('Principal / DDO');
  
  // Staff Selection State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all'); // 'all', 'teaching', 'non_teaching'
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [previewEmployeeIndex, setPreviewEmployeeIndex] = useState(0);

  // Editor Ref & Range Selection
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Initialize selected employee IDs when faculty loads
  useEffect(() => {
    if (Array.isArray(faculty) && faculty.length > 0 && selectedEmployeeIds.length === 0) {
      setSelectedEmployeeIds(faculty.map((f, idx) => f.id || f.cpis_no || f.pan || `emp_${idx}`));
    }
  }, [faculty]);

  // Helper Employee Getters
  const isNonTeaching = (emp) => {
    const d = (emp.designation || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    return dept === 'mts' || d.includes('mts') || d.includes('lab assistant') ||
      d.includes('bearer') || d.includes('peon') || d.includes('chowkidar') ||
      d.includes('safaiwalla') || d.includes('class iv') || d.includes('driver');
  };

  // Filtered Faculty
  const filteredFaculty = useMemo(() => {
    if (!Array.isArray(faculty)) return [];
    return faculty.filter((emp) => {
      if (activeCategoryFilter === 'teaching' && isNonTeaching(emp)) return false;
      if (activeCategoryFilter === 'non_teaching' && !isNonTeaching(emp)) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const name = (emp.name || '').toLowerCase();
        const cpis = (emp.cpis_no || emp.cpis || '').toLowerCase();
        const pan = (emp.pan || '').toLowerCase();
        const desig = (emp.designation || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        return name.includes(q) || cpis.includes(q) || pan.includes(q) || desig.includes(q) || dept.includes(q);
      }
      return true;
    });
  }, [faculty, activeCategoryFilter, searchTerm]);

  // Selected Employee Objects
  const selectedEmployees = useMemo(() => {
    if (!Array.isArray(faculty)) return [];
    const idSet = new Set(selectedEmployeeIds);
    return faculty.filter((f, idx) => idSet.has(f.id || f.cpis_no || f.pan || `emp_${idx}`));
  }, [faculty, selectedEmployeeIds]);

  // Active Preview Employee
  const currentPreviewEmployee = useMemo(() => {
    if (selectedEmployees.length === 0) return faculty[0] || {};
    const clamped = Math.max(0, Math.min(previewEmployeeIndex, selectedEmployees.length - 1));
    return selectedEmployees[clamped] || selectedEmployees[0] || {};
  }, [selectedEmployees, previewEmployeeIndex, faculty]);

  // Interpolated Preview HTML for the active employee
  const previewInterpolatedHtml = useMemo(() => {
    return interpolateStaffVariables(bodyHtml, currentPreviewEmployee, {
      refNo,
      dateStr,
      session: '2025–26'
    });
  }, [bodyHtml, currentPreviewEmployee, refNo, dateStr]);

  const previewInterpolatedRef = useMemo(() => {
    return interpolateStaffVariables(refNo, currentPreviewEmployee, {
      refNo,
      dateStr,
      session: '2025–26'
    });
  }, [refNo, currentPreviewEmployee, dateStr]);

  // Sync editor content with active mode
  useEffect(() => {
    if (editorRef.current) {
      const targetContent = centreMode === 'preview' ? previewInterpolatedHtml : bodyHtml;
      if (editorRef.current.innerHTML !== targetContent) {
        editorRef.current.innerHTML = targetContent;
      }
    }
  }, [bodyHtml, previewInterpolatedHtml, centreMode, currentPreviewEmployee]);

  // Save selection range inside the editor
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  // Handle direct text editing in either preview or template mode
  const handleBodyEdit = () => {
    if (!editorRef.current) return;
    saveSelection();
    setBodyHtml(editorRef.current.innerHTML);
  };

  // Handle Template Switching
  const handleSelectTemplate = (templateId) => {
    const t = BUILTIN_STAFF_LETTER_TEMPLATES.find(tpl => tpl.id === templateId);
    if (!t) return;
    setSelectedTemplateId(templateId);
    setRefNo(t.refNo || 'HSS/SHG/Estt/2026/');
    setBodyHtml(t.bodyHtml || '');
    if (editorRef.current) {
      editorRef.current.innerHTML = centreMode === 'preview'
        ? interpolateStaffVariables(t.bodyHtml, currentPreviewEmployee, { refNo: t.refNo, dateStr, session: '2025–26' })
        : (t.bodyHtml || '');
    }
    showToast(`Loaded template: ${t.name}`, 'info');
  };

  // Insert Variable Token into Editor at cursor (works in both preview & tokens mode)
  const handleInsertVariable = (token) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const sel = window.getSelection();
    let range = savedRangeRef.current;

    if (range && editorRef.current.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0);
    }

    if (range) {
      range.deleteContents();
      const node = document.createTextNode(` ${token} `);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
    } else {
      editorRef.current.innerHTML += ` ${token} `;
    }

    setBodyHtml(editorRef.current.innerHTML);
    showToast(`Inserted variable ${token}`, 'info');
  };

  // Execute Rich Text Command directly in editor
  const executeCmd = (command, value = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
      document.execCommand(command, false, value);
      saveSelection();
      setBodyHtml(editorRef.current.innerHTML);
    }
  };

  // Toggle Employee Selection
  const toggleEmployeeSelection = (id) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredFaculty.map((f, idx) => f.id || f.cpis_no || f.pan || `emp_${idx}`);
    setSelectedEmployeeIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDeselectAllFiltered = () => {
    const filteredIds = new Set(filteredFaculty.map((f, idx) => f.id || f.cpis_no || f.pan || `emp_${idx}`));
    setSelectedEmployeeIds(prev => prev.filter(id => !filteredIds.has(id)));
  };

  // Batch Print All Merged Letters
  const handleBatchPrint = () => {
    if (selectedEmployees.length === 0) {
      showToast('Please select at least one employee to print letters for.', 'warning');
      return;
    }

    const currentContent = editorRef.current ? editorRef.current.innerHTML : bodyHtml;

    printMergedStaffLetters({
      templateHtml: currentContent,
      selectedEmployees,
      extraContext: {
        refNo,
        dateStr,
        session: '2025–26'
      },
      clerkSignatory,
      signatoryName: principalSignatory,
      signatoryDesignation: 'Govt. Higher Secondary School Shangus'
    });

    handleSaveToCloudHistory(false);
  };

  // Export Word (.docx)
  const handleExportDocx = async () => {
    try {
      setIsExportingDocx(true);
      const currentContent = editorRef.current ? editorRef.current.innerHTML : bodyHtml;
      await generateStaffLetterDocx({
        bodyHtml: currentContent,
        employee: currentPreviewEmployee,
        extraContext: {
          refNo,
          dateStr,
          session: '2025–26'
        },
        signatoryDesignation: principalSignatory,
        clerkSignatory
      });
      showToast(`Exported DOCX for ${currentPreviewEmployee.name || 'Official'}!`, 'success');
    } catch (err) {
      console.error('Error generating docx:', err);
      showToast(`Failed to export DOCX: ${err.message}`, 'error');
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Save Document to History Archive
  const handleSaveToCloudHistory = async (showFeedback = true) => {
    try {
      setIsSaving(true);
      const currentContent = editorRef.current ? editorRef.current.innerHTML : bodyHtml;
      const tpl = BUILTIN_STAFF_LETTER_TEMPLATES.find(t => t.id === selectedTemplateId);
      const title = tpl ? `${tpl.name} (${selectedEmployees.length} Staff)` : `Official Staff Letter (${selectedEmployees.length} Staff)`;

      await saveGeneratedDocToHistory({
        docType: 'clerk_staff_letter',
        title,
        refNo,
        dateStr,
        recipientOrStudent: selectedEmployees.length === 1
          ? `${selectedEmployees[0].name} (${selectedEmployees[0].designation || 'Staff'})`
          : `Batch Dispatch: ${selectedEmployees.length} Selected Employees`,
        bodyHtml: currentContent,
        actionType: 'Saved to Cloud',
        templateId: selectedTemplateId,
        templateName: tpl ? tpl.name : 'Custom Staff Letter',
        extraData: {
          authorScope: 'accounts_clerk',
          authorRole: 'clerk',
          authorEmail: user?.email || 'accounts.clerk.hss@gmail.com',
          authorName: user?.displayName || user?.name || 'Accounts Clerk',
          selectedCount: selectedEmployees.length,
          selectedEmployeeIds,
          clerkSignatory,
          principalSignatory
        }
      });

      logAdminActivity({
        actionType: 'create',
        actionTitle: 'Clerk Staff Letter Created',
        details: `Generated official letterhead document for ${selectedEmployees.length} staff members (Ref: ${refNo})`,
        actorRole: 'Accounts Clerk'
      });

      if (showFeedback) {
        showToast('Official letter saved to Clerk History successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to save clerk document history:', err);
      if (showFeedback) {
        showToast(`Could not save history: ${err.message}`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* ─── 3-COLUMN STUDIO LAYOUT (ULTRA-COMPACT VIEWPORT-FITTING DESIGN) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        
        {/* ══════════════════════════════════════════════════════════════════════
            1. LEFT COLUMN: TEMPLATE SELECTOR, TARGET STAFF & SIGNATORIES (3 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-2">
          
          {/* Unified Card: Template Setup & Target Staff */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-2">
            
            {/* Header: Template */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1">
              <FileText className="text-amber-600 dark:text-amber-500 shrink-0" size={13} />
              <span className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-wider">
                Official Template
              </span>
            </div>

            <div>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {BUILTIN_STAFF_LETTER_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ref No & Date Row */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                  Ref No:
                </label>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="HSS/SHG/..."
                  className="w-full text-[10.5px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                  Date:
                </label>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full text-[10.5px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Target Staff Section */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <Users size={12} className="text-amber-600 dark:text-amber-500 shrink-0" />
                  <span className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-wider">
                    Target Staff
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[9.5px] font-bold">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Selection Counter */}
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-slate-500">Selected for Merge:</span>
                <span className="px-1.5 py-0.2 rounded-full font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9.5px]">
                  {selectedEmployees.length} of {faculty.length} Staff
                </span>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search staff, CPIS..."
                  className="w-full pl-5 pr-2 py-0.5 text-[10.5px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'teaching', label: 'Teaching' },
                  { key: 'non_teaching', label: 'Non-Teach' }
                ].map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.key)}
                    className={`flex-1 py-0.5 text-center rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                      activeCategoryFilter === cat.key
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Staff Checkbox List (Ultra-Compact) */}
              <div className="max-h-28 sm:max-h-32 overflow-y-auto rounded border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
                {filteredFaculty.map((emp, idx) => {
                  const empId = emp.id || emp.cpis_no || emp.pan || `emp_${idx}`;
                  const isSelected = selectedEmployeeIds.includes(empId);
                  const vars = getEmployeeVariablesMap(emp);

                  return (
                    <div
                      key={empId}
                      onClick={() => toggleEmployeeSelection(empId)}
                      className={`flex items-center justify-between px-1.5 py-1 text-[10.5px] transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-amber-50/70 dark:bg-amber-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="shrink-0 text-amber-600 dark:text-amber-400">
                          {isSelected ? <CheckSquare size={12} /> : <Square size={12} className="text-slate-300 dark:text-slate-600" />}
                        </span>
                        <div className="truncate">
                          <div className="font-extrabold text-[10px] text-slate-900 dark:text-white truncate">
                            {vars.name}
                          </div>
                          <div className="text-[8.5px] text-slate-500 truncate">
                            {vars.designation}
                          </div>
                        </div>
                      </div>

                      <span className="text-[8.5px] font-mono text-slate-500 shrink-0">
                        {vars.cpis}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signatory Setup (Compact 2-col) */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Signatories:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[8.5px] text-slate-500 block truncate">Clerk / Dealing Asst:</span>
                  <input
                    type="text"
                    value={clerkSignatory}
                    onChange={(e) => setClerkSignatory(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-[9.5px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-500 block truncate">Principal / DDO:</span>
                  <input
                    type="text"
                    value={principalSignatory}
                    onChange={(e) => setPrincipalSignatory(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-[9.5px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            2. CENTRE COLUMN: OFFICIAL A4 LETTERHEAD PREVIEW & IN-PLACE CANVAS (6 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 space-y-1.5">
          
          {/* Top Canvas Bar: Live Preview Switcher & Mode Toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 shadow-2xs flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Eye size={13} className="text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                Official:
              </span>
              {selectedEmployees.length > 0 && (
                <div className="flex items-center gap-1">
                  <select
                    value={previewEmployeeIndex}
                    onChange={(e) => setPreviewEmployeeIndex(Number(e.target.value))}
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer max-w-[190px] truncate"
                  >
                    {selectedEmployees.map((emp, idx) => (
                      <option key={idx} value={idx}>
                        {emp.name} ({emp.designation || 'Staff'})
                      </option>
                    ))}
                  </select>
                  <span className="text-[9.5px] font-mono text-slate-500">
                    {previewEmployeeIndex + 1}/{selectedEmployees.length}
                  </span>
                </div>
              )}
            </div>

            {/* View Mode Toggle: Live Values vs Template Tokens */}
            <div className="flex items-center gap-1">
              <div className="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setCentreMode('preview')}
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                    centreMode === 'preview'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Show preview with active employee values filled in (Directly Editable)"
                >
                  <Eye size={10} />
                  <span>Live Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCentreMode('tokens')}
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                    centreMode === 'tokens'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Show raw template placeholder tokens (Directly Editable)"
                >
                  <Edit3 size={10} />
                  <span>Tokens ({'{{vars}}'})</span>
                </button>
              </div>

              <span className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold hidden sm:inline">
                ✏️ Click text to edit
              </span>
            </div>
          </div>

          {/* Official A4 Letterhead Sheet (Ultra-Compact Viewport Fitting) */}
          <div className="bg-slate-100 dark:bg-slate-950 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner flex justify-center overflow-x-auto">
            <div className="bg-white rounded-lg shadow-md border border-slate-300 w-full max-w-[560px] p-3 sm:p-3.5 text-slate-900 font-sans flex flex-col justify-between">
              
              <div>
                {/* Official Letterhead Header Banner (Soft Ice-Blue Background) */}
                <div
                  style={{
                    backgroundColor: '#f0f8ff',
                    borderBottom: '2px solid #800000',
                    padding: '6px 8px 5px 8px',
                    textAlign: 'center',
                    marginBottom: '6px',
                    borderRadius: '3px'
                  }}
                >
                  <img
                    src="/logo192.png"
                    alt="School Seal"
                    style={{
                      width: '26px',
                      height: '26px',
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto 2px auto'
                    }}
                    onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                  />
                  <div style={{ fontSize: '8px', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 1px 0', lineHeight: 1 }}>
                    OFFICE OF THE PRINCIPAL
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '900', color: '#0a192f', textTransform: 'uppercase', fontFamily: 'Georgia, serif', margin: '0 0 1px 0', lineHeight: 1.1 }}>
                    GOVT. HIGHER SECONDARY SCHOOL SHANGUS
                  </div>
                  <div style={{ fontSize: '7.5px', color: '#334155', fontWeight: '600', lineHeight: 1 }}>
                    Anantnag, Kashmir — 192201 (J&K) • AISHE: S-12345 • U-DISE: 01070800101
                  </div>
                </div>

                {/* Ref & Date Bar */}
                <div className="flex items-center justify-between text-[9px] font-semibold border-b border-slate-100 pb-0.5 mb-1.5">
                  <div>
                    <span className="text-[#800000] font-black">Ref. No.:</span> {centreMode === 'preview' ? previewInterpolatedRef : refNo}
                  </div>
                  <div>
                    <span className="text-[#800000] font-black">Date:</span> {dateStr}
                  </div>
                </div>

                {/* Document Body: Always Directly Editable in both modes with live insertion */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onSelect={saveSelection}
                  onMouseUp={saveSelection}
                  onFocus={saveSelection}
                  onKeyUp={() => {
                    saveSelection();
                    handleBodyEdit();
                  }}
                  onInput={handleBodyEdit}
                  className="text-[10px] sm:text-[10.5px] leading-snug sm:leading-relaxed text-slate-800 text-justify outline-none space-y-1 focus:ring-1 focus:ring-amber-500 rounded p-1 min-h-[160px] font-sans"
                />
              </div>

              {/* Signatories Footer */}
              <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-end justify-between text-[9.5px]">
                <div className="text-center min-w-[110px]">
                  <div className="h-[1px] w-20 bg-slate-400 mx-auto mb-0.5" />
                  <div className="font-extrabold text-[9.5px] text-slate-900">{clerkSignatory}</div>
                  <div className="text-[7.5px] text-slate-500 font-medium">Accounts Section, HSS Shangus</div>
                </div>

                <div className="text-center min-w-[110px]">
                  <div className="h-[1px] w-20 bg-slate-400 mx-auto mb-0.5" />
                  <div className="font-extrabold text-[9.5px] text-slate-900">{principalSignatory}</div>
                  <div className="text-[7.5px] text-slate-500 font-medium">Govt. Hr. Sec. School Shangus</div>
                </div>
              </div>

              {/* Institutional Watermark Footer */}
              <div className="mt-1 pt-0.5 border-t border-dashed border-slate-200 flex items-center justify-between text-[7px] text-slate-400 font-mono">
                <span>Official Dispatch Record • Govt HSS Shangus</span>
                <span>Page 1 of {selectedEmployees.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            3. RIGHT COLUMN: ACTIONS, FORMATTING TOOLS & PLACEHOLDERS (3 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-2">
          
          {/* Card A: Primary Print & Save Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-1.5">
            <span className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-1">
              Print &amp; Export Actions
            </span>

            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handleBatchPrint}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Merged Letters ({selectedEmployees.length})</span>
            </button>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleExportDocx}
                disabled={isExportingDocx}
                className="py-1 px-1.5 rounded-md text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                title="Download as Word (.docx)"
              >
                <Download size={11} className="text-blue-600 dark:text-blue-400" />
                <span>Word (.docx)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveToCloudHistory(true)}
                disabled={isSaving}
                className="py-1 px-1.5 rounded-md text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Save size={11} className="text-amber-600 dark:text-amber-400" />
                <span>Save Draft</span>
              </button>
            </div>

            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="w-full py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:underline flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>View Dispatch History &bull;</span>
              </button>
            )}
          </div>

          {/* Card B: Basic Formatting Tools */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-2xs space-y-1.5">
            <span className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-0.5">
              Formatting Ribbon
            </span>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => executeCmd('bold')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('italic')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('underline')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Underline (Ctrl+U)"
              >
                <Underline size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyLeft')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Align Left"
              >
                <AlignLeft size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyCenter')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Align Center"
              >
                <AlignCenter size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyRight')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Align Right"
              >
                <AlignRight size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyFull')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Justify"
              >
                <AlignJustify size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('insertUnorderedList')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Bulleted List"
              >
                <List size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('insertOrderedList')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Numbered List"
              >
                <ListOrdered size={12} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('removeFormat')}
                className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer text-[9.5px] font-bold"
                title="Remove Formatting"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Card C: Add Particular Placeholders into Letter */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-1">
              <Sparkles size={12} className="text-amber-500 shrink-0" />
              <span className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-wider">
                Insert Placeholders
              </span>
            </div>

            <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
              Click any variable to insert directly into letter at cursor:
            </p>

            {/* Categorized Placeholder Chips */}
            <div className="space-y-1.5 pt-0.5">
              <div>
                <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Identity:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { token: '{{name}}', label: 'Name' },
                    { token: '{{designation}}', label: 'Desig' },
                    { token: '{{cpis}}', label: 'CPIS' },
                    { token: '{{pan}}', label: 'PAN' },
                    { token: '{{parentage}}', label: 'Parent' },
                    { token: '{{dob}}', label: 'DOB' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer transition-transform hover:scale-105"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Salary &amp; Bank:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { token: '{{gross_salary}}', label: 'Gross' },
                    { token: '{{monthly_salary}}', label: 'Monthly' },
                    { token: '{{net_salary}}', label: 'Net' },
                    { token: '{{bank_account}}', label: 'Bank Acc' },
                    { token: '{{ifsc}}', label: 'IFSC' },
                    { token: '{{bank_name}}', label: 'Bank' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer transition-transform hover:scale-105"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Department &amp; Service:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { token: '{{department}}', label: 'Wing/Dept' },
                    { token: '{{cadre}}', label: 'Cadre' },
                    { token: '{{mobile}}', label: 'Mobile' },
                    { token: '{{email}}', label: 'Email' },
                    { token: '{{doj}}', label: 'DOJ' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer transition-transform hover:scale-105"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Dispatch Meta:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { token: '{{ref_no}}', label: 'Ref No' },
                    { token: '{{date}}', label: 'Date' },
                    { token: '{{academic_session}}', label: 'Session' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 cursor-pointer transition-transform hover:scale-105"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
