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
  
  // View Mode for Centre Canvas: 'preview' (Live Interpolated Preview) or 'edit' (In-Place Editor)
  const [centreMode, setCentreMode] = useState('preview');

  // Signatory State
  const [clerkSignatory, setClerkSignatory] = useState('Dealing Assistant / Accounts Clerk');
  const [principalSignatory, setPrincipalSignatory] = useState('Principal / DDO');
  
  // Staff Selection State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all'); // 'all', 'teaching', 'non_teaching'
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [previewEmployeeIndex, setPreviewEmployeeIndex] = useState(0);

  // Editor Ref
  const editorRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Initialize selected employee IDs when faculty loads
  useEffect(() => {
    if (Array.isArray(faculty) && faculty.length > 0 && selectedEmployeeIds.length === 0) {
      setSelectedEmployeeIds(faculty.map((f, idx) => f.id || f.cpis_no || f.pan || `emp_${idx}`));
    }
  }, [faculty]);

  // Sync editor innerHTML when bodyHtml or mode changes
  useEffect(() => {
    if (centreMode === 'edit' && editorRef.current && editorRef.current.innerHTML !== bodyHtml) {
      editorRef.current.innerHTML = bodyHtml;
    }
  }, [bodyHtml, centreMode]);

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

  // Handle Template Switching
  const handleSelectTemplate = (templateId) => {
    const t = BUILTIN_STAFF_LETTER_TEMPLATES.find(tpl => tpl.id === templateId);
    if (!t) return;
    setSelectedTemplateId(templateId);
    setRefNo(t.refNo || 'HSS/SHG/Estt/2026/');
    setBodyHtml(t.bodyHtml || '');
    if (editorRef.current) {
      editorRef.current.innerHTML = t.bodyHtml || '';
    }
    showToast(`Loaded template: ${t.name}`, 'info');
  };

  // Insert Variable Token into Editor
  const handleInsertVariable = (token) => {
    // If currently in preview mode, switch to edit mode first so the user sees the insertion
    if (centreMode !== 'edit') {
      setCentreMode('edit');
    }

    setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(` ${token} `);
        range.insertNode(node);
        range.setStartAfter(node);
        range.setEndAfter(node);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editorRef.current.innerHTML += ` ${token} `;
      }
      setBodyHtml(editorRef.current.innerHTML);
      showToast(`Inserted variable ${token}`, 'info');
    }, 50);
  };

  // Execute Rich Text Command
  const executeCmd = (command, value = null) => {
    if (centreMode !== 'edit') {
      setCentreMode('edit');
    }
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false, value);
        setBodyHtml(editorRef.current.innerHTML);
      }
    }, 50);
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

  // Interpolated Preview HTML for the centre canvas
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

  return (
    <div className="animate-fadeIn">
      {/* ─── 3-COLUMN STUDIO LAYOUT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* ══════════════════════════════════════════════════════════════════════
            1. LEFT COLUMN: TEMPLATE SELECTOR & TARGET STAFF PICKER (3 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-2.5">
          
          {/* Card A: Template Selection & Dispatch Meta */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <FileText className="text-amber-600 dark:text-amber-500 shrink-0" size={14} />
              <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Official Template
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Choose Document Template:
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {BUILTIN_STAFF_LETTER_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Dispatch Ref No:
                </label>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="HSS/SHG/Estt/..."
                  className="w-full text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Letter Date:
                </label>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Card B: Target Staff Selector */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-amber-600 dark:text-amber-500 shrink-0" />
                <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Target Staff
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10px] font-bold">
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
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="font-bold text-slate-600 dark:text-slate-400">Selected for Mail Merge:</span>
              <span className="px-1.5 py-0.2 rounded-full font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px]">
                {selectedEmployees.length} of {faculty.length} Staff
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff, CPIS, PAN..."
                className="w-full pl-6 pr-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 outline-none"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              {[
                { key: 'all', label: 'All' },
                { key: 'teaching', label: 'Teaching' },
                { key: 'non_teaching', label: 'Non-Teach' }
              ].map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat.key)}
                  className={`flex-1 py-0.5 text-center rounded text-[10px] font-bold transition-all cursor-pointer ${
                    activeCategoryFilter === cat.key
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Staff Checkbox List */}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
              {filteredFaculty.map((emp, idx) => {
                const empId = emp.id || emp.cpis_no || emp.pan || `emp_${idx}`;
                const isSelected = selectedEmployeeIds.includes(empId);
                const vars = getEmployeeVariablesMap(emp);

                return (
                  <div
                    key={empId}
                    onClick={() => toggleEmployeeSelection(empId)}
                    className={`flex items-center justify-between px-2 py-1.5 text-xs transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-amber-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="shrink-0 text-amber-600 dark:text-amber-400">
                        {isSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-slate-300 dark:text-slate-600" />}
                      </span>
                      <div className="truncate">
                        <div className="font-extrabold text-[11px] text-slate-900 dark:text-white truncate">
                          {vars.name}
                        </div>
                        <div className="text-[9.5px] text-slate-500 truncate">
                          {vars.designation}
                        </div>
                      </div>
                    </div>

                    <span className="text-[9.5px] font-mono text-slate-500 shrink-0">
                      {vars.cpis}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card C: Signatory Setup */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-1.5 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Signatories Footer:
            </span>
            <div>
              <span className="text-[9.5px] font-semibold text-slate-500">Clerk Signatory:</span>
              <input
                type="text"
                value={clerkSignatory}
                onChange={(e) => setClerkSignatory(e.target.value)}
                className="w-full px-2 py-0.5 text-[11px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
            <div>
              <span className="text-[9.5px] font-semibold text-slate-500">Principal Signatory:</span>
              <input
                type="text"
                value={principalSignatory}
                onChange={(e) => setPrincipalSignatory(e.target.value)}
                className="w-full px-2 py-0.5 text-[11px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            2. CENTRE COLUMN: OFFICIAL A4 LETTERHEAD PREVIEW & IN-PLACE CANVAS (6 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 space-y-2">
          
          {/* Top Canvas Bar: Live Preview Switcher & Mode Toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Eye size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                Preview Official:
              </span>
              {selectedEmployees.length > 0 && (
                <div className="flex items-center gap-1">
                  <select
                    value={previewEmployeeIndex}
                    onChange={(e) => setPreviewEmployeeIndex(Number(e.target.value))}
                    className="text-xs font-bold px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer max-w-[210px] truncate"
                  >
                    {selectedEmployees.map((emp, idx) => (
                      <option key={idx} value={idx}>
                        {emp.name} ({emp.designation || 'Staff'})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10.5px] font-mono text-slate-500">
                    {previewEmployeeIndex + 1}/{selectedEmployees.length}
                  </span>
                </div>
              )}
            </div>

            {/* Mode Switcher: Live Preview vs In-Place Editor */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setCentreMode('preview')}
                className={`px-2.5 py-1 rounded text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  centreMode === 'preview'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye size={11} />
                <span>Live Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setCentreMode('edit')}
                className={`px-2.5 py-1 rounded text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  centreMode === 'edit'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Edit3 size={11} />
                <span>Edit Letter Text</span>
              </button>
            </div>
          </div>

          {/* Official A4 Letterhead Sheet */}
          <div className="bg-slate-100 dark:bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner flex justify-center overflow-x-auto">
            <div className="bg-white rounded-lg shadow-md border border-slate-300 w-full max-w-[620px] min-h-[640px] p-6 sm:p-8 text-slate-900 font-sans flex flex-col justify-between">
              
              <div>
                {/* Official Letterhead Header Banner (Soft Ice-Blue Background) */}
                <div
                  style={{
                    backgroundColor: '#f0f8ff',
                    borderBottom: '2.5px solid #800000',
                    padding: '10px 12px 8px 12px',
                    textAlign: 'center',
                    marginBottom: '12px',
                    borderRadius: '4px'
                  }}
                >
                  <img
                    src="/logo192.png"
                    alt="School Seal"
                    style={{
                      width: '44px',
                      height: '44px',
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto 4px auto'
                    }}
                    onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                  />
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 2px 0' }}>
                    OFFICE OF THE PRINCIPAL
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: '#0a192f', textTransform: 'uppercase', fontFamily: 'Georgia, serif', margin: '0 0 2px 0' }}>
                    GOVT. HIGHER SECONDARY SCHOOL SHANGUS
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#334155', fontWeight: '600' }}>
                    Anantnag, Kashmir — 192201 (J&K) • AISHE: S-12345 • U-DISE: 01070800101
                  </div>
                </div>

                {/* Ref & Date Bar */}
                <div className="flex items-center justify-between text-[11px] font-semibold border-b border-slate-100 pb-2 mb-3">
                  <div>
                    <span className="text-[#800000] font-black">Ref. No.:</span> {centreMode === 'preview' ? previewInterpolatedRef : refNo}
                  </div>
                  <div>
                    <span className="text-[#800000] font-black">Date:</span> {dateStr}
                  </div>
                </div>

                {/* Document Body: Switch between Interpolated Preview and In-Place Editor */}
                {centreMode === 'preview' ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewInterpolatedHtml) }}
                    className="text-xs sm:text-[13px] leading-relaxed text-slate-800 text-justify space-y-2 min-h-[320px]"
                  />
                ) : (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mb-1">
                      ✏️ In-Place Edit Mode: Click inside to edit. Placeholders (e.g. {`{{name}}`}) will interpolate during preview/print.
                    </div>
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)}
                      className="p-3 rounded border border-amber-300 bg-amber-50/20 text-xs sm:text-[13px] leading-relaxed text-slate-900 outline-none min-h-[320px] focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                  </div>
                )}
              </div>

              {/* Signatories Footer */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-end justify-between text-xs">
                <div className="text-center min-w-[130px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-[11px] text-slate-900">{clerkSignatory}</div>
                  <div className="text-[9.5px] text-slate-500 font-medium">Accounts Section, HSS Shangus</div>
                </div>

                <div className="text-center min-w-[130px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-[11px] text-slate-900">{principalSignatory}</div>
                  <div className="text-[9.5px] text-slate-500 font-medium">Govt. Hr. Sec. School Shangus</div>
                </div>
              </div>

              {/* Institutional Watermark Footer */}
              <div className="mt-4 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[8px] text-slate-400 font-mono">
                <span>Official Dispatch Record • Govt HSS Shangus</span>
                <span>Page 1 of {selectedEmployees.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            3. RIGHT COLUMN: ACTIONS, FORMATTING TOOLS & PLACEHOLDERS (3 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-2.5">
          
          {/* Card A: Primary Print & Save Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs space-y-2">
            <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-1.5">
              Print &amp; Export Actions
            </span>

            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handleBatchPrint}
              className="w-full py-2 px-3 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Merged Letters ({selectedEmployees.length})</span>
            </button>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleExportDocx}
                disabled={isExportingDocx}
                className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                title="Download as Word (.docx)"
              >
                <Download size={12} className="text-blue-600 dark:text-blue-400" />
                <span>Word (.docx)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveToCloudHistory(true)}
                disabled={isSaving}
                className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Save size={12} className="text-amber-600 dark:text-amber-400" />
                <span>Save Draft</span>
              </button>
            </div>

            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="w-full py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:underline flex items-center justify-center gap-1 cursor-pointer pt-1"
              >
                <span>View Dispatch History &bull;</span>
              </button>
            )}
          </div>

          {/* Card B: Basic Formatting Tools */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-2">
            <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-1">
              Formatting Ribbon
            </span>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => executeCmd('bold')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('italic')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('underline')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Underline (Ctrl+U)"
              >
                <Underline size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyLeft')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Align Left"
              >
                <AlignLeft size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyCenter')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Align Center"
              >
                <AlignCenter size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyRight')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Align Right"
              >
                <AlignRight size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyFull')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Justify"
              >
                <AlignJustify size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('insertUnorderedList')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Bulleted List"
              >
                <List size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('insertOrderedList')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Numbered List"
              >
                <ListOrdered size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('removeFormat')}
                className="px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer text-[10px] font-bold"
                title="Remove Formatting"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Card C: Add Particular Placeholders into Letter */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs space-y-2">
            <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <Sparkles size={13} className="text-amber-500 shrink-0" />
              <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Insert Placeholders
              </span>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Click any placeholder below to inject it into the letter at the cursor position:
            </p>

            {/* Categorized Placeholder Chips */}
            <div className="space-y-2 pt-1">
              <div>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Employee Identity:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { token: '{{name}}', label: 'Name' },
                    { token: '{{designation}}', label: 'Desig' },
                    { token: '{{cpis}}', label: 'CPIS' },
                    { token: '{{pan}}', label: 'PAN' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer transition-transform hover:scale-105"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
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
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer transition-transform hover:scale-105"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Department &amp; Service:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { token: '{{department}}', label: 'Wing/Dept' },
                    { token: '{{cadre}}', label: 'Cadre' },
                    { token: '{{mobile}}', label: 'Mobile' },
                    { token: '{{doj}}', label: 'DOJ' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer transition-transform hover:scale-105"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
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
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 cursor-pointer transition-transform hover:scale-105"
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
