import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Save, Hash, RefreshCw, AlertCircle, CheckCircle2, Wand2, 
  Search, Filter, Users, ArrowUpDown, ArrowUp, ArrowDown, 
  Sparkles, Check, X, ShieldAlert
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { updateCachedItem, invalidateCache, mergeDuplicateStudentApplications, getCachedCollectionSync } from '../../services/dbCache';

export default function RollNoAssignment({ applications = [], onRefresh }) {
  const [selectedClass, setSelectedClass] = useState('12th');
  const [selectedStream, setSelectedStream] = useState('All');
  const [sortField, setSortField] = useState('formNo'); // 'formNo' | 'name' | 'rollNo' | 'stream' | 'createdAt'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [startRollNo, setStartRollNo] = useState('101');
  const [filterView, setFilterView] = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [searchQuery, setSearchQuery] = useState('');
  const [formRangeQuery, setFormRangeQuery] = useState('');

  const [studentList, setStudentList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Helper to parse Form Number Range (e.g. 250001-250020, 250035, 1..10) or comma-separated list
  const parsedFormRange = useMemo(() => {
    if (!formRangeQuery || !formRangeQuery.trim()) return null;
    const rawTokens = formRangeQuery.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
    const validFormSet = new Set();
    const ranges = [];

    rawTokens.forEach(token => {
      // Check for range patterns: 250001-250020, 250001..250020, 250001 to 250020
      const rangeMatch = token.match(/^(?:#?(\d+))\s*(?:-|–|—|\.\.|to)\s*(?:#?(\d+))$/i);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          const cappedMax = Math.min(max, min + 5000);
          for (let i = min; i <= cappedMax; i++) {
            validFormSet.add(String(i));
          }
          ranges.push({ min, max: cappedMax });
        }
      } else {
        const clean = token.replace(/^#/, '').trim();
        if (clean) {
          validFormSet.add(clean);
          const numOnly = clean.replace(/[^0-9]/g, '');
          if (numOnly) validFormSet.add(numOnly);
        }
      }
    });

    return validFormSet.size > 0 ? { validFormSet, ranges, totalParsed: validFormSet.size } : null;
  }, [formRangeQuery]);

  // Helper to extract authentic Class Roll No (Never Board Exam Roll No)
  const extractClassRollNo = (a) => {
    const r = a['Class Roll No'] ?? a['Class Roll No.'] ?? a['Class R.No.'] ?? a.classRollNo ?? a.class_roll_no ?? '';
    const clean = String(r).trim();
    if (clean === '—' || clean === 'N/A' || clean === 'null' || clean === 'undefined') return '';
    return clean;
  };

  // Helper to extract clean Stream
  const extractStream = (a) => {
    const s = a['Stream for Class 11th'] || a['Stream opted in Class 11th'] || a['Stream & Subjects for Class 12th'] || a['Stream / Faculty'] || a['Stream'] || a.stream || a.Stream || '';
    const clean = String(s).trim();
    if (!clean || clean === '—' || clean === 'N/A' || clean === 'null' || clean === 'undefined' || clean === '-') {
      return 'General';
    }
    const lower = clean.toLowerCase();
    if (lower.includes('sci') || lower.includes('med')) return 'Science';
    if (lower.includes('hum') || lower.includes('art')) return 'Humanities';
    if (lower.includes('com')) return 'Commerce';
    if (lower.includes('gen')) return 'General';
    return clean;
  };

  // Robust class matcher for flexible naming (e.g. '10', '10th', 'Class 10', 'Class 10th', 'X')
  const matchesClass = useCallback((a, targetClass) => {
    if (!targetClass || targetClass === 'All') return true;
    const cls = String(a['Admission sought for class'] || a['Class'] || a.class || a.className || '').trim().toLowerCase();
    const sel = String(targetClass).trim().toLowerCase();
    if (sel.includes('10')) return cls.includes('10') || cls === 'x' || cls === 'class x';
    if (sel.includes('11')) return cls.includes('11') || cls === 'xi' || cls === 'class xi';
    if (sel.includes('12')) return cls.includes('12') || cls === 'xii' || cls === 'class xii';
    if (sel.includes('9')) return cls.includes('9') || cls === 'ix' || cls === 'class ix';
    return cls.includes(sel);
  }, []);

  // Effective applications fallback to cache if prop is temporarily empty during hydration
  const effectiveApps = useMemo(() => {
    if (applications && applications.length > 0) return applications;
    return getCachedCollectionSync('admissions') || [];
  }, [applications]);

  // Dynamically compute all unique streams & counts for selected class directly from live database
  const availableStreams = useMemo(() => {
    const classRecords = effectiveApps.filter((a) => matchesClass(a, selectedClass));

    const streamCounts = {};
    classRecords.forEach((a) => {
      const s = extractStream(a);
      streamCounts[s] = (streamCounts[s] || 0) + 1;
    });

    return Object.entries(streamCounts).map(([stream, count]) => ({ stream, count }));
  }, [effectiveApps, selectedClass, matchesClass]);

  // Auto-reset stream filter to 'All' if selectedStream is not present in new class
  useEffect(() => {
    if (selectedStream !== 'All' && !availableStreams.some(s => s.stream.toLowerCase() === selectedStream.toLowerCase())) {
      setSelectedStream('All');
    }
  }, [selectedClass, availableStreams, selectedStream]);

  // Prepare & Filter Raw Roster
  const prepareRoster = useCallback(() => {
    let filtered = effectiveApps.filter((a) => {
      const stream = extractStream(a);
      const isClassMatch = matchesClass(a, selectedClass);
      const matchesStream = selectedStream === 'All' || stream.toLowerCase() === selectedStream.toLowerCase();
      return isClassMatch && matchesStream;
    });

    const formatted = filtered.map((a) => {
      const classRoll = extractClassRollNo(a);
      return {
        docId: a.id || a['Form Number'] || a['FormNo'] || '',
        formNo: a['Form Number'] || a['FormNo'] || a['formNumber'] || a.id || '',
        name: a["Student's Name (as per school records)"] || a["Student's Name"] || a['Full Name'] || a['Name'] || a['Account Name'] || 'Student',
        class: a['Admission sought for class'] || a['Class'] || selectedClass,
        stream: extractStream(a),
        rollNo: classRoll,
        initialRollNo: classRoll,
        createdAt: a.createdAt || a.timestamp || a.submissionDate || ''
      };
    });

    setStudentList(formatted);
  }, [applications, selectedClass, selectedStream]);

  useEffect(() => {
    prepareRoster();
  }, [prepareRoster]);

  // Handle single roll number edit
  const handleRollNoChange = (docId, val) => {
    setStudentList((prev) =>
      prev.map((s) => (s.docId === docId ? { ...s, rollNo: val } : s))
    );
  };

  // Header click handler for 2-way sort
  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sort & Filtered Students for View
  const sortedAndFilteredStudents = useMemo(() => {
    let list = studentList.filter(s => {
      if (filterView === 'unassigned' && s.rollNo.trim()) return false;
      if (filterView === 'assigned' && !s.rollNo.trim()) return false;

      // Form Number Range / Comma Filter
      if (parsedFormRange) {
        const cleanForm = String(s.formNo || '').replace(/^#/, '').trim();
        const numOnly = cleanForm.replace(/[^0-9]/g, '');
        const matchesRange = parsedFormRange.validFormSet.has(cleanForm) || 
                             (numOnly && parsedFormRange.validFormSet.has(numOnly)) || 
                             parsedFormRange.validFormSet.has(String(s.docId));
        if (!matchesRange) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return s.name.toLowerCase().includes(q) || 
               String(s.formNo).toLowerCase().includes(q) || 
               String(s.rollNo).toLowerCase().includes(q) ||
               s.stream.toLowerCase().includes(q);
      }
      return true;
    });

    // Multi-Variable Sorting
    list.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'formNo') {
        const numA = parseInt(a.formNo, 10) || 0;
        const numB = parseInt(b.formNo, 10) || 0;
        comparison = numA - numB;
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'rollNo') {
        const hasA = a.rollNo.trim().length > 0;
        const hasB = b.rollNo.trim().length > 0;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (!hasA && !hasB) return 0;
        
        const rollNumA = parseInt(a.rollNo, 10);
        const rollNumB = parseInt(b.rollNo, 10);
        if (!isNaN(rollNumA) && !isNaN(rollNumB)) {
          comparison = rollNumA - rollNumB;
        } else {
          comparison = a.rollNo.localeCompare(b.rollNo);
        }
      } else if (sortField === 'stream') {
        comparison = a.stream.localeCompare(b.stream);
      } else if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [studentList, filterView, searchQuery, formRangeQuery, parsedFormRange, sortField, sortOrder]);

  // Auto-fill roll numbers starting from startRollNo for currently targeted/filtered students
  const handleAutoFill = () => {
    let current = parseInt(startRollNo || 101, 10);
    if (isNaN(current)) current = 101;
    
    if (sortedAndFilteredStudents.length === 0) {
      setAlert({ type: 'error', text: 'No students match the current filters or range.' });
      return;
    }

    const targetDocMap = new Map();
    sortedAndFilteredStudents.forEach((st) => {
      if (filterView === 'unassigned' && st.rollNo.trim()) {
        targetDocMap.set(st.docId, st.rollNo);
      } else {
        targetDocMap.set(st.docId, String(current++));
      }
    });

    setStudentList((prev) => {
      return prev.map((s) => {
        if (targetDocMap.has(s.docId)) {
          return {
            ...s,
            rollNo: targetDocMap.get(s.docId)
          };
        }
        return s;
      });
    });

    const countAssigned = sortedAndFilteredStudents.length;
    setAlert({
      type: 'success',
      text: `⚡ Auto-filled roll numbers for ${countAssigned} student(s) ${formRangeQuery ? `(Range: ${formRangeQuery})` : ''} starting from ${startRollNo}!`
    });
  };

  // Statistics
  const stats = useMemo(() => {
    const total = studentList.length;
    const assigned = studentList.filter(s => s.rollNo.trim().length > 0).length;
    const unassigned = total - assigned;
    const changed = studentList.filter(s => s.rollNo !== s.initialRollNo).length;
    return { total, assigned, unassigned, changed };
  }, [studentList]);

  // ─── 100% Native Firestore Batch Save ───
  const handleSaveRollNos = async () => {
    if (studentList.length === 0) return;
    setSaving(true);
    setAlert(null);

    try {
      const modifiedStudents = studentList.filter(s => s.docId && s.rollNo !== s.initialRollNo);

      if (modifiedStudents.length === 0) {
        setAlert({ type: 'success', text: 'No roll number changes detected.' });
        setSaving(false);
        return;
      }

      // Batch write in chunks of 400
      const BATCH_SIZE = 400;
      for (let i = 0; i < modifiedStudents.length; i += BATCH_SIZE) {
        const chunk = modifiedStudents.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(s => {
          const cleanRoll = s.rollNo.trim();
          const targetRef = doc(db, 'admissions', String(s.docId));
          batch.set(targetRef, {
            'Class Roll No': cleanRoll,
            classRollNo: cleanRoll,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Optimistically update local cache
          updateCachedItem('admissions', String(s.docId), {
            'Class Roll No': cleanRoll,
            classRollNo: cleanRoll
          });
        });

        await batch.commit();
      }

      invalidateCache('admissions');

      // Update initial roll numbers state
      setStudentList(prev => prev.map(s => ({ ...s, initialRollNo: s.rollNo })));

      setAlert({ 
        type: 'success', 
        text: `Saved Class Roll Numbers for ${modifiedStudents.length} students in Cloud Database!` 
      });

      if (onRefresh) onRefresh(true);
    } catch (err) {
      console.error('Save roll numbers error:', err);
      setAlert({ type: 'error', text: 'Failed to update roll numbers: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const [layoutMode, setLayoutMode] = useState('grid5'); // 'grid5', 'grid10', 'table'

  return (
    <div className="space-y-2.5 animate-fadeIn text-xs select-none">
      
      {/* Unified Single-Row Desktop Control Bar (Strictly 1 Row) */}
      <div className="p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
        
        {/* Group 1: Class Selector */}
        <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black shrink-0">
          {['12th', '11th', '10th', '9th'].map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setSelectedClass(cls)}
              className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                selectedClass === cls
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

        {/* Group 2: View Filter (All / Unassig. / Assig.) */}
        <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black shrink-0">
          {[
            { id: 'all', label: `All (${studentList.length})` },
            { id: 'unassigned', label: `Unassig. (${stats.unassigned})` },
            { id: 'assigned', label: `Assig. (${stats.assigned})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterView(tab.id)}
              className={`px-2 py-0.5 rounded-lg text-xs transition-all cursor-pointer ${
                filterView === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Group 3: Compact Search Bar */}
        <div className="relative min-w-[130px] max-w-[180px] flex-1 shrink-0">
          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student..."
            className="w-full pl-8 pr-6 py-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Group 3B: Form # Range & Comma Selector */}
        <div className="relative min-w-[180px] max-w-[240px] flex-1 shrink-0">
          <Hash size={12} className={`absolute left-2.5 top-2.5 ${formRangeQuery.trim() ? 'text-amber-600' : 'text-slate-400'}`} />
          <input
            type="text"
            value={formRangeQuery}
            onChange={(e) => setFormRangeQuery(e.target.value)}
            placeholder="Form range: 250001-20, 250035..."
            className={`w-full pl-8 pr-6 py-1 rounded-xl text-xs font-mono font-bold border transition-all ${
              formRangeQuery.trim()
                ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/20'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white'
            }`}
            title="Type range of form numbers (e.g. 250001-250020) or comma-separated form numbers (e.g. 250001, 250005, 250012)"
          />
          {formRangeQuery && (
            <button
              onClick={() => setFormRangeQuery('')}
              className="absolute right-1.5 top-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-white cursor-pointer"
              title="Clear form range filter"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Group 4: Stream & Sort Filters */}
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={selectedStream}
            onChange={(e) => setSelectedStream(e.target.value)}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
          >
            <option value="All">
              All Streams ({applications.filter((a) => {
                const cls = String(a['Admission sought for class'] || a['Class'] || a.class || '').trim();
                return cls.includes(selectedClass) || cls === selectedClass;
              }).length})
            </option>
            {availableStreams.map(({ stream, count }) => (
              <option key={stream} value={stream}>
                {stream} ({count})
              </option>
            ))}
          </select>

          <select
            value={`${sortField}_${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('_');
              setSortField(field);
              setSortOrder(order);
            }}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
          >
            <option value="formNo_asc">Sort: Form # (Asc)</option>
            <option value="formNo_desc">Sort: Form # (Desc)</option>
            <option value="rollNo_asc">Sort: Roll No (1 → 200)</option>
            <option value="rollNo_desc">Sort: Roll No (200 → 1)</option>
            <option value="name_asc">Sort: Name (A → Z)</option>
            <option value="stream_asc">Sort: Stream</option>
          </select>
        </div>

        {/* Group 5: Auto-Fill & Layout Mode Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10.5px] font-black text-slate-500 pl-1.5">Start:</span>
            <input
              type="number"
              value={startRollNo}
              onChange={(e) => setStartRollNo(e.target.value)}
              className="w-14 px-1.5 py-0.5 rounded-lg font-mono font-black text-xs text-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs"
            />
            <button
              type="button"
              onClick={handleAutoFill}
              className="px-2 py-0.5 rounded-lg text-xs font-black text-white bg-amber-600 hover:bg-amber-500 flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
            >
              <Wand2 size={11} />
              <span>Auto-Fill</span>
            </button>
          </div>

          {/* View Toggle Segmented Control (5-Col / 10-Col / Table) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {[
              { id: 'grid5', label: '5-Col' },
              { id: 'grid10', label: '10-Col' },
              { id: 'table', label: 'Table' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setLayoutMode(m.id)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                  layoutMode === m.id ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Save Button */}
          {stats.changed > 0 && (
            <button
              type="button"
              onClick={handleSaveRollNos}
              disabled={saving}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all animate-pulse shrink-0"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              <span>Save ({stats.changed})</span>
            </button>
          )}
        </div>
      </div>

      {/* Range Active Indicator Banner */}
      {formRangeQuery.trim() && (
        <div className="p-1.5 px-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-center justify-between text-xs font-black animate-fadeIn gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-600 text-white font-mono text-[10.5px]">Range Active</span>
            <span>Targeting <strong className="text-amber-700 dark:text-amber-300 underline font-black">{sortedAndFilteredStudents.length}</strong> student(s) matching Form(s) <span className="font-mono">{formRangeQuery}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFill}
              className="px-2.5 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-black cursor-pointer shadow-2xs transition-all flex items-center gap-1"
            >
              <Wand2 size={11} />
              <span>Auto-Fill Range ({startRollNo} → {parseInt(startRollNo || 101, 10) + sortedAndFilteredStudents.length - 1})</span>
            </button>
            <button
              type="button"
              onClick={() => setFormRangeQuery('')}
              className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10.5px] font-black cursor-pointer"
            >
              Clear Range ✕
            </button>
          </div>
        </div>
      )}

      {/* Alert Notification */}
      {alert && (
        <div className={`p-2 rounded-xl text-xs font-black flex items-center justify-between gap-2 border ${
          alert.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800'
        }`}>
          <div className="flex items-center gap-1.5">
            {alert.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="p-0.5 hover:opacity-70 cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {/* Roster Area: 5-Col Grid / 10-Col Grid / Full Table */}
      {layoutMode === 'grid5' ? (
        /* 5-Column Compact Grid View */
        <div className="p-1.5 bg-slate-100/70 dark:bg-slate-950/70 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[620px] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
            {sortedAndFilteredStudents.map((st, idx) => {
              const isModified = st.rollNo !== st.initialRollNo;
              return (
                <div
                  key={st.docId || idx}
                  className={`p-1.5 rounded-xl border flex items-center justify-between gap-1.5 transition-all ${
                    isModified
                      ? 'bg-purple-50/95 border-purple-400 dark:bg-purple-950/60 dark:border-purple-800 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400/60 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="font-mono text-[10px] font-black text-slate-400 w-4 text-center flex-shrink-0">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-black text-[11.5px] text-slate-900 dark:text-white truncate max-w-[85px]" title={st.name}>
                          {st.name}
                        </span>
                        <span className="font-mono text-[9.5px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-900/60">
                          #{st.formNo}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[9.5px] text-slate-500 font-bold mt-0.5">
                        <span>{st.class}</span>
                        <span>•</span>
                        <span className="text-slate-600 dark:text-slate-400 font-semibold truncate max-w-[65px]">{st.stream}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <input
                      type="text"
                      value={st.rollNo}
                      onChange={(e) => handleRollNoChange(st.docId, e.target.value)}
                      placeholder="—"
                      className={`w-14 px-1.5 py-0.5 rounded-lg text-center font-mono font-black text-xs border transition-all ${
                        st.rollNo.trim()
                          ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 shadow-2xs font-extrabold'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-400 italic'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {sortedAndFilteredStudents.length === 0 && (
            <div className="p-8 text-center text-slate-400 font-bold">
              No students found matching filters for {selectedClass}.
            </div>
          )}
        </div>
      ) : layoutMode === 'grid10' ? (
        /* 10-Column Ultra-Compact Micro Tile Grid View */
        <div className="p-1.5 bg-slate-100/70 dark:bg-slate-950/70 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[640px] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-1">
            {sortedAndFilteredStudents.map((st, idx) => {
              const isModified = st.rollNo !== st.initialRollNo;
              return (
                <div
                  key={st.docId || idx}
                  className={`p-1 rounded-lg border flex flex-col justify-between gap-1 transition-all ${
                    isModified
                      ? 'bg-purple-50/95 border-purple-400 dark:bg-purple-950/60 dark:border-purple-800 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400/60 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-0.5 min-w-0">
                    <span className="font-mono text-[9px] font-black text-slate-400">{idx + 1}</span>
                    <span className="font-mono text-[9px] font-black text-amber-600 truncate">#{st.formNo}</span>
                  </div>
                  <div className="font-black text-[10.5px] text-slate-900 dark:text-white truncate leading-tight" title={st.name}>
                    {st.name}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-[9px] text-slate-500 font-bold truncate max-w-[40px]">{st.stream}</span>
                    <input
                      type="text"
                      value={st.rollNo}
                      onChange={(e) => handleRollNoChange(st.docId, e.target.value)}
                      placeholder="—"
                      className={`w-10 px-0.5 py-0.2 rounded text-center font-mono font-black text-[10.5px] border transition-all ${
                        st.rollNo.trim()
                          ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 shadow-2xs font-extrabold'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-400 italic'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {sortedAndFilteredStudents.length === 0 && (
            <div className="p-8 text-center text-slate-400 font-bold">
              No students found matching filters for {selectedClass}.
            </div>
          )}
        </div>
      ) : (
        /* Full Width Table View */
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="max-h-[540px] overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 font-black text-[10px] uppercase select-none">
                <tr>
                  <th className="px-3 py-2 w-12">S.No</th>
                  <th onClick={() => handleHeaderSort('formNo')} className="px-3 py-2 cursor-pointer hover:text-amber-600">Form #</th>
                  <th onClick={() => handleHeaderSort('name')} className="px-3 py-2 cursor-pointer hover:text-amber-600">Student Name</th>
                  <th className="px-3 py-2">Class</th>
                  <th onClick={() => handleHeaderSort('stream')} className="px-3 py-2 cursor-pointer hover:text-amber-600">Stream</th>
                  <th onClick={() => handleHeaderSort('rollNo')} className="px-3 py-2 text-right cursor-pointer hover:text-amber-600">Assigned Class Roll No</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                {sortedAndFilteredStudents.map((st, idx) => (
                  <tr key={st.docId || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-1.5 font-mono text-slate-400 font-black">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-mono font-black text-amber-600">{st.formNo}</td>
                    <td className="px-3 py-1.5 font-black text-slate-900 dark:text-white">{st.name}</td>
                    <td className="px-3 py-1.5 text-slate-500 font-bold">{st.class}</td>
                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300 font-bold">{st.stream}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="text"
                        value={st.rollNo}
                        onChange={(e) => handleRollNoChange(st.docId, e.target.value)}
                        placeholder="Unassigned"
                        className="w-24 px-2 py-0.5 rounded text-right font-mono font-black text-xs border border-slate-200 dark:border-slate-700"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Button Toolbar */}
      <div className="flex items-center justify-between p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex-wrap gap-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {stats.changed > 0 ? (
            <span className="text-purple-600 dark:text-purple-400 font-black">
              ● {stats.changed} roll number modifications ready to save to Cloud Database
            </span>
          ) : (
            'All roll numbers in sync with Cloud Database'
          )}
        </span>

        <button
          type="button"
          onClick={handleSaveRollNos}
          disabled={saving || stats.changed === 0}
          className="px-4 py-1.5 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
          <span>Save Roll Numbers ({stats.changed} Changed)</span>
        </button>
      </div>

    </div>
  );
}
