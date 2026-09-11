import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  FileSpreadsheet, Plus, Trash2, Copy, Download, RefreshCw, 
  ArrowRight, Search, Check, AlertCircle, Sparkles, Users,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { streamMatches, resolveCertificateStream, normalizeRegistrationKey } from '../../../utils/certificateStudentResolution';
import { parseJkboseMarks } from '../../../utils/jkboseMarksParser';

/**
 * ExcelSpreadsheetGrid
 * Authentic tabular Excel-like spreadsheet interface for direct copy-paste.
 * Supports clipboard Ctrl+V tab-delimited paste, editable cells, row numbers,
 * column letters (A, B, C...), and pre-filling current cohort students.
 * Column 1 is strictly Board Registration Number (regNo).
 */
export default function ExcelSpreadsheetGrid({
  activeFields = [],
  onParseData,
  allStudents = [],
  targetClass = 'All',
  targetSession = '2025-26',
  targetStream = 'All',
  targetStatus = 'All',
  showToast
}) {
  // Generate letter labels for columns: A, B, C, D...
  const getColLetter = (index) => {
    return String.fromCharCode(65 + index); // 0 -> A, 1 -> B, etc.
  };

  const createBlankRow = (id = Date.now() + Math.random()) => {
    const row = { id: String(id), regNo: '' };
    activeFields.forEach(f => {
      row[f.key] = '';
    });
    return row;
  };

  // Grid rows state
  const [rows, setRows] = useState(() => {
    return Array.from({ length: 8 }, (_, i) => createBlankRow(i + 1));
  });

  const [sortCol, setSortCol] = useState('classRollNo');
  const [sortDir, setSortDir] = useState('asc');
  const [focusedCell, setFocusedCell] = useState(null); // { rowIndex, colKey }
  const gridContainerRef = useRef(null);

  // Sync rows whenever activeFields changes, preserving already typed values
  useEffect(() => {
    setRows(prev => prev.map(r => {
      const updated = { ...r };
      activeFields.forEach(f => {
        if (updated[f.key] === undefined) updated[f.key] = '';
      });
      return updated;
    }));
  }, [activeFields]);

  // Handle cell edit with live percentage & division computation
  const handleCellChange = (rowIndex, key, value) => {
    setRows(prev => {
      const copy = [...prev];
      const updatedRow = { ...copy[rowIndex], [key]: value };

      if (key === 'marks' || key === 'maxMarks' || key === 'result') {
        const rawM = key === 'marks' ? value : updatedRow.marks;
        const rawMax = key === 'maxMarks' ? value : (updatedRow.maxMarks || '500');
        const rawRes = key === 'result' ? value : (updatedRow.result || 'Qualified');
        if (rawM) {
          const parsed = parseJkboseMarks(rawM, rawMax, rawRes);
          if (updatedRow.percentage !== undefined && parsed.pctStr !== '—') {
            updatedRow.percentage = parsed.pctStr;
          }
          if (updatedRow.grade !== undefined && parsed.division !== '—') {
            updatedRow.grade = parsed.division;
          }
        }
      }

      copy[rowIndex] = updatedRow;
      return copy;
    });
  };

  // Add new blank row
  const handleAddRow = () => {
    setRows(prev => [...prev, createBlankRow()]);
  };

  // Remove a specific row
  const handleRemoveRow = (index) => {
    setRows(prev => {
      if (prev.length <= 1) return [createBlankRow()];
      return prev.filter((_, i) => i !== index);
    });
  };

  // Clear entire grid
  const handleClearGrid = () => {
    setRows(Array.from({ length: 8 }, (_, i) => createBlankRow(i + 1)));
    if (showToast) showToast('Cleared spreadsheet grid.', 'info');
  };

  // Interactive sorting for grid rows by column
  const handleSortGridBy = (columnKey) => {
    const nextDir = sortCol === columnKey && sortDir === 'asc' ? 'desc' : 'asc';
    setSortCol(columnKey);
    setSortDir(nextDir);

    setRows(prevRows => {
      const contentRows = prevRows.filter(r => r.regNo || Object.keys(r).some(k => k !== 'id' && k !== 'regNo' && r[k]));
      const emptyRows = prevRows.filter(r => !contentRows.includes(r));

      contentRows.sort((a, b) => {
        const valA = a[columnKey] || '';
        const valB = b[columnKey] || '';

        if (columnKey === 'classRollNo' || columnKey === 'rollNo') {
          const numA = parseInt(String(valA).match(/\d+/)?.[0] || '999999', 10);
          const numB = parseInt(String(valB).match(/\d+/)?.[0] || '999999', 10);
          if (numA !== numB) return nextDir === 'asc' ? numA - numB : numB - numA;
        }

        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        return nextDir === 'asc' ? comp : -comp;
      });

      return [...contentRows, ...emptyRows];
    });
  };

  // Pre-fill grid with students from the selected cohort (Default sorted by Class Roll No)
  const handlePreFillCohort = () => {
    const regMap = new Map();
    (allStudents || []).forEach(st => {
      const reg = normalizeRegistrationKey(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.']);
      if (reg) {
        if (!regMap.has(reg)) regMap.set(reg, []);
        regMap.get(reg).push(st);
      }
    });

    const filtered = (allStudents || []).filter(st => {
      const sCls = String(st.selectedClass || st.Class || st.class || st.className || st['Admission sought for class'] || '').toLowerCase();
      const sSess = String(st.selectedSession || st.Session || st.session || st.academicSession || '').toLowerCase();
      const reg = normalizeRegistrationKey(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.']);
      const history = reg ? (regMap.get(reg) || []) : [];
      const resolvedStrm = resolveCertificateStream(st, history, targetClass);
      const sStat = String(st.status || st.Status || st.admissionStatus || '').toLowerCase();

      const matchCls = targetClass === 'All' || sCls.includes(targetClass.toLowerCase());
      const matchSess = targetSession === 'All' || sSess.includes(targetSession.toLowerCase());
      const matchStrm = streamMatches(resolvedStrm, targetStream);
      const matchStat = targetStatus === 'All' || sStat === targetStatus.toLowerCase();

      return matchCls && matchSess && matchStrm && matchStat;
    });

    if (filtered.length === 0) {
      if (showToast) showToast(`No student records found matching current cohort filters.`, 'warning');
      return;
    }

    // Default sort by Class Roll No in natural numeric ascending order (1, 2, 3... 10... unassigned at end)
    filtered.sort((a, b) => {
      const getRollNum = (st) => {
        const rollVal = String(
          st.classRollNo || 
          st['Class Roll No'] || 
          st['Class Roll No.'] || 
          st.rollNo || 
          st['RL. NO.'] || 
          st['Class R.No.'] || 
          ''
        ).trim();
        const match = rollVal.match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };

      const diff = getRollNum(a) - getRollNum(b);
      if (diff !== 0) return diff;
      const nameA = String(a.studentName || a["Student's Name"] || '');
      const nameB = String(b.studentName || b["Student's Name"] || '');
      return nameA.localeCompare(nameB);
    });

    const cohortRows = filtered.map((st, idx) => {
      const reg = st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.'] || '';
      const r = { id: `cohort_${idx}_${Date.now()}`, regNo: reg };
      activeFields.forEach(f => {
        let val = '';
        for (const k of f.dbKeys) {
          if (st[k] !== undefined && String(st[k]).trim() !== '') {
            val = String(st[k]).trim();
            break;
          }
        }
        r[f.key] = val;
      });
      return r;
    });

    setSortCol('classRollNo');
    setSortDir('asc');
    setRows(cohortRows);
    if (showToast) showToast(`✓ Loaded & sorted ${cohortRows.length} students by Class Roll No (ascending)!`, 'success');
  };

  // Clipboard Paste Interceptor
  const handleGridPaste = useCallback((e) => {
    const text = e.clipboardData?.getData('text');
    if (!text || !text.trim()) return;

    // Check if pasted text contains tab delimiters or newline delimiters
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    // Prevent default browser text paste into single input if multi-cell
    if (lines.length > 1 || lines[0].includes('\t')) {
      e.preventDefault();

      const startRow = focusedCell?.rowIndex !== null && focusedCell?.rowIndex !== undefined ? focusedCell.rowIndex : 0;
      const parsedData = lines.map(line => line.split('\t').map(c => c.trim()));

      // Build ordered column key list: Column 0 is 'regNo', columns 1..N are activeFields
      const allColKeys = ['regNo', ...activeFields.map(f => f.key)];
      let startColIdx = 0;
      if (focusedCell?.colKey) {
        const foundIdx = allColKeys.indexOf(focusedCell.colKey);
        if (foundIdx >= 0) startColIdx = foundIdx;
      }

      setRows(prevRows => {
        const nextRows = [...prevRows];
        parsedData.forEach((rowValues, rIdx) => {
          const targetIndex = startRow + rIdx;
          const newRow = targetIndex < nextRows.length ? { ...nextRows[targetIndex] } : createBlankRow(`paste_${Date.now()}_${rIdx}`);
          
          rowValues.forEach((val, cIdx) => {
            const targetColKey = allColKeys[startColIdx + cIdx];
            if (targetColKey) {
              // When pasting into non-zero columns, regNo is preserved untouched
              newRow[targetColKey] = val;
            }
          });

          // Auto-calculate percentage and division if marks was pasted
          if (newRow.marks) {
            const parsed = parseJkboseMarks(newRow.marks, newRow.maxMarks || '500', newRow.result || 'Qualified');
            if (newRow.percentage !== undefined && (!newRow.percentage || newRow.percentage === '—') && parsed.pctStr !== '—') {
              newRow.percentage = parsed.pctStr;
            }
            if (newRow.grade !== undefined && (!newRow.grade || newRow.grade === '—') && parsed.division !== '—') {
              newRow.grade = parsed.division;
            }
          }

          if (targetIndex < nextRows.length) {
            nextRows[targetIndex] = newRow;
          } else {
            nextRows.push(newRow);
          }
        });

        return nextRows;
      });

      if (showToast) {
        showToast(`📋 Pasted ${lines.length} row(s) and ${parsedData[0]?.length || 1} column(s) into Excel grid!`, 'success');
      }
    }
  }, [focusedCell, activeFields, showToast]);

  // Parse grid rows and submit to 3-point matching engine
  const handleTriggerCompare = () => {
    // Filter rows that have at least a registration number or some field entered
    const validRows = rows.filter(r => r.regNo && r.regNo.trim().length > 0);
    
    if (validRows.length === 0) {
      if (showToast) {
        showToast('Please fill or paste at least one row with a valid Registration Number in Column A.', 'warning');
      }
      return;
    }

    // Convert grid rows into incoming format with normalized keys
    const incomingRows = validRows.map(r => {
      const rowObj = {
        'Board Registration Number': r.regNo.trim(),
        registrationno: r.regNo.trim(),
        regno: r.regNo.trim()
      };
      activeFields.forEach(f => {
        rowObj[f.label] = r[f.key] !== undefined ? String(r[f.key]).trim() : '';
        rowObj[f.key] = r[f.key] !== undefined ? String(r[f.key]).trim() : '';
      });

      // Auto-calculate percentage and division if not manually entered
      if (r.marks) {
        const parsed = parseJkboseMarks(r.marks, r.maxMarks || '500', r.result || 'Qualified');
        if (!rowObj['percentage'] && parsed.pctStr !== '—') rowObj['percentage'] = parsed.pctStr;
        if (!rowObj['Percentage'] && parsed.pctStr !== '—') rowObj['Percentage'] = parsed.pctStr;
        if (!rowObj['grade'] && parsed.division !== '—') rowObj['grade'] = parsed.division;
        if (!rowObj['Grade / Division'] && parsed.division !== '—') rowObj['Grade / Division'] = parsed.division;
      }

      return rowObj;
    });

    onParseData(incomingRows, 'Excel Tabular Spreadsheet Grid');
  };

  const nonEmptyRowCount = rows.filter(r => r.regNo && r.regNo.trim().length > 0).length;

  return (
    <div 
      ref={gridContainerRef}
      onPaste={handleGridPaste}
      className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm"
    >
      {/* Excel Top Ribbon Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#107c41] text-white flex items-center justify-center font-black shadow-xs">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 dark:text-white">
                Excel Tabular Clipboard Grid
              </h3>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Direct Ctrl+V Paste
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Copy rows from Excel or Google Sheets, click anywhere in the grid, and press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] border border-slate-300 dark:border-slate-700">Ctrl+V</kbd>
            </p>
          </div>
        </div>

        {/* Ribbon Tools */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Sort Controls */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown size={11} /> Sort:
            </span>
            <button
              type="button"
              onClick={() => handleSortGridBy('classRollNo')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                sortCol === 'classRollNo'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Sort natural numeric order by Class Roll No (1, 2, 3...)"
            >
              Roll No {sortCol === 'classRollNo' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button
              type="button"
              onClick={() => handleSortGridBy('regNo')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                sortCol === 'regNo'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Sort alphanumeric by Registration No"
            >
              Reg No {sortCol === 'regNo' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddRow}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            title="Add blank row at the bottom"
          >
            <Plus size={13} />
            <span>Add Row</span>
          </button>

          <button
            type="button"
            onClick={handlePreFillCohort}
            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1 border border-blue-200 dark:border-blue-800 cursor-pointer transition-colors"
            title="Load existing students from current cohort into grid"
          >
            <Users size={13} />
            <span>Load Cohort Records</span>
          </button>

          <button
            type="button"
            onClick={handleClearGrid}
            className="px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            title="Clear all rows"
          >
            <Trash2 size={13} />
            <span>Clear Grid</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-[380px] bg-slate-50/50 dark:bg-slate-950/50 custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[700px] text-xs">
          {/* Header Rows */}
          <thead>
            {/* Row 1: Column Letters (A, B, C, D...) */}
            <tr className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] text-center border-b border-slate-300 dark:border-slate-700">
              <th className="sticky left-0 z-30 w-10 py-1 border-r border-slate-300 dark:border-slate-700 bg-slate-300 dark:bg-slate-900 text-slate-700 dark:text-slate-400 select-none">
                #
              </th>
              <th className="sticky left-10 z-30 py-1 px-2 border-r border-slate-300 dark:border-slate-700 bg-emerald-700 text-white font-black tracking-wider min-w-[170px]">
                Col {getColLetter(0)} (Key)
              </th>
              {activeFields.map((field, idx) => (
                <th key={field.key} className="py-1 px-2 border-r border-slate-300 dark:border-slate-700 font-bold">
                  Col {getColLetter(idx + 1)}
                </th>
              ))}
              <th className="w-10 py-1"></th>
            </tr>

            {/* Row 2: Human Field Names */}
            <tr className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-black text-[11px] border-b-2 border-emerald-500 shadow-xs">
              <th className="sticky left-0 z-30 w-10 py-2 text-center text-slate-400 font-mono text-[10px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                —
              </th>
              <th 
                onClick={() => handleSortGridBy('regNo')}
                className="sticky left-10 z-30 py-2 px-3 border-r border-slate-200 dark:border-slate-800 text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 cursor-pointer select-none hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors min-w-[170px]"
                title="Click to sort by Registration No"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span>Registration No.</span>
                    <span className="text-rose-500 font-black">*</span>
                  </div>
                  {sortCol === 'regNo' ? (
                    sortDir === 'asc' ? <ArrowUp size={12} className="text-emerald-600" /> : <ArrowDown size={12} className="text-emerald-600" />
                  ) : (
                    <ArrowUpDown size={11} className="text-slate-400 opacity-40 hover:opacity-100" />
                  )}
                </div>
              </th>
              {activeFields.map((field) => (
                <th 
                  key={field.key}
                  onClick={() => handleSortGridBy(field.key)}
                  className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 truncate max-w-[180px] cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" 
                  title={`Click to sort by ${field.label}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{field.label}</span>
                    {sortCol === field.key ? (
                      sortDir === 'asc' ? <ArrowUp size={12} className="text-blue-600 flex-shrink-0" /> : <ArrowDown size={12} className="text-blue-600 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-400 opacity-40 hover:opacity-100 flex-shrink-0" />
                    )}
                  </div>
                </th>
              ))}
              <th className="w-10 py-2 text-center text-slate-400"></th>
            </tr>
          </thead>

          {/* Grid Rows */}
          <tbody>
            {rows.map((row, rIdx) => (
              <tr 
                key={row.id || rIdx}
                className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors border-b border-slate-200 dark:border-slate-800"
              >
                {/* Row Number (1, 2, 3...) */}
                <td className="sticky left-0 z-20 w-10 py-1 text-center font-mono text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-800 select-none">
                  {rIdx + 1}
                </td>

                {/* Column A: Registration No.* */}
                <td className="sticky left-10 z-20 p-0 border-r border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-950">
                  <input
                    type="text"
                    value={row.regNo || ''}
                    onChange={(e) => handleCellChange(rIdx, 'regNo', e.target.value)}
                    onFocus={() => setFocusedCell({ rowIndex: rIdx, colKey: 'regNo' })}
                    placeholder={`e.g. 2161234-2024-${String(rIdx + 1).padStart(4, '0')}`}
                    className="w-full px-2.5 py-1.5 bg-transparent border-0 focus:ring-2 focus:ring-emerald-500 rounded-none text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300 outline-none"
                  />
                </td>

                {/* Columns B..N: Active Fields */}
                {activeFields.map((field) => (
                  <td key={field.key} className="p-0 border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      value={row[field.key] || ''}
                      onChange={(e) => handleCellChange(rIdx, field.key, e.target.value)}
                      onFocus={() => setFocusedCell({ rowIndex: rIdx, colKey: field.key })}
                      placeholder={`Enter ${field.label}...`}
                      className="w-full px-2.5 py-1.5 bg-transparent border-0 focus:ring-2 focus:ring-blue-500 rounded-none text-xs text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </td>
                ))}

                {/* Row Delete Action */}
                <td className="w-10 p-1 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(rIdx)}
                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    title="Delete row"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid Bottom Action Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="text-[11px] text-slate-500 font-bold flex items-center gap-2">
          <span>{nonEmptyRowCount} student record(s) ready with Registration Numbers.</span>
          {activeFields.length > 0 && (
            <span className="text-slate-400">• {activeFields.length} data field(s) mapped across columns</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleTriggerCompare}
          disabled={nonEmptyRowCount === 0}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
        >
          <Search size={14} />
          <span>Parse & Compare Against Database ({nonEmptyRowCount})</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
