// =================================================================
// HSS SHANGUS — Custom Staff Roster & Register Builder Suite
// Flexible column selector, custom signature columns, Excel/CSV exports & PDF print
// =================================================================

import React, { useState, useMemo } from 'react';
import {
  Printer, FileSpreadsheet, Download, Plus, Trash2,
  Sliders, CheckSquare, Square, Eye, RotateCcw,
  Save, Users, Search, Columns, FileText, CheckCircle2,
  ArrowUpDown, Info, ChevronDown
} from 'lucide-react';
import {
  STANDARD_STAFF_ROSTER_COLUMNS,
  MORE_STAFF_ROSTER_COLUMNS,
  ALL_STAFF_ROSTER_COLUMNS,
  resolveStaffColumnValue,
  getEmployeeVariablesMap,
  printCustomStaffRoster,
  exportStaffRosterExcel,
  exportStaffRosterCsv
} from '../../utils/staffLetterMergeUtils';
import { saveGeneratedDocToHistory } from '../../services/docHistoryService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';

export default function CustomStaffRosterBuilderView({
  faculty = [],
  user = null,
  onOpenHistory = null
}) {
  // Document Titles
  const [title, setTitle] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [subtitle, setSubtitle] = useState('STAFF MASTER REGISTER & EMPLOYEE ROSTER (SESSION 2025–26)');
  const [orientation, setOrientation] = useState('landscape'); // 'portrait' | 'landscape'

  // Columns Configuration
  const [selectedColumnKeys, setSelectedColumnKeys] = useState(
    STANDARD_STAFF_ROSTER_COLUMNS.filter(c => c.defaultSelected).map(c => c.key)
  );

  // More Staff Columns Section State (Default expanded so user immediately sees all available columns)
  const [showMoreColumns, setShowMoreColumns] = useState(true);
  const [moreColumnsSearch, setMoreColumnsSearch] = useState('');

  // Custom Extra Columns (e.g. "Signature", "Exam Duty Room", "Material Issued")
  const [extraCustomColumns, setExtraCustomColumns] = useState([
    { key: 'custom_signature', label: 'Signature', widthPct: 12, align: 'center', isCustom: true }
  ]);
  const [newColumnName, setNewColumnName] = useState('');

  // Signatories
  const [clerkSignatory, setClerkSignatory] = useState('Dealing Assistant / Accounts Clerk');
  const [principalSignatory, setPrincipalSignatory] = useState('Principal / DDO');

  // Staff Filters & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(
    faculty.map((f, idx) => f.id || f.cpis_no || f.pan || `emp_${idx}`)
  );

  const [isSaving, setIsSaving] = useState(false);

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
        return name.includes(q) || cpis.includes(q) || pan.includes(q) || desig.includes(q);
      }
      return true;
    });
  }, [faculty, activeCategoryFilter, searchTerm]);

  // Selected Faculty List for Roster
  const selectedStaffList = useMemo(() => {
    if (!Array.isArray(faculty)) return [];
    const idSet = new Set(selectedEmployeeIds);
    return faculty.filter((f, idx) => idSet.has(f.id || f.cpis_no || f.pan || `emp_${idx}`));
  }, [faculty, selectedEmployeeIds]);

  // Active Standard & More Columns
  const activeStandardColumns = useMemo(() => {
    return ALL_STAFF_ROSTER_COLUMNS.filter(c => selectedColumnKeys.includes(c.key));
  }, [selectedColumnKeys]);

  // All Columns combined
  const allActiveColumns = useMemo(() => {
    return [...activeStandardColumns, ...extraCustomColumns];
  }, [activeStandardColumns, extraCustomColumns]);

  // Toggle Standard Column
  const toggleColumn = (key) => {
    if (key === 'sno' || key === 'name') return; // Essential columns
    setSelectedColumnKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // Add Custom Blank / Sign-Off Column
  const handleAddCustomColumn = () => {
    const trimmed = newColumnName.trim();
    if (!trimmed) return;
    const newKey = `custom_${Date.now()}`;
    setExtraCustomColumns(prev => [
      ...prev,
      { key: newKey, label: trimmed, widthPct: 12, align: 'center', isCustom: true }
    ]);
    setNewColumnName('');
    showToast(`Added custom column: ${trimmed}`, 'success');
  };

  const handleRemoveCustomColumn = (key) => {
    setExtraCustomColumns(prev => prev.filter(c => c.key !== key));
  };

  // Toggle Staff Selection
  const toggleEmployeeSelection = (id) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
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

  // Print Roster Action
  const handlePrintRoster = () => {
    if (selectedStaffList.length === 0) {
      showToast('No staff selected for roster.', 'warning');
      return;
    }

    printCustomStaffRoster({
      title,
      subtitle,
      columns: activeStandardColumns,
      rows: selectedStaffList,
      orientation,
      extraCustomColumns,
      clerkSignatory,
      principalSignatory
    });

    handleSaveToHistory(false);
  };

  // Excel Export Action
  const handleExportExcel = () => {
    if (selectedStaffList.length === 0) {
      showToast('No staff selected for export.', 'warning');
      return;
    }
    exportStaffRosterExcel({
      columns: activeStandardColumns,
      rows: selectedStaffList,
      extraCustomColumns,
      filename: `HSS_Shangus_Staff_Roster_${Date.now()}.xlsx`
    });
    showToast('Staff Roster exported to Excel successfully!', 'success');
  };

  // CSV Export Action
  const handleExportCsv = () => {
    if (selectedStaffList.length === 0) {
      showToast('No staff selected for export.', 'warning');
      return;
    }
    exportStaffRosterCsv({
      columns: activeStandardColumns,
      rows: selectedStaffList,
      extraCustomColumns,
      filename: `HSS_Shangus_Staff_Roster_${Date.now()}.csv`
    });
    showToast('Staff Roster exported to CSV successfully!', 'success');
  };

  // Save Roster to Cloud History
  const handleSaveToHistory = async (showFeedback = true) => {
    try {
      setIsSaving(true);
      await saveGeneratedDocToHistory({
        docType: 'clerk_staff_roster',
        title: `${subtitle} (${selectedStaffList.length} Staff)`,
        refNo: `ROSTER-${new Date().getFullYear()}`,
        dateStr: new Date().toLocaleDateString('en-GB'),
        recipientOrStudent: `Custom Staff Roster: ${selectedStaffList.length} Officials`,
        bodyHtml: `Columns: ${allActiveColumns.map(c => c.label).join(', ')}`,
        actionType: 'Saved to Cloud',
        templateName: 'Custom Staff Register Roster',
        extraData: {
          authorScope: 'accounts_clerk',
          authorRole: 'clerk',
          orientation,
          selectedCount: selectedStaffList.length,
          columnLabels: allActiveColumns.map(c => c.label),
          clerkSignatory,
          principalSignatory
        }
      });

      logAdminActivity({
        actionType: 'create',
        actionTitle: 'Custom Staff Roster Built',
        details: `Created customized staff register roster with ${allActiveColumns.length} columns for ${selectedStaffList.length} staff`,
        actorRole: 'Accounts Clerk'
      });

      if (showFeedback) {
        showToast('Staff Roster archived to Clerk History successfully!', 'success');
      }
    } catch (err) {
      console.error('Error saving roster history:', err);
      if (showFeedback) {
        showToast('Could not save roster history: ' + err.message, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* ─── TOP CONFIGURATION & EXPORT BAR ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Left: Titles & Orientation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="text-amber-600 dark:text-amber-500 shrink-0" size={15} />
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Roster Header:</span>
            </div>

            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Roster / Register Subtitle..."
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500 w-64 sm:w-80"
            />

            {/* Orientation Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                  orientation === 'portrait'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                  orientation === 'landscape'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Landscape
              </button>
            </div>
          </div>

          {/* Right: Export Actions */}
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
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Download as CSV"
            >
              <Download size={12} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1 cursor-pointer"
              title="Download as Excel (.xlsx)"
            >
              <FileSpreadsheet size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintRoster}
              className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Roster ({selectedStaffList.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2-COLUMN BUILDER WORKSPACE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Column Matrix & Staff Filters (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Card 1: Column Selector Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Columns size={14} className="text-amber-600 dark:text-amber-500 shrink-0" />
                <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Select Columns to Include
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold">
                {allActiveColumns.length} Active Columns
              </span>
            </div>

            {/* Standard Columns Checkboxes */}
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              {STANDARD_STAFF_ROSTER_COLUMNS.map(col => {
                const isSelected = selectedColumnKeys.includes(col.key);
                const isLocked = col.key === 'sno' || col.key === 'name';

                return (
                  <button
                    key={col.key}
                    type="button"
                    disabled={isLocked}
                    onClick={() => toggleColumn(col.key)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-md text-[11px] font-semibold text-left transition-colors border ${
                      isSelected
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    } ${isLocked ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                  >
                    {isSelected ? (
                      <CheckSquare size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <Square size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span className="truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ─── EXPANDABLE: MORE STAFF COLUMNS SECTION ─── */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mb-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => setShowMoreColumns(!showMoreColumns)}
                  className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer select-none"
                >
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showMoreColumns ? 'rotate-180' : ''}`} />
                  <span>More Staff Columns ({MORE_STAFF_ROSTER_COLUMNS.length} Available)</span>
                  {MORE_STAFF_ROSTER_COLUMNS.some(c => selectedColumnKeys.includes(c.key)) && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-mono font-bold">
                      {MORE_STAFF_ROSTER_COLUMNS.filter(c => selectedColumnKeys.includes(c.key)).length} Active
                    </span>
                  )}
                </button>

                {showMoreColumns && (
                  <div className="flex items-center gap-1 text-[9.5px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        const moreKeys = MORE_STAFF_ROSTER_COLUMNS.map(c => c.key);
                        setSelectedColumnKeys(prev => Array.from(new Set([...prev, ...moreKeys])));
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const moreKeys = new Set(MORE_STAFF_ROSTER_COLUMNS.map(c => c.key));
                        setSelectedColumnKeys(prev => prev.filter(k => !moreKeys.has(k)));
                      }}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {showMoreColumns && (
                <div className="space-y-1.5 animate-fadeIn">
                  {/* Search / Filter for more columns */}
                  <div className="relative">
                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={moreColumnsSearch}
                      onChange={(e) => setMoreColumnsSearch(e.target.value)}
                      placeholder="Filter more columns (e.g. parentage, dob, email)..."
                      className="w-full pl-5 pr-2 py-0.5 text-[10.5px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>

                  {/* Grid of More Columns */}
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 rounded-lg bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 no-scrollbar">
                    {MORE_STAFF_ROSTER_COLUMNS.filter(col => {
                      if (!moreColumnsSearch.trim()) return true;
                      const q = moreColumnsSearch.toLowerCase();
                      return col.label.toLowerCase().includes(q) || col.key.toLowerCase().includes(q);
                    }).map(col => {
                      const isSelected = selectedColumnKeys.includes(col.key);
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => toggleColumn(col.key)}
                          className={`flex items-center gap-1.5 p-1.5 rounded-md text-[10.5px] font-semibold text-left transition-colors border ${
                            isSelected
                              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
                              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          } cursor-pointer`}
                        >
                          {isSelected ? (
                            <CheckSquare size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                          ) : (
                            <Square size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className="truncate">{col.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Blank / Sign-Off Columns Section */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Add Custom Blank / Sign-Off Columns:
              </div>

              {/* Input for new column */}
              <div className="flex items-center gap-1.5 mb-2">
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomColumn(); }}
                  placeholder="e.g. Signature, Exam Duty Room, Remarks..."
                  className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomColumn}
                  className="px-2.5 py-1 text-xs font-black bg-amber-600 hover:bg-amber-500 text-white rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </div>

              {/* Extra Columns Chips List */}
              {extraCustomColumns.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {extraCustomColumns.map(col => (
                    <span
                      key={col.key}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    >
                      <span>{col.label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomColumn(col.key)}
                        className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 cursor-pointer ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Staff Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-amber-600 dark:text-amber-500 shrink-0" />
                <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Target Staff Enlistment
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {selectedStaffList.length} of {faculty.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline px-1 py-0.5 cursor-pointer"
                >
                  All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="text-[10px] font-bold text-slate-500 hover:underline px-1 py-0.5 cursor-pointer"
                >
                  None
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter staff list..."
                  className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'teaching', label: 'Teach' },
                  { key: 'non_teaching', label: 'Non-Teach' }
                ].map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.key)}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
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

            {/* Staff List Checkboxes */}
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
              {filteredFaculty.map((emp, idx) => {
                const empId = emp.id || emp.cpis_no || emp.pan || `emp_${idx}`;
                const isSelected = selectedEmployeeIds.includes(empId);
                const vars = getEmployeeVariablesMap(emp);

                return (
                  <div
                    key={empId}
                    onClick={() => toggleEmployeeSelection(empId)}
                    className={`flex items-center justify-between px-2.5 py-1 text-xs cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-amber-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-amber-600 dark:text-amber-400">
                        {isSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-slate-300 dark:text-slate-600" />}
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white truncate">{vars.name}</span>
                      <span className="text-[10px] text-slate-500 truncate">({vars.designation})</span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 shrink-0">
                      {vars.cpis}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Table Canvas Preview (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-slate-100 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-inner flex flex-col">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Eye size={13} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Live Staff Roster Preview
                </span>
              </div>
              <span className="text-[10.5px] font-mono text-slate-500">
                {selectedStaffList.length} staff &bull; {orientation.toUpperCase()}
              </span>
            </div>

            {/* A4 Sheet Container */}
            <div className="bg-white rounded-lg shadow-md border border-slate-300 p-4 sm:p-5 text-slate-900 font-sans overflow-x-auto min-h-[460px]">
              {/* Header */}
              <div className="text-center border-b-2 border-[#800000] pb-2 mb-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                  {title}
                </h1>
                <h2 className="text-xs font-extrabold text-[#800000] mt-0.5">
                  {subtitle}
                </h2>
                <div className="flex items-center justify-between text-[9px] text-slate-500 font-semibold mt-1">
                  <span>Enlisted Staff: <strong>{selectedStaffList.length}</strong></span>
                  <span>Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong></span>
                  <span>AISHE: S-12345 • U-DISE: 01070800101</span>
                </div>
              </div>

              {/* Roster Table */}
              <table className="w-full border-collapse border border-slate-400 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-extrabold text-center uppercase tracking-tight">
                    {allActiveColumns.map(col => (
                      <th
                        key={col.key}
                        style={{ textAlign: col.align || 'left' }}
                        className="border border-slate-400 p-1.5 font-black text-[9px]"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {selectedStaffList.map((emp, idx) => {
                    const vars = getEmployeeVariablesMap(emp);

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        {allActiveColumns.map(col => {
                          const val = resolveStaffColumnValue(col, emp, idx, vars, false);

                          return (
                            <td
                              key={col.key}
                              style={{ textAlign: col.align || 'left' }}
                              className="border border-slate-300 p-1"
                            >
                              {col.key === 'name' ? <strong>{val}</strong> : val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="mt-8 pt-4 flex items-end justify-between text-[10px]">
                <div className="text-center min-w-[120px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-slate-900">{clerkSignatory}</div>
                  <div className="text-[8.5px] text-slate-500">Dealing Assistant / Accounts</div>
                </div>

                <div className="text-center min-w-[120px]">
                  <div className="h-[1px] w-24 bg-slate-400 mx-auto mb-1" />
                  <div className="font-extrabold text-slate-900">{principalSignatory}</div>
                  <div className="text-[8.5px] text-slate-500">Govt. Hr. Sec. School Shangus</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
