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
    const normClass = String(selectedClass).toLowerCase().replace(/class/i, '').trim();
    const normSession = String(selectedSession).toLowerCase().trim();
    const normEval = String(selectedEvalType).toLowerCase().trim();

    // 1. Filter matching practicals documents for the chosen Class, Session, and Evaluation Type
    const matchingDocs = practicalsDocs.filter(docData => {
      const dClass = String(docData.className || docData.class || docData.id || '').toLowerCase();
      const matchClass = dClass.includes(normClass);
      if (!matchClass) return false;

      const dSession = String(docData.yearSuffix || docData.session || docData.Session || docData.id.split('_').pop() || '').toLowerCase();
      const matchSession = dSession.includes(normSession) || (normSession === '2025-26' && (dSession === '2026' || dSession.includes('2025-26')));
      if (!matchSession) return false;

      const dEval = String(docData.practicalType || docData.evaluationType || docData.evalType || '').toLowerCase();
      const matchEval = dEval.includes(normEval) || (normEval.includes('pre-board') && dEval.includes('pre-board'));
      return matchEval;
    });

    // 2. Discover all subjects evaluated in matching documents
    const subjectsMap = new Map();
    matchingDocs.forEach(d => {
      const sCode = d.subjectCode || String(d.subject || 'SUB').slice(0, 4).toUpperCase();
      const sName = d.subject || d.subjectName || sCode;
      if (!subjectsMap.has(sCode)) {
        subjectsMap.set(sCode, {
          code: sCode,
          name: sName,
          maxMarks: Number(d.maxMarks) || 100
        });
      }
    });

    const discoveredSubjects = Array.from(subjectsMap.values());

    // 3. Build student map
    const studentRecordsMap = new Map();

    (allStudents || []).forEach(st => {
      const stClass = String(st.class || st.Class || st['Admission sought for class'] || '').toLowerCase();
      const stSession = String(st.session || st.Session || st['Academic Session'] || '').toLowerCase();

      const isClsMatch = stClass.includes(normClass);
      const isSessMatch = stSession.includes(normSession) || (normSession === '2025-26' && (stSession === '2026' || stSession.includes('2025-26')));

      if (isClsMatch && isSessMatch) {
        const rollNo = String(st.classRollNo || st.rollNo || st['Class Roll No'] || '').trim();
        const regNo = String(st.boardRegNo || st.regNo || st['Registration Number'] || st['Reg No'] || '').trim();
        const formNo = String(st.formNo || st['Form No.'] || '').trim();
        const name = String(st.name || st.studentName || st['Student Name'] || '').trim();
        const fatherName = String(st.fatherName || st.parentName || st["Father's Name"] || '').trim();
        const stream = String(st.stream || st.Stream || st['Stream / Subjects'] || 'General').trim();
        const status = String(st.status || st.admissionStatus || st['Admission Status'] || 'approved').toLowerCase();

        const studentKey = rollNo || regNo || formNo || name.toLowerCase();
        if (studentKey && !studentRecordsMap.has(studentKey)) {
          studentRecordsMap.set(studentKey, {
            key: studentKey,
            rollNo: rollNo || '—',
            regNo: regNo || '—',
            formNo: formNo || '—',
            name: name || 'Student',
            fatherName: fatherName || '—',
            stream: stream,
            status: status,
            subjectMarks: {},
            enrolled: true
          });
        }
      }
    });

    // Overlay marks
    matchingDocs.forEach(d => {
      const sCode = d.subjectCode || String(d.subject || 'SUB').slice(0, 4).toUpperCase();
      const dMax = Number(d.maxMarks) || 100;

      if (Array.isArray(d.records)) {
        d.records.forEach(r => {
          const rRoll = String(r.rollNo || r.classRollNo || '').trim();
          const rReg = String(r.regNo || r.boardRegNo || '').trim();
          const rBoard = String(r.boardRoll || r.boardRollNo || '').trim();
          const rForm = String(r.formNo || '').trim();
          const rName = String(r.name || r.studentName || '').trim();
          const rFather = String(r.parentName || r.fatherName || '').trim();

          let existing = null;
          if (rRoll && studentRecordsMap.has(rRoll)) existing = studentRecordsMap.get(rRoll);
          else if (rReg && studentRecordsMap.has(rReg)) existing = studentRecordsMap.get(rReg);
          else if (rForm && studentRecordsMap.has(rForm)) existing = studentRecordsMap.get(rForm);
          else if (rName) {
            for (const [, val] of studentRecordsMap.entries()) {
              if (val.name.toLowerCase() === rName.toLowerCase()) {
                existing = val;
                break;
              }
            }
          }

          const rawMarks = r.totalMarks ?? r.practicalMarks ?? '';
          const numMarks = rawMarks !== '' && !isNaN(Number(rawMarks)) ? Number(rawMarks) : null;
          const isAbsent = String(rawMarks).toUpperCase() === 'AB' || String(rawMarks).toUpperCase() === 'ABSENT';

          const markEntry = {
            obtained: isAbsent ? 'AB' : numMarks,
            maxMarks: dMax,
            isAbsent
          };

          if (existing) {
            existing.subjectMarks[sCode] = markEntry;
            if (rReg && existing.regNo === '—') existing.regNo = rReg;
            if (rRoll && existing.rollNo === '—') existing.rollNo = rRoll;
            if (rFather && existing.fatherName === '—') existing.fatherName = rFather;
          } else {
            const newKey = rRoll || rReg || rBoard || rName.toLowerCase() || `rec_${Math.random()}`;
            studentRecordsMap.set(newKey, {
              key: newKey,
              rollNo: rRoll || rBoard || '—',
              regNo: rReg || '—',
              formNo: rForm || '—',
              name: rName || 'Student',
              fatherName: rFather || '—',
              stream: 'General',
              status: 'approved',
              subjectMarks: {
                [sCode]: markEntry
              },
              enrolled: true
            });
          }
        });
      }
    });

    const minPassPct = 0.36;
    const compiledRows = [];

    let totalEnrolled = 0;
    let appearedCount = 0;
    let passedCount = 0;
    let totalPctSum = 0;
    let evaluatedStudentsCount = 0;

    studentRecordsMap.forEach(student => {
      totalEnrolled++;

      let totalObtained = 0;
      let totalMax = 0;
      let subjectsEvaluatedCount = 0;
      let failedSubjects = [];
      let isAbsentAll = true;

      discoveredSubjects.forEach(s => {
        const markObj = student.subjectMarks[s.code];
        if (markObj) {
          if (!markObj.isAbsent && markObj.obtained !== null) {
            isAbsentAll = false;
            totalObtained += markObj.obtained;
            totalMax += markObj.maxMarks;
            subjectsEvaluatedCount++;

            const passMark = Math.ceil(markObj.maxMarks * minPassPct);
            if (markObj.obtained < passMark) {
              failedSubjects.push(s.code);
            }
          } else if (markObj.isAbsent) {
            totalMax += markObj.maxMarks;
            subjectsEvaluatedCount++;
            failedSubjects.push(s.code);
          }
        }
      });

      const hasAppeared = subjectsEvaluatedCount > 0 && !isAbsentAll;
      if (hasAppeared) appearedCount++;

      let percentage = null;
      let resultStatus = 'PENDING';
      let division = '—';

      if (subjectsEvaluatedCount > 0) {
        if (isAbsentAll) {
          resultStatus = 'ABSENT';
        } else {
          percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : 0;
          totalPctSum += Number(percentage);
          evaluatedStudentsCount++;

          if (failedSubjects.length === 0) {
            resultStatus = 'PASS';
            passedCount++;

            const numPct = Number(percentage);
            if (numPct >= 75) division = 'Distinction';
            else if (numPct >= 60) division = '1st Div';
            else if (numPct >= 45) division = '2nd Div';
            else if (numPct >= 33) division = '3rd Div';
            else division = 'Pass';
          } else {
            resultStatus = `RE-APPEAR (${failedSubjects.join(', ')})`;
            division = 'Fail';
          }
        }
      }

      compiledRows.push({
        ...student,
        totalObtained,
        totalMax,
        percentage: percentage !== null ? `${percentage}%` : '—',
        numericPercentage: percentage !== null ? Number(percentage) : -1,
        resultStatus,
        division,
        hasAppeared
      });
    });

    compiledRows.sort((a, b) => {
      const numA = parseInt(a.rollNo, 10);
      const numB = parseInt(b.rollNo, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.rollNo.localeCompare(b.rollNo);
    });

    const overallPassPct = appearedCount > 0 ? Math.round((passedCount / appearedCount) * 100) : 0;
    const avgScorePct = evaluatedStudentsCount > 0 ? (totalPctSum / evaluatedStudentsCount).toFixed(1) : 0;

    return {
      gazetteRows: compiledRows,
      subjectsList: discoveredSubjects,
      stats: {
        totalEnrolled,
        appearedCount,
        passedCount,
        overallPassPct,
        avgScorePct
      }
    };
  }, [practicalsDocs, allStudents, selectedClass, selectedSession, selectedEvalType]);

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

      {/* Top Filter & Toolbar Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 text-orange-800 dark:text-orange-300 text-[10px] font-bold">
              <Award size={11} className="text-orange-600 dark:text-orange-400" />
              <span>Consolidated Tabulation Authority</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 m-0">
              Master Gazette & Multi-Subject Analytics
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 m-0 font-medium">
              Live consolidated award rolls compiled across all subjects submitted by teachers.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredRows.length === 0}
              className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer size={14} />
              <span>Print Official Gazette</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={loadPracticalsData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh database records"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Evaluation Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Assessment Type
            </label>
            <select
              value={selectedEvalType}
              onChange={(e) => setSelectedEvalType(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-teal-800 dark:text-teal-300 font-bold focus:outline-none focus:border-teal-600"
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

          {/* Class */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {CLASSES.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>
          </div>

          {/* Academic Session */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Academic Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {SESSIONS.map(sess => (
                <option key={sess} value={sess}>{sess}</option>
              ))}
            </select>
          </div>

          {/* Stream */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Stream
            </label>
            <select
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {STREAMS.map(str => (
                <option key={str} value={str}>{str}</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Search Candidate
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Roll / Reg / Name..."
                className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Performance Badges with Light & Dark Theme Support */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 no-print">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
            <Users size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Enrolled</span>
            <p className="text-lg font-black text-slate-900 dark:text-white m-0 leading-tight">{stats.totalEnrolled}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-black">
            <FileText size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Appeared</span>
            <p className="text-lg font-black text-indigo-700 dark:text-indigo-300 m-0 leading-tight">{stats.appearedCount}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Passed</span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 m-0 leading-tight">{stats.passedCount}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black">
            <TrendingUp size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Pass Rate</span>
            <p className="text-lg font-black text-amber-700 dark:text-amber-300 m-0 leading-tight">{stats.overallPassPct}%</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 col-span-2 sm:col-span-1 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center font-black">
            <BarChart3 size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Avg Score</span>
            <p className="text-lg font-black text-teal-700 dark:text-teal-300 m-0 leading-tight">{stats.avgScorePct}%</p>
          </div>
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
                <th className="p-2.5 text-center w-10">S.No</th>
                <th className="p-2.5">Roll No</th>
                <th className="p-2.5">Reg. No</th>
                <th className="p-2.5 min-w-[160px]">Candidate & Parentage</th>
                <th className="p-2.5">Stream</th>
                {subjectsList.map(s => (
                  <th key={s.code} className="p-2 text-center min-w-[70px]" title={s.name}>
                    <span className="block truncate max-w-[80px]">{s.code}</span>
                    <span className="text-[8px] font-semibold text-slate-500">/{s.maxMarks}</span>
                  </th>
                ))}
                <th className="p-2.5 text-center">Grand Total</th>
                <th className="p-2.5 text-center">%</th>
                <th className="p-2.5 text-center">Result</th>
                <th className="p-2.5 text-center">Grade</th>
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
                    <td className="p-2 text-center text-slate-500 dark:text-slate-400 font-sans text-xs">{idx + 1}</td>
                    <td className="p-2 font-mono font-bold text-slate-900 dark:text-white text-xs">{row.rollNo}</td>
                    <td className="p-2 text-slate-600 dark:text-slate-400 text-[10px] font-mono">{row.regNo}</td>
                    <td className="p-2 font-sans">
                      <p className="font-bold text-slate-900 dark:text-white text-xs m-0 leading-tight">{row.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-tight">S/O: {row.fatherName}</p>
                    </td>
                    <td className="p-2 font-sans text-xs text-slate-700 dark:text-slate-300 font-medium">{row.stream}</td>

                    {/* Subject Marks Columns */}
                    {subjectsList.map(s => {
                      const markObj = row.subjectMarks[s.code];
                      if (!markObj) {
                        return (
                          <td key={s.code} className="p-2 text-center text-slate-400 dark:text-slate-600 font-mono">
                            —
                          </td>
                        );
                      }

                      if (markObj.isAbsent) {
                        return (
                          <td key={s.code} className="p-2 text-center text-rose-700 dark:text-rose-400 font-bold text-[10px] font-mono">
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
                          className={`p-2 text-center font-mono font-bold ${
                            isFailed ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {val !== null ? val : '—'}
                        </td>
                      );
                    })}

                    {/* Grand Total & Max */}
                    <td className="p-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {row.totalMax > 0 ? `${row.totalObtained}/${row.totalMax}` : '—'}
                    </td>

                    {/* Percentage */}
                    <td className="p-2 text-center font-mono font-black text-teal-700 dark:text-teal-300">
                      {row.percentage}
                    </td>

                    {/* Result Status */}
                    <td className="p-2 text-center font-sans">
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
                    <td className="p-2 text-center font-sans text-xs font-semibold text-slate-700 dark:text-slate-300">
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
