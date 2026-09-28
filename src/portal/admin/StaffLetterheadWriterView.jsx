// =================================================================
// HSS SHANGUS — Clerk Official Staff Letterhead & Mail Merge Studio
// High-Density 2-Column Minimal Layout:
// Left: Consolidated Controls (Templates, Actions, Formatting, Placeholders, Staff)
// Right: Official A4 Live Letterhead Preview & Canvas
// Supports Overwriting Templates, Duplicating & Modifying New Templates
// =================================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Printer, FileText, Calendar, Edit3, Save, RotateCcw,
  Bold, Italic, Underline, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered,
  Check, Copy, Users, Search, CheckSquare, Square,
  Sparkles, ChevronDown, ChevronLeft, ChevronRight, Download,
  Eye, RefreshCw, AlertCircle, Info, Plus, Trash2, X
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

const HSS_CLERK_TEMPLATES_STORAGE_KEY = 'hss_clerk_staff_letter_templates';

// Load stored templates from localStorage or fallback to built-ins
const getInitialTemplates = () => {
  try {
    const raw = localStorage.getItem(HSS_CLERK_TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const storedMap = new Map(parsed.map(t => [t.id, t]));
        // Built-ins with overrides applied
        const list = BUILTIN_STAFF_LETTER_TEMPLATES.map(b => storedMap.get(b.id) || b);
        // Custom templates added by user
        const builtinIds = new Set(BUILTIN_STAFF_LETTER_TEMPLATES.map(b => b.id));
        parsed.forEach(t => {
          if (!builtinIds.has(t.id)) {
            list.push(t);
          }
        });
        return list;
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored clerk letter templates:', e);
  }
  return BUILTIN_STAFF_LETTER_TEMPLATES;
};

export default function StaffLetterheadWriterView({
  faculty = [],
  user = null,
  onOpenHistory = null
}) {
  // Templates Management State
  const [templates, setTemplates] = useState(getInitialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || 'salary_service_certificate');

  // Active template object
  const currentTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0] || BUILTIN_STAFF_LETTER_TEMPLATES[0];
  }, [templates, selectedTemplateId]);

  // Document Core State
  const [refNo, setRefNo] = useState(currentTemplate?.refNo || 'HSS/SHG/Sal-Cert/2026/01');
  const [dateStr, setDateStr] = useState(new Date().toLocaleDateString('en-GB'));
  const [bodyHtml, setBodyHtml] = useState(currentTemplate?.bodyHtml || BUILTIN_STAFF_LETTER_TEMPLATES[0].bodyHtml);
  
  // View Mode for Canvas: 'preview' (Live Interpolated Preview) or 'tokens' (Template Tokens)
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

  // UI Toggles for Compactness
  const [showSignatories, setShowSignatories] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(true);

  // Duplication Modal State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');

  // Persist templates to localStorage
  const saveTemplatesList = (newTemplates) => {
    setTemplates(newTemplates);
    try {
      localStorage.setItem(HSS_CLERK_TEMPLATES_STORAGE_KEY, JSON.stringify(newTemplates));
    } catch (e) {
      console.warn('Failed to save clerk templates to localStorage:', e);
    }
  };

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
    const t = templates.find(tpl => tpl.id === templateId);
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

  // Overwrite Current Template Action
  const handleOverwriteTemplate = () => {
    const currentContent = editorRef.current ? editorRef.current.innerHTML : bodyHtml;
    const updated = templates.map(t => {
      if (t.id === selectedTemplateId) {
        return {
          ...t,
          bodyHtml: currentContent,
          refNo: refNo,
          isModified: true,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });
    saveTemplatesList(updated);
    showToast(`Template "${currentTemplate.name}" overwritten & saved!`, 'success');
  };

  // Open Duplicate Modal
  const handleOpenDuplicate = () => {
    setDuplicateName(`${currentTemplate.name} (Custom)`);
    setShowDuplicateModal(true);
  };

  // Confirm Duplicating Current Template into a New One
  const handleConfirmDuplicate = () => {
    const trimmedName = duplicateName.trim() || `${currentTemplate.name} (Copy)`;
    const newId = `custom_tpl_${Date.now()}`;
    const currentContent = editorRef.current ? editorRef.current.innerHTML : bodyHtml;

    const newTemplate = {
      id: newId,
      name: trimmedName,
      category: 'Custom Templates',
      desc: `Customized duplicate of ${currentTemplate.name}`,
      refNo: refNo || 'HSS/SHG/Custom/2026/',
      subject: currentTemplate.subject || '',
      bodyHtml: currentContent,
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    const updated = [...templates, newTemplate];
    saveTemplatesList(updated);
    setSelectedTemplateId(newId);
    setShowDuplicateModal(false);
    showToast(`New template "${trimmedName}" created and active!`, 'success');
  };

  // Delete Custom Template
  const handleDeleteCustomTemplate = (templateId) => {
    const target = templates.find(t => t.id === templateId);
    if (!target) return;
    if (!window.confirm(`Delete custom template "${target.name}"? This cannot be undone.`)) return;

    const updated = templates.filter(t => t.id !== templateId);
    saveTemplatesList(updated);
    const fallback = updated[0] || BUILTIN_STAFF_LETTER_TEMPLATES[0];
    setSelectedTemplateId(fallback.id);
    setRefNo(fallback.refNo || 'HSS/SHG/Estt/2026/');
    setBodyHtml(fallback.bodyHtml || '');
    showToast(`Deleted custom template "${target.name}".`, 'info');
  };

  // Reset Built-in Template to Default
  const handleResetToDefault = (templateId) => {
    const original = BUILTIN_STAFF_LETTER_TEMPLATES.find(t => t.id === templateId);
    if (!original) return;
    if (!window.confirm(`Reset template "${original.name}" to official school default? Your custom modifications to this template will be cleared.`)) return;

    const updated = templates.map(t => t.id === templateId ? { ...original } : t);
    saveTemplatesList(updated);
    setBodyHtml(original.bodyHtml);
    setRefNo(original.refNo);
    if (editorRef.current) {
      editorRef.current.innerHTML = centreMode === 'preview'
        ? interpolateStaffVariables(original.bodyHtml, currentPreviewEmployee, { refNo: original.refNo, dateStr, session: '2025–26' })
        : original.bodyHtml;
    }
    showToast(`Reset "${original.name}" to default.`, 'info');
  };

  // Insert Variable Token into Editor at cursor
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
      const tpl = templates.find(t => t.id === selectedTemplateId);
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

  // Navigate preview employee
  const handlePrevEmployee = () => {
    if (selectedEmployees.length <= 1) return;
    setPreviewEmployeeIndex(prev => (prev > 0 ? prev - 1 : selectedEmployees.length - 1));
  };

  const handleNextEmployee = () => {
    if (selectedEmployees.length <= 1) return;
    setPreviewEmployeeIndex(prev => (prev < selectedEmployees.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="animate-fadeIn">
      {/* ─── 2-COLUMN MINIMAL STUDIO LAYOUT (CONTROLS ON LEFT, PREVIEW ON RIGHT) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        
        {/* ══════════════════════════════════════════════════════════════════════
            1. LEFT PANEL: ALL COMPACT CONTROLS & STUDIO TOOLS (5 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-2">
          
          {/* ── CARD A: TEMPLATE SELECTOR, OVERWRITE & DUPLICATION ── */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-2">
            
            {/* Header: Title + Action Buttons */}
            <div className="flex items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="text-amber-600 dark:text-amber-500 shrink-0" size={13} />
                <span className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-wider truncate">
                  Official Template
                </span>
                {currentTemplate?.isCustom && (
                  <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                    Custom
                  </span>
                )}
                {currentTemplate?.isModified && !currentTemplate?.isCustom && (
                  <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                    Edited
                  </span>
                )}
              </div>

              {/* Template Action Buttons: Overwrite, Duplicate, Delete, Reset */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleOverwriteTemplate}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Overwrite/save current template changes"
                >
                  <Save size={10} />
                  <span>Overwrite</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenDuplicate}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Duplicate as a new custom template"
                >
                  <Copy size={10} />
                  <span>Duplicate</span>
                </button>

                {currentTemplate?.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomTemplate(currentTemplate.id)}
                    className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 transition-colors cursor-pointer"
                    title="Delete this custom template"
                  >
                    <Trash2 size={12} />
                  </button>
                )}

                {currentTemplate?.isModified && !currentTemplate?.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleResetToDefault(currentTemplate.id)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Reset to official default"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Template Selector Dropdown */}
            <div>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <optgroup label="Official Templates">
                  {templates.filter(t => !t.isCustom).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isModified ? '• (Edited)' : ''}
                    </option>
                  ))}
                </optgroup>
                {templates.some(t => t.isCustom) && (
                  <optgroup label="Custom Saved Templates">
                    {templates.filter(t => t.isCustom).map(t => (
                      <option key={t.id} value={t.id}>
                        ★ {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Ref No & Date Row */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <div>
                <label className="block text-[8.5px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                  Ref No:
                </label>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="HSS/SHG/..."
                  className="w-full text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[8.5px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                  Dispatch Date:
                </label>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Signatories Toggle & Fields */}
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSignatories(!showSignatories)}
                className="w-full flex items-center justify-between text-[9px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <span>Signatories Setup ({clerkSignatory} • {principalSignatory})</span>
                <span className="text-[8px]">{showSignatories ? '▲ Hide' : '▼ Edit'}</span>
              </button>

              {showSignatories && (
                <div className="grid grid-cols-2 gap-1.5 pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                  <div>
                    <span className="text-[8px] text-slate-400 block truncate">Dealing Assistant:</span>
                    <input
                      type="text"
                      value={clerkSignatory}
                      onChange={(e) => setClerkSignatory(e.target.value)}
                      className="w-full px-1.5 py-0.5 text-[9px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 block truncate">Principal / DDO:</span>
                    <input
                      type="text"
                      value={principalSignatory}
                      onChange={(e) => setPrincipalSignatory(e.target.value)}
                      className="w-full px-1.5 py-0.5 text-[9px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── CARD B: PRIMARY ACTIONS & COMPACT FORMATTING RIBBON ── */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-2">
            
            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handleBatchPrint}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Merged Letters ({selectedEmployees.length} Staff)</span>
            </button>

            {/* Secondary Export & Save Row */}
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={handleExportDocx}
                disabled={isExportingDocx}
                className="py-1 px-1 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 truncate"
                title="Download current letter as Word (.docx)"
              >
                <Download size={11} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">Word (.docx)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveToCloudHistory(true)}
                disabled={isSaving}
                className="py-1 px-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 truncate"
                title="Save snapshot to clerk dispatch archive"
              >
                <Save size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Save Draft</span>
              </button>

              {onOpenHistory ? (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="py-1 px-1 rounded-md text-[10px] font-bold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer truncate"
                  title="Open clerk dispatch archive"
                >
                  <span className="truncate">History •</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            {/* Compact Formatting Ribbon */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => executeCmd('bold')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => executeCmd('italic')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => executeCmd('underline')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Underline (Ctrl+U)"
                >
                  <Underline size={11} />
                </button>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => executeCmd('justifyLeft')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Align Left"
                >
                  <AlignLeft size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => executeCmd('justifyCenter')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Align Center"
                >
                  <AlignCenter size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => executeCmd('justifyRight')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Align Right"
                >
                  <AlignRight size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => executeCmd('justifyFull')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Justify"
                >
                  <AlignJustify size={11} />
                </button>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => executeCmd('insertUnorderedList')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Bulleted List"
                >
                  <List size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => executeCmd('insertOrderedList')}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Numbered List"
                >
                  <ListOrdered size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => executeCmd('removeFormat')}
                  className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer text-[9px] font-bold"
                  title="Clear formatting"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* ── CARD C: INSERT PLACEHOLDERS (COMPACT COLLAPSIBLE) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-2xs space-y-1">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
              <div className="flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500 shrink-0" />
                <span className="font-black text-[10px] text-slate-900 dark:text-white uppercase tracking-wider">
                  Insert Variables at Cursor
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                className="text-[9px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPlaceholders ? '▲ Hide' : '▼ Show'}
              </button>
            </div>

            {showPlaceholders && (
              <div className="pt-0.5 space-y-1 text-[9px]">
                {/* Identity */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[8px] font-black uppercase text-slate-400 w-11 shrink-0">Identity:</span>
                  {[
                    { token: '{{name}}', label: 'Name' },
                    { token: '{{designation}}', label: 'Desig' },
                    { token: '{{cpis}}', label: 'CPIS' },
                    { token: '{{pan}}', label: 'PAN' },
                    { token: '{{dob}}', label: 'DOB' },
                    { token: '{{parentage}}', label: 'Parent' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>

                {/* Salary */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[8px] font-black uppercase text-slate-400 w-11 shrink-0">Salary:</span>
                  {[
                    { token: '{{gross_salary}}', label: 'Gross' },
                    { token: '{{monthly_salary}}', label: 'Monthly' },
                    { token: '{{net_salary}}', label: 'Net' },
                    { token: '{{bank_account}}', label: 'Account' },
                    { token: '{{ifsc}}', label: 'IFSC' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>

                {/* Service & Meta */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[8px] font-black uppercase text-slate-400 w-11 shrink-0">Service:</span>
                  {[
                    { token: '{{department}}', label: 'Dept' },
                    { token: '{{cadre}}', label: 'Cadre' },
                    { token: '{{mobile}}', label: 'Mobile' },
                    { token: '{{doj}}', label: 'DOJ' },
                    { token: '{{ref_no}}', label: 'Ref No' },
                    { token: '{{date}}', label: 'Date' }
                  ].map(item => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => handleInsertVariable(item.token)}
                      className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer"
                      title={`Insert ${item.token}`}
                    >
                      {item.token}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CARD D: TARGET STAFF PICKER (COMPACT & RESPONSIVE) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <Users size={12} className="text-amber-600 dark:text-amber-500 shrink-0" />
                <span className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-wider truncate">
                  Target Staff
                </span>
                <span className="px-1.5 py-0.2 rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[8.5px] shrink-0">
                  {selectedEmployees.length}/{faculty.length}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[9px] font-bold shrink-0">
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

            {/* Search Input & Category Pills in Single Row */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search staff, CPIS..."
                  className="w-full pl-5 pr-2 py-0.5 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="flex rounded overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'teaching', label: 'Teach' },
                  { key: 'non_teaching', label: 'MTS' }
                ].map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.key)}
                    className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold transition-all cursor-pointer ${
                      activeCategoryFilter === cat.key
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff Checkbox List */}
            <div className="max-h-28 sm:max-h-32 overflow-y-auto rounded border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
              {filteredFaculty.map((emp, idx) => {
                const empId = emp.id || emp.cpis_no || emp.pan || `emp_${idx}`;
                const isSelected = selectedEmployeeIds.includes(empId);
                const vars = getEmployeeVariablesMap(emp);

                return (
                  <div
                    key={empId}
                    onClick={() => toggleEmployeeSelection(empId)}
                    className={`flex items-center justify-between px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-amber-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="shrink-0 text-amber-600 dark:text-amber-400">
                        {isSelected ? <CheckSquare size={11} /> : <Square size={11} className="text-slate-300 dark:text-slate-600" />}
                      </span>
                      <div className="truncate">
                        <span className="font-extrabold text-[9.5px] text-slate-900 dark:text-white truncate mr-1">
                          {vars.name}
                        </span>
                        <span className="text-[8px] text-slate-500 truncate">
                          ({vars.designation})
                        </span>
                      </div>
                    </div>

                    <span className="text-[8px] font-mono text-slate-500 shrink-0">
                      {vars.cpis}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            2. RIGHT PANEL: OFFICIAL A4 LETTERHEAD PREVIEW & DIRECT CANVAS (7 COLS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 space-y-1.5">
          
          {/* Top Canvas Bar: Official Selector, Employee Pager, Live/Token Toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 shadow-2xs flex items-center justify-between gap-1.5 flex-wrap">
            
            {/* Left: Active Official Picker + Previous/Next Pager */}
            <div className="flex items-center gap-1 min-w-0">
              <Eye size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-[10.5px] font-extrabold text-slate-800 dark:text-slate-200 shrink-0">
                Official:
              </span>
              
              {selectedEmployees.length > 0 && (
                <div className="flex items-center gap-0.5 min-w-0">
                  <select
                    value={previewEmployeeIndex}
                    onChange={(e) => setPreviewEmployeeIndex(Number(e.target.value))}
                    className="text-[10.5px] font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer max-w-[210px] truncate"
                  >
                    {selectedEmployees.map((emp, idx) => (
                      <option key={idx} value={idx}>
                        {emp.name} ({emp.designation || 'Staff'})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-0.5 shrink-0 ml-0.5">
                    <button
                      type="button"
                      onClick={handlePrevEmployee}
                      disabled={selectedEmployees.length <= 1}
                      className="p-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
                      title="Previous Staff Member"
                    >
                      <ChevronLeft size={11} />
                    </button>
                    <span className="text-[9px] font-mono text-slate-500 px-0.5">
                      {previewEmployeeIndex + 1}/{selectedEmployees.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextEmployee}
                      disabled={selectedEmployees.length <= 1}
                      className="p-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
                      title="Next Staff Member"
                    >
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Live Preview vs Tokens Toggle & Inline Edit Hint */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex rounded overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setCentreMode('preview')}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                    centreMode === 'preview'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                  title="Show live letter preview with active employee values filled in (Directly Editable)"
                >
                  <Eye size={10} />
                  <span>Live Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCentreMode('tokens')}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                    centreMode === 'tokens'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                  title="Show raw template tokens like {{name}} (Directly Editable)"
                >
                  <Edit3 size={10} />
                  <span>Tokens ({'{{vars}}'})</span>
                </button>
              </div>

              <span className="text-[8.5px] text-amber-700 dark:text-amber-400 font-semibold hidden xl:inline">
                ✏️ Click text to edit
              </span>
            </div>
          </div>

          {/* Official A4 Letterhead Sheet (Centered Canvas with Generous Margin) */}
          <div className="bg-slate-100 dark:bg-slate-950 p-2.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner flex justify-center overflow-x-auto">
            <div className="bg-white rounded-lg shadow-md border border-slate-300 w-full max-w-[620px] p-4 sm:p-6 text-slate-900 font-sans flex flex-col justify-between min-h-[580px]">
              
              <div>
                {/* Official Letterhead Header Banner (Soft Ice-Blue Background) */}
                <div
                  style={{
                    backgroundColor: '#f0f8ff',
                    borderBottom: '2px solid #800000',
                    padding: '8px 10px 6px 10px',
                    textAlign: 'center',
                    marginBottom: '8px',
                    borderRadius: '3px'
                  }}
                >
                  <img
                    src="/logo192.png"
                    alt="School Seal"
                    style={{
                      width: '28px',
                      height: '28px',
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto 2px auto'
                    }}
                    onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                  />
                  <div style={{ fontSize: '8.5px', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 1px 0', lineHeight: 1 }}>
                    OFFICE OF THE PRINCIPAL
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '900', color: '#0a192f', textTransform: 'uppercase', fontFamily: 'Georgia, serif', margin: '0 0 1px 0', lineHeight: 1.1 }}>
                    GOVT. HIGHER SECONDARY SCHOOL SHANGUS
                  </div>
                  <div style={{ fontSize: '8px', color: '#334155', fontWeight: '600', lineHeight: 1 }}>
                    Anantnag, Kashmir — 192201 (J&K) • AISHE: S-12345 • U-DISE: 01070800101
                  </div>
                </div>

                {/* Ref & Date Bar */}
                <div className="flex items-center justify-between text-[9.5px] font-semibold border-b border-slate-100 pb-1 mb-2">
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
                  className="text-[10.5px] sm:text-[11px] leading-relaxed text-slate-800 text-justify outline-none space-y-1.5 focus:ring-1 focus:ring-amber-500 rounded p-1.5 min-h-[220px] font-sans"
                />
              </div>

              {/* Signatories Footer */}
              <div className="mt-4 pt-2 border-t border-slate-100 flex items-end justify-between text-[10px]">
                <div className="text-center min-w-[120px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-[10px] text-slate-900">{clerkSignatory}</div>
                  <div className="text-[8px] text-slate-500 font-medium">Accounts Section, HSS Shangus</div>
                </div>

                <div className="text-center min-w-[120px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-[10px] text-slate-900">{principalSignatory}</div>
                  <div className="text-[8px] text-slate-500 font-medium">Govt. Hr. Sec. School Shangus</div>
                </div>
              </div>

              {/* Institutional Watermark Footer */}
              <div className="mt-2 pt-1 border-t border-dashed border-slate-200 flex items-center justify-between text-[7.5px] text-slate-400 font-mono">
                <span>Official Dispatch Record • Govt HSS Shangus</span>
                <span>Page 1 of {selectedEmployees.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL: DUPLICATE AS NEW TEMPLATE ─── */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Copy size={14} className="text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  Duplicate as New Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                New Template Title:
              </label>
              <input
                type="text"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="e.g. Salary Certificate (State Bank Format)"
                className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                autoFocus
              />
              <p className="text-[9.5px] text-slate-400 mt-1 leading-normal">
                This will clone the current letter's content, formatting, and variables into a new custom template that you can modify and overwrite anytime.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicate}
                className="px-3 py-1 text-xs font-black rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Create Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
