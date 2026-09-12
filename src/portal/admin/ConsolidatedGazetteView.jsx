import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText, Printer, Download, Search, RefreshCw, Filter, Award,
  CheckCircle2, AlertCircle, Users, BarChart3, TrendingUp, Layers,
  ChevronDown, ExternalLink, BookOpen, School, XCircle, ArrowUpDown, Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getCachedCollection } from '../../services/dbCache';
import { DEFAULT_SCHOOL_EVALUATIONS, SUBJECT_CONFIG_DEFS } from '../../utils/practicalsSettingsManager';
import { gradeAssessment, expectedSubjectCodes } from '../../shared/assessment';
import { sameCohort, recordIdentity, identityKey, sessionKey, classKey } from '../../utils/recordIdentity';

const SESSIONS = ['2025-26', '2024-25', '2023-24'];
const CLASSES = ['12th', '11th', '10th'];
const STREAMS = ['All', 'Science', 'Arts', 'Commerce'];

const STATUS_CATEGORIES = [
  { value: 'All', label: 'All Categories / Statuses' },
  { value: 'Approved', label: 'Approved (Confirmed)' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Provisional', label: 'Provisional' },
  { value: 'Pending', label: 'Pending / Review' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Withdrawn', label: 'Withdrawn' },
];

const RESULT_FILTERS = [
  { value: 'All', label: 'All Results' },
  { value: 'PASS', label: 'Passed (PASS)' },
  { value: 'RE-APPEAR', label: 'Re-Appear / Fail' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'PENDING', label: 'Pending / Incomplete' },
];

/**
 * Multi-tier student record matcher against a teacher's evaluation section records.
 * Compares Board Reg No, Form No, Class Roll No, and normalized Candidate Name.
 */
function matchStudentRecord(rec, student, identity) {
  if (!rec) return false;

  // 1. Board Registration Number (100% unique)
  const rowReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
  if (rowReg && identity.reg && rowReg === identity.reg) return true;

  // 2. Form Number (unique within session)
  const rowForm = identityKey(rec.formNo || rec.form || rec.id);
  if (rowForm && identity.form && rowForm === identity.form) return true;

  // 3. Class Roll Number
  const rowRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll);
  if (rowRoll && identity.roll && rowRoll === identity.roll && rowRoll !== '-' && rowRoll !== '—' && rowRoll !== 'n/a') return true;

  // 4. Candidate Name (clean alphanumeric lowercase comparison)
  const rowName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const stuName = String(student.studentName || student.name || student["Student's Name"] || student["Student's Name (as per school records)"] || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (rowName && stuName && rowName.length > 3 && rowName === stuName) return true;

  return false;
}

export default function ConsolidatedGazetteView({ allStudents = [] }) {
  const [selectedEvalType, setSelectedEvalType] = useState('Pre-Board Test');
  const [selectedClass, setSelectedClass] = useState('11th');
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedStream, setSelectedStream] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedResultFilter, setSelectedResultFilter] = useState('All');
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
    const evaluation = availableEvaluations.find(item =>
      (item.evalType || item.title) === selectedEvalType &&
      (!item.session || item.session === selectedSession)
    );

    const targetClass = classKey(selectedClass);
    const targetSession = sessionKey(selectedSession);

    // 1. Identify matching practicals documents submitted by teachers
    const matchingDocs = practicalsDocs.filter(section => {
      // Reject explicit drafts
      if (section.isDraft === true || String(section.status || '').toLowerCase() === 'draft') return false;

      // Class matching
      const docCls = classKey(section.className || section.class || section.selectedClass || section.docId || '');
      if (docCls !== targetClass) return false;

      // Session matching (handles 2025-26, 2026, 2024-25, 2025)
      const rawSess = section.sessionCanonical || section.yearSuffix || section.session || section.Session || section.docId || '';
      const docSess = sessionKey(rawSess);
      const isSessionMatched = !selectedSession || selectedSession === 'All' ||
        docSess === targetSession ||
        (targetSession === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26'))) ||
        (targetSession === '2024-25' && (docSess === '2025' || String(rawSess).includes('2025') || String(rawSess).includes('2024-25')));
      if (!isSessionMatched) return false;

      // Evaluation type matching (ALL or flexible normalized substring)
      if (selectedEvalType && selectedEvalType !== 'ALL') {
        const targetEval = identityKey(selectedEvalType);
        const docEval = identityKey(section.practicalType || section.evaluationType || section.examTitle || section.type || section.docId || '');
        const isEvalMatched = docEval === targetEval ||
          docEval.includes(targetEval) || targetEval.includes(docEval) ||
          (targetEval.includes('preboard') && docEval.includes('preboard')) ||
          (targetEval.includes('internal') && docEval.includes('internal')) ||
          (targetEval.includes('external') && docEval.includes('external'));
        if (!isEvalMatched) return false;
      }

      return true;
    });

    // 2. Build map of distinct subjects submitted by teachers
    const subjectMap = new Map();
    matchingDocs.forEach(section => {
      const sCode = (section.subjectCode || section.code || '').toUpperCase().trim();
      const sName = section.subjectName || section.subject || sCode;
      let finalCode = sCode;
      let finalName = sName;
      if (!finalCode || finalCode.length < 2) {
        const def = SUBJECT_CONFIG_DEFS.find(d => d.name.toLowerCase() === sName.toLowerCase());
        if (def) {
          finalCode = def.code;
          finalName = def.name;
        } else {
          finalCode = sName.slice(0, 3).toUpperCase();
        }
      }
      const maxMarks = Number(section.maxMarks) || evaluation?.maxMarks || (['PH', 'CH', 'BI', 'CS', 'PD', 'ITE'].includes(finalCode) ? 30 : 100);
      const minMarks = Number(section.minMarks) || evaluation?.minMarks || Math.ceil(maxMarks * 0.36);

      const existing = subjectMap.get(finalCode) || {
        code: finalCode,
        name: finalName,
        maxMarks,
        minMarks,
        sections: [],
      };
      existing.sections.push(section);
      subjectMap.set(finalCode, existing);
    });

    // Filter cohort students for class and session
    const cohort = allStudents.filter(student => sameCohort(student, selectedSession, selectedClass) && !student._deleted);

    // If matchingDocs is empty, also collect standard enrolled subject codes for this cohort so columns are visible
    if (subjectMap.size === 0) {
      const enrolledCodes = new Set();
      cohort.forEach(student => {
        const codes = expectedSubjectCodes(student);
        codes.forEach(c => enrolledCodes.add(c.toUpperCase()));
      });

      // Default to core stream subjects if none found in student records
      if (enrolledCodes.size === 0) {
        ['EN', 'PH', 'CH', 'BI', 'MA'].forEach(c => enrolledCodes.add(c));
      }

      enrolledCodes.forEach(code => {
        const def = SUBJECT_CONFIG_DEFS.find(d => d.code === code);
        const name = def ? def.name : code;
        const maxMarks = evaluation?.maxMarks || (['PH', 'CH', 'BI', 'CS', 'PD', 'ITE'].includes(code) ? 30 : 100);
        const minMarks = evaluation?.minMarks || Math.ceil(maxMarks * 0.36);
        subjectMap.set(code, {
          code,
          name,
          maxMarks,
          minMarks,
          sections: [],
        });
      });
    }

    const subjectsListArray = [...subjectMap.values()];

    // 3. Compile student rows, match marks, and calculate total, %, result, and grade accordingly
    const compiledRows = cohort.map((student, index) => {
      const identity = recordIdentity(student);

      // Admission / Category Status (Approved, Submitted, Provisional, Pending, etc.)
      const rawStatus = student.Status || student.status || student.admissionStatus || student['Application Status'] ||
        (student.isApproved ? 'Approved' : student.isProvisional ? 'Provisional' : 'Submitted');
      const admissionStatus = String(rawStatus || 'Submitted').trim();

      const subjectMarks = {};
      let totalObtained = 0;
      let totalMax = 0;
      let evaluatedSubjectsCount = 0;
      let absentSubjectsCount = 0;
      let failedSubjectsCount = 0;

      subjectMap.forEach((subjMeta, code) => {
        let foundRecord = null;

        // Check sections dedicated to this subject
        const sections = subjMeta.sections || [];
        for (const sec of sections) {
          const recs = sec.records || [];
          const match = recs.find(r => matchStudentRecord(r, student, identity));
          if (match) {
            foundRecord = match;
            break;
          }
        }

        // Fallback: search all matchingDocs with matching subject code or name
        if (!foundRecord) {
          for (const sec of matchingDocs) {
            const sCode = (sec.subjectCode || '').toUpperCase();
            const sName = (sec.subjectName || sec.subject || '').toLowerCase();
            if (sCode === code || sName.includes(subjMeta.name.toLowerCase())) {
              const recs = sec.records || [];
              const match = recs.find(r => matchStudentRecord(r, student, identity));
              if (match) {
                foundRecord = match;
                break;
              }
            }
          }
        }

        if (foundRecord) {
          const rawMark = foundRecord.totalMarks ?? foundRecord.practicalMarks;
          const isAbsent = /^(a|ab|absent)$/i.test(String(rawMark).trim());
          const numeric = Number(rawMark);
          const hasNumeric = !isAbsent && Number.isFinite(numeric) && numeric >= 0;

          if (isAbsent) {
            absentSubjectsCount++;
            evaluatedSubjectsCount++;
            totalMax += subjMeta.maxMarks;
            subjectMarks[code] = {
              obtained: 'AB',
              isAbsent: true,
              isPass: false,
              isFailed: true,
              maxMarks: subjMeta.maxMarks,
              minMarks: subjMeta.minMarks,
            };
          } else if (hasNumeric) {
            evaluatedSubjectsCount++;
            const marksVal = Math.min(subjMeta.maxMarks, numeric);
            const isPass = marksVal >= subjMeta.minMarks;
            totalObtained += marksVal;
            totalMax += subjMeta.maxMarks;
            if (!isPass) failedSubjectsCount++;

            subjectMarks[code] = {
              obtained: marksVal,
              isAbsent: false,
              isPass,
              isFailed: !isPass,
              maxMarks: subjMeta.maxMarks,
              minMarks: subjMeta.minMarks,
            };
          } else {
            subjectMarks[code] = {
              obtained: null,
              isAbsent: false,
              isPass: false,
              isFailed: false,
              maxMarks: subjMeta.maxMarks,
              minMarks: subjMeta.minMarks,
            };
          }
        } else {
          subjectMarks[code] = {
            obtained: null,
            isAbsent: false,
            isPass: false,
            isFailed: false,
            maxMarks: subjMeta.maxMarks,
            minMarks: subjMeta.minMarks,
          };
        }
      });

      // Calculate totals, percentage, result status, and grade
      const hasMarks = evaluatedSubjectsCount > 0;
      const isAllAbsent = hasMarks && absentSubjectsCount === evaluatedSubjectsCount;
      const hasFail = failedSubjectsCount > 0;
      const pct = hasMarks && totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : null;
      const numericPercentage = pct !== null ? Number(pct) : -1;

      let resultStatus = 'PENDING';
      let division = 'Pending / Incomplete';

      if (hasMarks) {
        if (isAllAbsent) {
          resultStatus = 'ABSENT';
          division = 'Absent';
        } else if (hasFail) {
          resultStatus = 'RE-APPEAR';
          division = 'Reappear / Needs Work';
        } else {
          resultStatus = 'PASS';
          division = numericPercentage >= 75 ? 'Distinction (Grade A)' :
                     numericPercentage >= 60 ? 'First Division' :
                     numericPercentage >= 45 ? 'Second Division' : 'Third Division';
        }
      }

      return {
        key: `${identity.form || identity.reg || student.id || index}_${index}`,
        rollNo: String(student.classRollNo || student['Class Roll No'] || student.rollNo || '—'),
        regNo: student.boardRegNo || student.regNo || student['Board Registration Number'] || '—',
        formNo: student.formNo || student['Form Number'] || '—',
        name: student.studentName || student.name || student["Student's Name (as per school records)"] || student["Student's Name"] || 'Student',
        fatherName: student.fatherName || student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || '—',
        stream: student.stream || student.Stream || 'General',
        admissionStatus,
        subjectMarks,
        totalObtained,
        totalMax,
        percentage: pct !== null ? `${pct}%` : '—',
        numericPercentage,
        resultStatus,
        division,
        hasAppeared: hasMarks && !isAllAbsent,
        enrolled: true,
      };
    });

    compiledRows.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));

    const appearedCount = compiledRows.filter(row => row.hasAppeared).length;
    const passedCount = compiledRows.filter(row => row.resultStatus === 'PASS').length;
    const complete = compiledRows.filter(row => row.numericPercentage >= 0);

    return {
      gazetteRows: compiledRows,
      subjectsList: subjectsListArray,
      stats: {
        totalEnrolled: compiledRows.length,
        appearedCount,
        passedCount,
        overallPassPct: appearedCount ? Math.round((passedCount / appearedCount) * 100) : 0,
        avgScorePct: complete.length ? (complete.reduce((total, row) => total + row.numericPercentage, 0) / complete.length).toFixed(1) : 0
      }
    };
  }, [practicalsDocs, allStudents, selectedClass, selectedSession, selectedEvalType, availableEvaluations]);

  // Filtered rows for Search, Stream, Admission Status, and Result
  const filteredRows = useMemo(() => {
    let rows = gazetteRows;

    // 1. Stream Filter
    if (selectedStream !== 'All') {
      rows = rows.filter(r => {
        const stStream = String(r.stream || '').toLowerCase();
        return stStream.includes(selectedStream.toLowerCase());
      });
    }

    // 2. Admission Status / Category Filter (Approved, Submitted, Provisional, Pending, Withdrawn)
    if (selectedStatus !== 'All') {
      const target = selectedStatus.toLowerCase().trim();
      rows = rows.filter(r => {
        const st = String(r.admissionStatus || '').toLowerCase().trim();
        if (target === 'approved') return st.includes('appr');
        if (target === 'submitted') return st.includes('submit');
        if (target === 'provisional') return st.includes('provis');
        if (target === 'pending') return st.includes('pend') || st.includes('review');
        if (target === 'draft') return st.includes('draft');
        if (target === 'withdrawn') return st.includes('withdr');
        return st === target;
      });
    }

    // 3. Result Status Filter (Pass, Re-Appear, Absent, Pending)
    if (selectedResultFilter !== 'All') {
      rows = rows.filter(r => r.resultStatus === selectedResultFilter);
    }

    // 4. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(r =>
        String(r.name).toLowerCase().includes(q) ||
        String(r.rollNo).toLowerCase().includes(q) ||
        String(r.regNo).toLowerCase().includes(q) ||
        String(r.fatherName).toLowerCase().includes(q) ||
        String(r.formNo).toLowerCase().includes(q) ||
        String(r.stream).toLowerCase().includes(q) ||
        String(r.admissionStatus).toLowerCase().includes(q)
      );
    }

    return rows;
  }, [gazetteRows, selectedStream, selectedStatus, selectedResultFilter, searchQuery]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('No candidate records available to export.');
      return;
    }

    const headerRow = [
      'S.No',
      'Class Roll No',
      'Board Reg. No',
      'Candidate Name',
      "Father's Name",
      'Stream',
      'Admission Status'
    ];

    subjectsList.forEach(s => {
      headerRow.push(`${s.name} (${s.code}) [Max:${s.maxMarks}]`);
    });

    headerRow.push('Total Obtained', 'Max Marks', 'Percentage %', 'Result Status', 'Division / Grade');

    const dataRows = filteredRows.map((r, idx) => {
      const row = [
        idx + 1,
        r.rollNo || '—',
        r.regNo || '—',
        r.name || '—',
        r.fatherName || '—',
        r.stream || 'General',
        r.admissionStatus || 'Submitted'
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
      [`Class: ${selectedClass} | Academic Session: ${selectedSession} | Status: ${selectedStatus} | Generated: ${new Date().toLocaleDateString()}`],
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

    const headers = ['S.No', 'Roll No', 'Reg No', 'Candidate Name', 'Father Name', 'Stream', 'Admission Status'];
    subjectsList.forEach(s => headers.push(`"${s.name} (${s.code})"`));
    headers.push('Total Obtained', 'Max Marks', 'Percentage', 'Result', 'Division');

    const csvLines = [headers.join(',')];
    filteredRows.forEach((r, idx) => {
      const line = [
        idx + 1,
        `"${r.rollNo}"`,
        `"${r.regNo}"`,
        `"${r.name}"`,
        `"${r.fatherName}"`,
        `"${r.stream}"`,
        `"${r.admissionStatus}"`
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

  // Dedicated End-to-End Multi-Page Landscape Print Generator
  const handlePrint = () => {
    if (filteredRows.length === 0) {
      alert('No candidate records available to print.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    const title = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG';
    const subtitle = 'OFFICIAL TABULATION REGISTER & CONSOLIDATED RESULT GAZETTE';
    const metaInfo = `Assessment: ${selectedEvalType} | Class: ${selectedClass} | Academic Session: ${selectedSession} | Status: ${selectedStatus === 'All' ? 'All Categories' : selectedStatus} | Candidates: ${filteredRows.length} | Date: ${new Date().toLocaleDateString()}`;

    const subjectHeadersHtml = subjectsList.map(s => `
      <th style="padding: 4px 5px; text-align: center; border: 1px solid #334155; font-size: 7.5pt; background: #f1f5f9; min-width: 50px;">
        <div style="font-weight: 800;">${s.name}</div>
        <div style="font-size: 6.5pt; color: #64748b;">(${s.code}) /${s.maxMarks}</div>
      </th>
    `).join('');

    const rowsHtml = filteredRows.map((row, idx) => {
      const isPass = row.resultStatus === 'PASS';
      const isFail = row.resultStatus === 'RE-APPEAR' || row.resultStatus === 'FAIL';

      const subjectCellsHtml = subjectsList.map(s => {
        const markObj = row.subjectMarks[s.code];
        if (!markObj) return `<td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; color: #94a3b8;">—</td>`;
        if (markObj.isAbsent) return `<td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #dc2626;">AB</td>`;
        const val = markObj.obtained;
        const isFailed = markObj.isFailed;
        return `
          <td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; ${isFailed ? 'color: #dc2626; background: #fef2f2;' : 'color: #0f172a;'}">
            ${val !== null ? val : '—'}
          </td>
        `;
      }).join('');

      return `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid; break-inside: avoid;">
          <td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-size: 8pt; color: #64748b;">${idx + 1}</td>
          <td style="padding: 3px 4px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; font-size: 8.5pt;">${row.rollNo || '—'}</td>
          <td style="padding: 3px 4px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 7.5pt; color: #475569;">${row.regNo || '—'}</td>
          <td style="padding: 3px 5px; border: 1px solid #cbd5e1;">
            <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a;">${row.name}</div>
            <div style="font-size: 7pt; color: #64748b;">S/O: ${row.fatherName}</div>
          </td>
          <td style="padding: 3px 4px; border: 1px solid #cbd5e1; font-size: 7.5pt; color: #334155;">${row.stream || 'General'}</td>
          ${subjectCellsHtml}
          <td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; font-size: 8pt;">
            ${row.totalMax > 0 ? `${row.totalObtained}/${row.totalMax}` : '—'}
          </td>
          <td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 800; color: #0f766e; font-size: 8pt;">
            ${row.percentage}
          </td>
          <td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-size: 7.5pt; font-weight: bold; ${isPass ? 'color: #166534;' : isFail ? 'color: #991b1b;' : 'color: #854d0e;'}">
            ${row.resultStatus}
          </td>
          <td style="padding: 3px 4px; text-align: center; border: 1px solid #cbd5e1; font-size: 7.5pt; color: #334155;">
            ${row.division}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${selectedClass} Gazette</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 landscape;
              margin: 8mm 6mm 10mm 6mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 6px;
              font-size: 8pt;
            }
            .header-block {
              text-align: center;
              margin-bottom: 8px;
              padding-bottom: 6px;
              border-bottom: 2px solid #0f172a;
            }
            .header-block h1 {
              font-size: 13pt;
              font-weight: 900;
              margin: 0 0 2px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f172a;
            }
            .header-block h2 {
              font-size: 10pt;
              font-weight: 800;
              margin: 0 0 4px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #334155;
            }
            .header-block p {
              font-size: 8pt;
              font-weight: 600;
              margin: 0;
              color: #475569;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
            }
            thead {
              display: table-header-group;
            }
            tbody {
              display: table-row-group;
            }
            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            th {
              background: #f1f5f9 !important;
              color: #0f172a;
              font-weight: 800;
              text-transform: uppercase;
              border: 1px solid #334155;
              padding: 4px 5px;
              font-size: 7.5pt;
            }
            .signatory-block {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 35px;
              padding-top: 15px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .sig-line {
              text-align: center;
              width: 180px;
              border-top: 1.5px solid #0f172a;
              padding-top: 4px;
              font-weight: 800;
              font-size: 8.5pt;
              color: #0f172a;
            }
          </style>
        </head>
        <body>
          <div class="header-block">
            <h1>${title}</h1>
            <h2>${subtitle}</h2>
            <p>${metaInfo}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">S.No</th>
                <th style="width: 55px;">Roll No</th>
                <th style="width: 75px;">Reg. No</th>
                <th style="min-width: 130px;">Candidate & Parentage</th>
                <th style="width: 60px;">Stream</th>
                ${subjectHeadersHtml}
                <th style="width: 50px; text-align: center;">Total</th>
                <th style="width: 45px; text-align: center;">%</th>
                <th style="width: 60px; text-align: center;">Result</th>
                <th style="width: 70px; text-align: center;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="signatory-block">
            <div class="sig-line">Evaluator / Teacher</div>
            <div class="sig-line">I/C Examinations</div>
            <div class="sig-line">Principal HSS Shangus</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  };

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100">
      {/* Dynamic Multi-Page Print Style Sheet */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @page {
          size: landscape;
          margin: 8mm 6mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #official-gazette-print-area, #official-gazette-print-area * {
            visibility: visible;
          }
          #official-gazette-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #official-gazette-print-area .overflow-x-auto,
          #official-gazette-print-area .overflow-y-auto {
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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
                  {selectedEvalType === 'ALL' ? 'All Evaluations' : selectedEvalType}
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
              title="Print Multi-Page Official Gazette"
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

        {/* High-Density Multi-Filter Ribbon (Evaluation, Class, Session, Stream, Status, Result, Search) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Exam / Evaluation */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-3">
            <select
              value={selectedEvalType}
              onChange={(e) => setSelectedEvalType(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-teal-800 dark:text-teal-300 font-bold focus:outline-none focus:border-teal-600"
            >
              <option value="ALL">All Evaluations (Consolidated)</option>
              {availableEvaluations.map(ev => (
                <option key={ev.id || ev.evalType} value={ev.evalType}>
                  {ev.evalType} ({ev.title || ev.session})
                </option>
              ))}
              <option value="Pre-Board Test">Pre-Board Test</option>
              <option value="Internal Assessment">Internal Assessment (Standard)</option>
              <option value="External Practical">External Practical (Standard)</option>
              <option value="Term End Evaluation">Term End Evaluation</option>
            </select>
          </div>

          {/* Class */}
          <div className="col-span-1 sm:col-span-1 lg:col-span-1">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {CLASSES.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>
          </div>

          {/* Session */}
          <div className="col-span-1 sm:col-span-1 lg:col-span-1">
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {SESSIONS.map(sess => (
                <option key={sess} value={sess}>{sess}</option>
              ))}
            </select>
          </div>

          {/* Stream */}
          <div className="col-span-1 sm:col-span-1 lg:col-span-2">
            <select
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
              className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600"
            >
              {STREAMS.map(str => (
                <option key={str} value={str}>{str === 'All' ? 'All Streams' : str}</option>
              ))}
            </select>
          </div>

          {/* Admission Category / Status Filter */}
          <div className="col-span-1 sm:col-span-1 lg:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-indigo-700 dark:text-indigo-400 font-bold focus:outline-none focus:border-indigo-600"
              title="Filter by admission / candidate status"
            >
              {STATUS_CATEGORIES.map(st => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>

          {/* Result Filter */}
          <div className="col-span-1 sm:col-span-1 lg:col-span-1">
            <select
              value={selectedResultFilter}
              onChange={(e) => setSelectedResultFilter(e.target.value)}
              className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-emerald-700 dark:text-emerald-400 font-bold focus:outline-none focus:border-teal-600"
              title="Filter by evaluation result"
            >
              {RESULT_FILTERS.map(rf => (
                <option key={rf.value} value={rf.value}>{rf.label}</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate, parentage..."
                className="w-full h-8 pl-7 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Ribbon */}
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

      {/* Official Master Tabulation Register / Gazette Card */}
      <div id="official-gazette-print-area" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Printable Institutional Letterhead (Hidden on screen, visible on print) */}
        <div className="hidden print:block p-4 pb-2 text-center border-b-2 border-black">
          <h1 className="text-base font-black uppercase tracking-wider text-black m-0">
            Govt. Higher Secondary School Shangus, Anantnag
          </h1>
          <h2 className="text-sm font-extrabold uppercase text-black m-0">
            Official Tabulation Register & Consolidated Result Gazette
          </h2>
          <p className="text-xs text-black font-semibold m-0">
            Assessment: <strong>{selectedEvalType}</strong> | Class: <strong>{selectedClass}</strong> | Academic Session: <strong>{selectedSession}</strong> | Status: <strong>{selectedStatus === 'All' ? 'All Categories' : selectedStatus}</strong> | Date: <strong>{new Date().toLocaleDateString()}</strong>
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
                <th className="py-2 px-2.5 min-w-[160px]">Candidate & Parentage</th>
                <th className="py-2 px-2">Stream</th>

                {/* Separate Subject Columns submitted by teachers */}
                {subjectsList.map(s => (
                  <th key={s.code} className="py-1.5 px-2 text-center min-w-[70px]" title={s.name}>
                    <span className="block truncate max-w-[90px]">{s.name}</span>
                    <span className="text-[8px] font-semibold text-slate-500 dark:text-slate-400">({s.code}) /{s.maxMarks}</span>
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
                const isReappear = row.resultStatus === 'RE-APPEAR';

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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-xs leading-tight">{row.name}</span>
                        {row.admissionStatus && (
                          <span className={`text-[8.5px] px-1 py-0.2 rounded font-black uppercase tracking-tight ${
                            String(row.admissionStatus).toLowerCase().includes('appr')
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : String(row.admissionStatus).toLowerCase().includes('provis')
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {row.admissionStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-tight">S/O: {row.fatherName}</p>
                    </td>
                    <td className="py-1.5 px-2 font-sans text-xs text-slate-700 dark:text-slate-300 font-medium">{row.stream}</td>

                    {/* Separate Subject Marks Columns */}
                    {subjectsList.map(s => {
                      const markObj = row.subjectMarks[s.code];
                      if (!markObj || markObj.obtained === null) {
                        return (
                          <td key={s.code} className="py-1.5 px-2 text-center text-slate-400 dark:text-slate-600 font-mono text-xs">
                            —
                          </td>
                        );
                      }

                      if (markObj.isAbsent) {
                        return (
                          <td key={s.code} className="py-1.5 px-2 text-center text-rose-700 dark:text-rose-400 font-bold text-[10.5px] font-mono">
                            AB
                          </td>
                        );
                      }

                      const val = markObj.obtained;
                      const isFailed = markObj.isFailed;

                      return (
                        <td
                          key={s.code}
                          className={`py-1.5 px-2 text-center font-mono font-bold text-xs ${
                            isFailed ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}

                    {/* Calculated Grand Total */}
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {row.totalMax > 0 ? `${row.totalObtained}/${row.totalMax}` : '—'}
                    </td>

                    {/* Calculated Percentage */}
                    <td className="py-1.5 px-2 text-center font-mono font-black text-teal-700 dark:text-teal-300">
                      {row.percentage}
                    </td>

                    {/* Calculated Result Status */}
                    <td className="py-1.5 px-2 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider inline-block ${
                          isPass
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : isReappear
                            ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : isAbsent
                            ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {row.resultStatus}
                      </span>
                    </td>

                    {/* Calculated Division / Grade */}
                    <td className="py-1.5 px-2 text-center font-sans text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {row.division}
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={subjectsList.length + 9} className="p-8 text-center text-slate-500 font-sans">
                    No candidate records found matching your active filters for Class {selectedClass} ({selectedSession}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Official Signatory Block */}
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
