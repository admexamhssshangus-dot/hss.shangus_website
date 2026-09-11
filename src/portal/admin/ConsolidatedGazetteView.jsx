import { gradeAssessment, expectedSubjectCodes } from '../../shared/assessment';
import { sameCohort, recordIdentity, identityKey, sessionKey, classKey } from '../../utils/recordIdentity';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText, Printer, Download, Search, RefreshCw, Filter, Award,
  CheckCircle2, AlertCircle, Users, BarChart3, TrendingUp, Layers,
  ChevronDown, ExternalLink, BookOpen, School, XCircle, ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getCachedCollection } from '../../services/dbCache';
import { DEFAULT_SCHOOL_EVALUATIONS } from '../../utils/practicalsSettingsManager';

const SESSIONS = ['2025-26', '2024-25', '2023-24'];
const CLASSES = ['12th', '11th', '10th'];
const STREAMS = ['All', 'Science', 'Arts', 'Commerce'];

export default function ConsolidatedGazetteView({ allStudents = [] }) {
  const [selectedEvalType, setSelectedEvalType] = useState('Pre-Board Test');
  const [selectedClass, setSelectedClass] = useState('12th');
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedStream, setSelectedStream] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableEvaluations, setAvailableEvaluations] = useState(DEFAULT_SCHOOL_EVALUATIONS);

  const [practicalsDocs, setPracticalsDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load available custom evaluations from Firestore
  useEffect(() => {
    async function fetchEvalConfig() {
      try {
        const snap = await getDoc(doc(db, 'adminPracticalsSettings', 'config')).catch(() => null);
        if (snap && snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.customEvaluations) && data.customEvaluations.length > 0) {
            setAvailableEvaluations(data.customEvaluations);
            return;
          }
        }
      } catch (err) {
        console.warn('Error fetching evaluations:', err);
      }
      setAvailableEvaluations(DEFAULT_SCHOOL_EVALUATIONS);
    }
    fetchEvalConfig();
  }, []);

  // Fetch practicals data documents
  const loadPracticalsData = useCallback(async () => {
    setLoading(true);
    try {
      let docs = [];
      try {
        const cached = await getCachedCollection('practicalsData', false, 10 * 60 * 1000).catch(() => []);
        if (Array.isArray(cached) && cached.length > 0) {
          docs = cached;
        } else {
          const snap = await getDocs(collection(db, 'practicalsData'));
          docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        const snap = await getDocs(collection(db, 'practicalsData'));
        docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      setPracticalsDocs(docs);
    } catch (err) {
      console.error('Failed to load practicalsData for gazette:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPracticalsData();
  }, [loadPracticalsData]);

  // Aggregate student and subject marks matrix
  const { gazetteRows, subjectsList, stats } = useMemo(() => {
    const evaluation = availableEvaluations.find(item => (item.evalType || item.title) === selectedEvalType && item.session === selectedSession);
    const matchingDocs = practicalsDocs.filter(section => section.isDraft !== true && section.status === 'submitted' &&
      classKey(section.className) === classKey(selectedClass) &&
      sessionKey(section.sessionCanonical || section.yearSuffix || section.session || section.sessionText) === selectedSession &&
      identityKey(section.practicalType) === identityKey(selectedEvalType));
    const subjectMap = new Map();
    matchingDocs.forEach(section => subjectMap.set(section.subjectCode, { code: section.subjectCode,
      name: section.subjectName || section.subject || section.subjectCode, maxMarks: section.maxMarks ?? evaluation?.maxMarks }));
    const cohort = allStudents.filter(student => sameCohort(student, selectedSession, selectedClass) && !student._deleted);
    const compiledRows = cohort.map((student, index) => {
      const identity = recordIdentity(student);
      const subjects = [];
      matchingDocs.forEach(section => {
        const matches = (section.records || []).filter(row => {
          const record = recordIdentity(row);
          return record.form ? record.form === identity.form && (!record.reg || record.reg === identity.reg) : record.reg && record.reg === identity.reg;
        });
        // Keep duplicates in the grading input so they produce a pending result.
        matches.forEach(row => subjects.push({ subjectCode: section.subjectCode, subjectName: section.subjectName || section.subject,
          marksObtained: row.totalMarks ?? row.practicalMarks, maxMarks: section.maxMarks ?? evaluation?.maxMarks,
          minMarks: section.minMarks ?? evaluation?.minMarks }));
      });
      const result = gradeAssessment(subjects, expectedSubjectCodes(student));
      const subjectMarks = Object.fromEntries(result.subjects.map(subject => [subject.subjectCode, {
        obtained: subject.marksObtained === '—' ? null : subject.marksObtained, maxMarks: subject.maxMarks,
        minMarks: subject.minMarks, isAbsent: subject.isAbsent, isPass: subject.isPass
      }]));
      return { key: `${identity.form || identity.reg}_${index}`, rollNo: String(student.classRollNo || student['Class Roll No'] || student.rollNo || '—'),
        regNo: student.boardRegNo || student.regNo || student['Board Registration Number'] || '—', formNo: student.formNo || student['Form Number'] || '—',
        name: student.studentName || student.name || student["Student's Name (as per school records)"] || student["Student's Name"] || 'Student',
        fatherName: student.fatherName || student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || '—',
        stream: student.stream || student.Stream || 'General', subjectMarks, ...result,
        percentage: result.percentage === null ? '—' : `${result.percentage}%`, numericPercentage: result.percentage === null ? -1 : Number(result.percentage),
        hasAppeared: result.appeared, enrolled: true };
    });
    compiledRows.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
    const appearedCount = compiledRows.filter(row => row.hasAppeared).length;
    const passedCount = compiledRows.filter(row => row.resultStatus === 'PASS').length;
    const complete = compiledRows.filter(row => row.numericPercentage >= 0);
    return { gazetteRows: compiledRows, subjectsList: [...subjectMap.values()], stats: {
      totalEnrolled: compiledRows.length, appearedCount, passedCount,
      overallPassPct: appearedCount ? Math.round(passedCount / appearedCount * 100) : 0,
      avgScorePct: complete.length ? (complete.reduce((total, row) => total + row.numericPercentage, 0) / complete.length).toFixed(1) : 0
    } };
  }, [practicalsDocs, allStudents, selectedClass, selectedSession, selectedEvalType, availableEvaluations]);

  // Filtered rows for Search and Stream
  const filteredRows = useMemo(() => {
    let rows = gazetteRows;

    if (selectedStream !== 'All') {
      rows = rows.filter(r => {
        const stStream = String(r.stream || '').toLowerCase();
        return stStream.includes(selectedStream.toLowerCase());
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(r =>
        String(r.name).toLowerCase().includes(q) ||
        String(r.rollNo).toLowerCase().includes(q) ||
        String(r.regNo).toLowerCase().includes(q) ||
        String(r.fatherName).toLowerCase().includes(q)
      );
    }

    return rows;
  }, [gazetteRows, selectedStream, searchQuery]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('No candidate records available to export.');
      return;
    }

    const headerRow = [
      'S.No',
      'Board Reg. No',
      'Class Roll No',
      'Candidate Name',
      "Father's Name",
      'Stream'
    ];

    subjectsList.forEach(s => {
      headerRow.push(`${s.name} (${s.code}) [Max:${s.maxMarks}]`);
    });

    headerRow.push('Grand Total', 'Max Marks', 'Percentage %', 'Result Status', 'Division / Grade');

    const dataRows = filteredRows.map((r, idx) => {
      const row = [
        idx + 1,
        r.regNo || '—',
        r.rollNo || '—',
        r.name || '—',
        r.fatherName || '—',
        r.stream || 'General'
      ];

      subjectsList.forEach(s => {
        const markObj = r.subjectMarks[s.code];
        if (markObj) {
          row.push(markObj.isAbsent ? 'AB' : (markObj.obtained ?? '—'));
        } else {
          row.push('—');
        }
      });

      row.push(
        r.totalObtained || 0,
        r.totalMax || 0,
        r.percentage,
        r.resultStatus,
        r.division
      );

      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
      [`GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG`],
      [`CONSOLIDATED TABULATION REGISTER & RESULT GAZETTE - ${selectedEvalType.toUpperCase()}`],
      [`Class: ${selectedClass} | Academic Session: ${selectedSession} | Generated: ${new Date().toLocaleDateString()}`],
      [],
      headerRow,
      ...dataRows
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedClass}_Gazette`);

    const filename = `HSS_Shangus_${selectedClass}_${selectedEvalType.replace(/\s+/g, '_')}_${selectedSession}_Gazette.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;

    const headers = ['S.No', 'Reg No', 'Roll No', 'Name', 'Father Name', 'Stream'];
    subjectsList.forEach(s => headers.push(`"${s.name} (${s.code})"`));
    headers.push('Total', 'Max', 'Percentage', 'Result', 'Division');

    const csvLines = [headers.join(',')];
    filteredRows.forEach((r, idx) => {
      const line = [
        idx + 1,
        `"${r.regNo}"`,
        `"${r.rollNo}"`,
        `"${r.name}"`,
        `"${r.fatherName}"`,
        `"${r.stream}"`
      ];
      subjectsList.forEach(s => {
        const mark = r.subjectMarks[s.code];
        line.push(mark ? (mark.isAbsent ? 'AB' : (mark.obtained ?? '—')) : '—');
      });
      line.push(r.totalObtained, r.totalMax, `"${r.percentage}"`, `"${r.resultStatus}"`, `"${r.division}"`);
      csvLines.push(line.join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gazette_${selectedClass}_${selectedSession}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Gazette
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100">
      {/* Printable Style Sheet */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #official-gazette-print-area, #official-gazette-print-area * {
            visibility: visible;
          }
          #official-gazette-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 10px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Compact Modern Toolbar & Command Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs space-y-2.5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 flex items-center justify-center font-black flex-shrink-0">
              <Award size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight m-0 truncate">
                  Master Gazette & Multi-Subject Analytics
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 flex-shrink-0">
                  {selectedEvalType}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 truncate">
                Live consolidated award rolls compiled across all subjects submitted by teachers.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredRows.length === 0}
              className="h-8 px-3 rounded-lg bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer size={13} />
              <span>Print Gazette</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0}
              className="h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              title="Export CSV"
            >
              <Download size={12} />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={loadPracticalsData}
              disabled={loading}
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              title="Refresh database records"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* High-Density Single-Line Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="col-span-2 sm:col-span-3">
            <select
              value={selectedEvalType}
              onChange={(e) => setSelectedEvalType(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-teal-800 dark:text-teal-300 font-bold focus:outline-none focus:border-teal-600"
            >
              {availableEvaluations.map(ev => (
                <option key={ev.id || ev.evalType} value={ev.evalType}>
                  {ev.evalType} ({ev.title || ev.session})
                </option>
              ))}
              <option value="Internal Assessment">Internal Assessment (Standard)</option>
              <option value="External Practical">External Practical (Standard)</option>
              <option value="Term End Evaluation">Term End Evaluation</option>
            </select>
          </div>

          <div className="col-span-1 sm:col-span-2">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {CLASSES.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>
          </div>

          <div className="col-span-1 sm:col-span-2">
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {SESSIONS.map(sess => (
                <option key={sess} value={sess}>{sess}</option>
              ))}
            </select>
          </div>

          <div className="col-span-1 sm:col-span-2">
            <select
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {STREAMS.map(str => (
                <option key={str} value={str}>{str === 'All' ? 'All Streams' : str}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate..."
                className="w-full h-8 pl-7 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ultra-Modern Compact KPI Metric Ribbon */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 px-3 flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar no-print shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-5 text-xs font-semibold text-slate-700 dark:text-slate-300 divide-x divide-slate-200 dark:divide-slate-800">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Users size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Enrolled:</span>
            <span className="font-black text-slate-900 dark:text-white">{stats.totalEnrolled}</span>
          </div>
          <div className="flex items-center gap-1.5 pl-3 sm:pl-5 whitespace-nowrap">
            <FileText size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Appeared:</span>
            <span className="font-black text-indigo-700 dark:text-indigo-300">{stats.appearedCount}</span>
          </div>
          <div className="flex items-center gap-1.5 pl-3 sm:pl-5 whitespace-nowrap">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Passed:</span>
            <span className="font-black text-emerald-700 dark:text-emerald-400">{stats.passedCount}</span>
          </div>
          <div className="flex items-center gap-1.5 pl-3 sm:pl-5 whitespace-nowrap">
            <TrendingUp size={14} className="text-amber-600 dark:text-amber-400" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Pass Rate:</span>
            <span className="font-black text-amber-700 dark:text-amber-300">{stats.overallPassPct}%</span>
          </div>
          <div className="flex items-center gap-1.5 pl-3 sm:pl-5 whitespace-nowrap">
            <BarChart3 size={14} className="text-teal-600 dark:text-teal-400" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Avg Score:</span>
            <span className="font-black text-teal-700 dark:text-teal-300">{stats.avgScorePct}%</span>
          </div>
        </div>
        <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap pl-2 border-l border-slate-100 dark:border-slate-800">
          Showing {filteredRows.length} candidates
        </div>
      </div>

      {/* Main Gazette Table Container */}
      <div id="official-gazette-print-area" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Printable Official Institutional Header (Hidden on screen, visible on print) */}
        <div className="hidden print:block p-4 text-center border-b-2 border-black space-y-1">
          <h1 className="text-xl font-black uppercase tracking-wider text-black m-0">
            Govt. Higher Secondary School Shangus, Anantnag
          </h1>
          <h2 className="text-sm font-extrabold uppercase text-black m-0">
            Official Tabulation Register & Consolidated Result Gazette
          </h2>
          <p className="text-xs text-black font-semibold m-0">
            Assessment: <strong>{selectedEvalType}</strong> | Class: <strong>{selectedClass}</strong> | Academic Session: <strong>{selectedSession}</strong> | Date: <strong>{new Date().toLocaleDateString()}</strong>
          </p>
        </div>

        {/* High Density Gazette Table with Clean High-Contrast Alternating Rows */}
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse select-text">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-950 border-b-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="py-2 px-2 text-center w-10">S.No</th>
                <th className="py-2 px-2">Roll No</th>
                <th className="py-2 px-2">Reg. No</th>
                <th className="py-2 px-2.5 min-w-[150px]">Candidate & Parentage</th>
                <th className="py-2 px-2">Stream</th>
                {subjectsList.map(s => (
                  <th key={s.code} className="py-1.5 px-2 text-center min-w-[65px]" title={s.name}>
                    <span className="block truncate max-w-[80px]">{s.code}</span>
                    <span className="text-[8px] font-semibold text-slate-500">/{s.maxMarks}</span>
                  </th>
                ))}
                <th className="py-2 px-2 text-center">Total</th>
                <th className="py-2 px-2 text-center">%</th>
                <th className="py-2 px-2 text-center">Result</th>
                <th className="py-2 px-2 text-center">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
              {filteredRows.map((row, idx) => {
                const isPass = row.resultStatus === 'PASS';
                const isAbsent = row.resultStatus === 'ABSENT';

                return (
                  <tr
                    key={row.key}
                    className={`hover:bg-teal-50/50 dark:hover:bg-slate-800/60 transition-colors ${
                      idx % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-slate-50/70 dark:bg-slate-900/90'
                    }`}
                  >
                    <td className="py-1.5 px-2 text-center text-slate-500 dark:text-slate-400 font-sans text-xs">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-mono font-bold text-slate-900 dark:text-white text-xs">{row.rollNo}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 text-[10px] font-mono">{row.regNo}</td>
                    <td className="py-1.5 px-2.5 font-sans">
                      <p className="font-bold text-slate-900 dark:text-white text-xs m-0 leading-tight">{row.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-tight">S/O: {row.fatherName}</p>
                    </td>
                    <td className="py-1.5 px-2 font-sans text-xs text-slate-700 dark:text-slate-300 font-medium">{row.stream}</td>

                    {/* Subject Marks Columns */}
                    {subjectsList.map(s => {
                      const markObj = row.subjectMarks[s.code];
                      if (!markObj) {
                        return (
                          <td key={s.code} className="py-1.5 px-2 text-center text-slate-400 dark:text-slate-600 font-mono">
                            —
                          </td>
                        );
                      }

                      if (markObj.isAbsent) {
                        return (
                          <td key={s.code} className="py-1.5 px-2 text-center text-rose-700 dark:text-rose-400 font-bold text-[10px] font-mono">
                            AB
                          </td>
                        );
                      }

                      const val = markObj.obtained;
                      const passThreshold = Math.ceil(markObj.maxMarks * 0.36);
                      const isFailed = val !== null && val < passThreshold;

                      return (
                        <td
                          key={s.code}
                          className={`py-1.5 px-2 text-center font-mono font-bold ${
                            isFailed ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {val !== null ? val : '—'}
                        </td>
                      );
                    })}

                    {/* Grand Total & Max */}
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {row.totalMax > 0 ? `${row.totalObtained}/${row.totalMax}` : '—'}
                    </td>

                    {/* Percentage */}
                    <td className="py-1.5 px-2 text-center font-mono font-black text-teal-700 dark:text-teal-300">
                      {row.percentage}
                    </td>

                    {/* Result Status */}
                    <td className="py-1.5 px-2 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider inline-block ${
                          isPass
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : isAbsent
                            ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                            : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        }`}
                      >
                        {row.resultStatus}
                      </span>
                    </td>

                    {/* Division */}
                    <td className="py-1.5 px-2 text-center font-sans text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {row.division}
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={subjectsList.length + 9} className="p-8 text-center text-slate-500 font-sans">
                    No candidate records found matching your filters for {selectedClass} ({selectedSession}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Official Signatory Block (Hidden on screen, visible on print) */}
        <div className="hidden print:flex justify-between items-end pt-12 px-8 pb-4 text-xs font-bold text-black border-t border-black mt-8">
          <div className="text-center">
            <p className="border-t border-black pt-1 w-40">Evaluator / Teacher</p>
          </div>
          <div className="text-center">
            <p className="border-t border-black pt-1 w-40">I/C Examinations</p>
          </div>
          <div className="text-center">
            <p className="border-t border-black pt-1 w-40">Principal HSS Shangus</p>
          </div>
        </div>
      </div>
    </div>
  );
}
