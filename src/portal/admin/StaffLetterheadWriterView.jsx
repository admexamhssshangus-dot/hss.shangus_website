// =================================================================
// HSS SHANGUS — Clerk Official Staff Letterhead & Mail Merge Studio
// Dedicated letterhead word processor with live employee variables & batch printing
// =================================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Printer, FileText, Calendar, Edit3, Save, RotateCcw,
  Bold, Italic, Underline, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Table as TableIcon,
  Check, Copy, Users, Search, CheckSquare, Square,
  Sparkles, ArrowRight, ShieldCheck, ChevronDown, Download,
  Eye, RefreshCw, AlertCircle, BookmarkPlus, Info
} from 'lucide-react';
import {
  STAFF_MERGE_VARIABLES,
  BUILTIN_STAFF_LETTER_TEMPLATES,
  getEmployeeVariablesMap,
  interpolateStaffVariables,
  printMergedStaffLetters
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
  const [subject, setSubject] = useState('Salary and Service Certificate in respect of {{name}}, {{designation}}.');
  const [bodyHtml, setBodyHtml] = useState(BUILTIN_STAFF_LETTER_TEMPLATES[0].bodyHtml);
  
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

  // Initialize selected employee IDs when faculty loads
  useEffect(() => {
    if (Array.isArray(faculty) && faculty.length > 0 && selectedEmployeeIds.length === 0) {
      setSelectedEmployeeIds(faculty.map((f, idx) => f.id || f.cpis_no || f.pan || `emp_${idx}`));
    }
  }, [faculty]);

  // Sync editor innerHTML when template changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== bodyHtml) {
      editorRef.current.innerHTML = bodyHtml;
    }
  }, [bodyHtml]);

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
      // Category filter
      if (activeCategoryFilter === 'teaching' && isNonTeaching(emp)) return false;
      if (activeCategoryFilter === 'non_teaching' && !isNonTeaching(emp)) return false;

      // Search term
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
    setSubject(t.subject || '');
    setBodyHtml(t.bodyHtml || '');
    if (editorRef.current) {
      editorRef.current.innerHTML = t.bodyHtml || '';
    }
    showToast(`Loaded template: ${t.name}`, 'info');
  };

  // Insert Variable Token into Editor
  const handleInsertVariable = (token) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    // Try document.execCommand for rich text insertion
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(token);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editorRef.current.innerHTML += token;
    }
    setBodyHtml(editorRef.current.innerHTML);
    showToast(`Inserted variable ${token}`, 'info');
  };

  // Execute Rich Text Command
  const executeCmd = (command, value = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
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

    const currentEditorContent = editorRef.current ? editorRef.current.innerHTML : bodyHtml;

    printMergedStaffLetters({
      templateHtml: currentEditorContent,
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

    // Auto archive to clerk history in the background
    handleSaveToCloudHistory(false);
  };

  // Save Document to History Archive
  const handleSaveToCloudHistory = async (showFeedback = true) => {
    try {
      setIsSaving(true);
      const currentEditorContent = editorRef.current ? editorRef.current.innerHTML : bodyHtml;
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
        bodyHtml: currentEditorContent,
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
        showToast('Official letter saved to Clerk Cloud History successfully!', 'success');
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

  // Interpolated Preview HTML for the right side canvas
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
    <div className="space-y-3 animate-fadeIn">
      {/* ─── TOP ACTION & TEMPLATE SELECTOR BAR ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Left: Template Selector + Ref + Date */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <FileText className="text-amber-600 dark:text-amber-500 shrink-0" size={15} />
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Template:</span>
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {BUILTIN_STAFF_LETTER_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>

            {/* Ref No Input */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Ref:</span>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="HSS/SHG/Estt/2026/___"
                className="text-xs font-mono font-semibold bg-transparent text-slate-900 dark:text-slate-100 outline-none w-36 sm:w-44"
              />
            </div>

            {/* Date Input */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
              <Calendar size={12} className="text-slate-600 dark:text-slate-400" />
              <input
                type="text"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="text-xs font-mono font-semibold bg-transparent text-slate-900 dark:text-slate-100 outline-none w-24"
              />
            </div>
          </div>

          {/* Right: Actions (Print Merged, Save, View History) */}
          <div className="flex items-center gap-1.5 flex-wrap self-end lg:self-auto">
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Dispatch History</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveToCloudHistory(true)}
              disabled={isSaving}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Save size={13} className="text-amber-600 dark:text-amber-400" />
              <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={handleBatchPrint}
              className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Merged Letters ({selectedEmployees.length})</span>
            </button>
          </div>
        </div>

        {/* Variable Tokens Toolbar */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <Sparkles size={12} className="text-amber-500" />
            <span>Click to insert Employee Mail Merge Variables into letter:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STAFF_MERGE_VARIABLES.map(v => (
              <button
                key={v.token}
                type="button"
                onClick={() => handleInsertVariable(v.token)}
                title={`Inserts ${v.label} (e.g. ${v.sample})`}
                className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer shadow-2xs hover:scale-105"
              >
                {v.token}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN WORKSPACE: LEFT (STAFF PICKER + EDITOR) & RIGHT (LIVE A4 PREVIEW) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ─── LEFT COLUMN: STAFF PICKER & RICH TEXT WORD PROCESSOR (7 COLS) ─── */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-3">
          
          {/* Card A: Selective Employee Picker */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-amber-600 dark:text-amber-500 shrink-0" />
                <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Target Staff Selection
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {selectedEmployees.length} of {faculty.length} Selected
                </span>
              </div>

              {/* Select All / Deselect All */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline px-1.5 py-0.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="text-[10px] font-bold text-slate-500 hover:underline px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Category Filter & Search Bar */}
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by name, CPIS, PAN, role..."
                  className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'teaching', label: 'Teaching' },
                  { key: 'non_teaching', label: 'Non-Teaching' }
                ].map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.key)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      activeCategoryFilter === cat.key
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Staff Checkbox Table */}
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
              {filteredFaculty.map((emp, idx) => {
                const empId = emp.id || emp.cpis_no || emp.pan || `emp_${idx}`;
                const isSelected = selectedEmployeeIds.includes(empId);
                const vars = getEmployeeVariablesMap(emp);

                return (
                  <div
                    key={empId}
                    onClick={() => toggleEmployeeSelection(empId)}
                    className={`flex items-center justify-between px-2.5 py-1.5 text-xs transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-amber-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-amber-600 dark:text-amber-400">
                        {isSelected ? <CheckSquare size={14} /> : <Square size={14} className="text-slate-300 dark:text-slate-600" />}
                      </span>
                      <div className="truncate">
                        <span className="font-extrabold text-slate-900 dark:text-white">{vars.name}</span>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 ml-1.5">({vars.designation})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10.5px]">
                      <span className="font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                        {vars.cpis}
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {vars.gross_salary}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card B: Rich Text Word Processor */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
            {/* Editor Formatting Ribbon */}
            <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                Format:
              </span>

              <button
                type="button"
                onClick={() => executeCmd('bold')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('italic')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('underline')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Underline (Ctrl+U)"
              >
                <Underline size={13} />
              </button>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <button
                type="button"
                onClick={() => executeCmd('justifyLeft')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Align Left"
              >
                <AlignLeft size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyCenter')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Align Center"
              >
                <AlignCenter size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyRight')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Align Right"
              >
                <AlignRight size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('justifyFull')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Justify"
              >
                <AlignJustify size={13} />
              </button>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <button
                type="button"
                onClick={() => executeCmd('insertUnorderedList')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Bullet List"
              >
                <List size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('insertOrderedList')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Numbered List"
              >
                <ListOrdered size={13} />
              </button>

              <button
                type="button"
                onClick={() => executeCmd('removeFormat')}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer text-[10px] font-bold"
                title="Remove Formatting"
              >
                Clear
              </button>
            </div>

            {/* Editable Canvas */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)}
              className="p-4 min-h-[300px] max-h-[460px] overflow-y-auto text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none leading-relaxed bg-white dark:bg-slate-900 font-sans focus:ring-1 focus:ring-amber-500/30"
              style={{ minHeight: '300px' }}
            />

            {/* Signatory Configuration Footer */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Clerk Signatory:</span>
                <input
                  type="text"
                  value={clerkSignatory}
                  onChange={(e) => setClerkSignatory(e.target.value)}
                  className="px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-full sm:w-44"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Principal Signatory:</span>
                <input
                  type="text"
                  value={principalSignatory}
                  onChange={(e) => setPrincipalSignatory(e.target.value)}
                  className="px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-full sm:w-44"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: LIVE A4 OFFICIAL LETTERHEAD CANVAS PREVIEW (5 COLS) ─── */}
        <div className="lg:col-span-6 xl:col-span-6">
          <div className="bg-slate-100 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-inner flex flex-col">
            
            {/* Preview Employee Switcher Toolbar */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Eye size={13} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Live Merged Preview:
                </span>
              </div>

              {selectedEmployees.length > 0 && (
                <div className="flex items-center gap-1">
                  <select
                    value={previewEmployeeIndex}
                    onChange={(e) => setPreviewEmployeeIndex(Number(e.target.value))}
                    className="text-[11px] font-bold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none cursor-pointer max-w-[200px] truncate"
                  >
                    {selectedEmployees.map((emp, idx) => (
                      <option key={idx} value={idx}>
                        {emp.name} ({emp.designation || 'Staff'})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {previewEmployeeIndex + 1}/{selectedEmployees.length}
                  </span>
                </div>
              )}
            </div>

            {/* A4 Sheet Container */}
            <div className="bg-white rounded-lg shadow-md border border-slate-300/80 p-5 sm:p-6 text-slate-900 font-sans min-h-[560px] flex flex-col justify-between overflow-x-auto">
              <div>
                {/* Official Letterhead Header Banner */}
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
                      width: '42px',
                      height: '42px',
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
                    <span className="text-[#800000] font-black">Ref. No.:</span> {previewInterpolatedRef}
                  </div>
                  <div>
                    <span className="text-[#800000] font-black">Date:</span> {dateStr}
                  </div>
                </div>

                {/* Live Interpolated Body Content */}
                <div
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewInterpolatedHtml) }}
                  className="text-xs sm:text-[13px] leading-relaxed text-slate-800 text-justify space-y-2"
                />
              </div>

              {/* Signatories Footer */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-end justify-between text-xs">
                <div className="text-center min-w-[140px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-[11px] text-slate-900">{clerkSignatory}</div>
                  <div className="text-[9.5px] text-slate-500 font-medium">Accounts Section, HSS Shangus</div>
                </div>

                <div className="text-center min-w-[140px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-[11px] text-slate-900">{principalSignatory}</div>
                  <div className="text-[9.5px] text-slate-500 font-medium">Govt. Hr. Sec. School Shangus</div>
                </div>
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="mt-2 text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
              <Info size={12} className="text-amber-500 shrink-0" />
              <span>When you click <strong>"Print Merged Letters"</strong>, separate letterhead sheets will be generated with a page break for each of the {selectedEmployees.length} selected employees.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
