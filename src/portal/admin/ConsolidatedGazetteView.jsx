import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText, Printer, Download, Search, RefreshCw, Filter, Award,
  CheckCircle2, AlertCircle, Users, BarChart3, TrendingUp, Layers,
  ChevronDown, ExternalLink, BookOpen, School, XCircle, ArrowUpDown, Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { DEFAULT_SCHOOL_EVALUATIONS, getSubjectOverride } from '../../utils/practicalsSettingsManager';
import { printIndividualAwardRoll } from '../../utils/practicalsPdfGenerator';
import { sameCohort, recordIdentity, identityKey, sessionKey, classKey, formatConsistentName } from '../../utils/recordIdentity';
import verifiedCatalog from '../../data/verifiedStudentsCatalog.json';
import { showToast } from '../../components/common/GlobalToast';
import { isStudentEnrolledInSubject } from './AdminPracticals';

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

export const SUBJECT_RESULT_FILTERS = [
  { value: 'All', label: 'All Candidates' },
  { value: 'EVALUATED', label: 'Evaluated / Appeared' },
  { value: 'PASS', label: 'Passed (≥ 36%)' },
  { value: 'RE-APPEAR', label: 'Re-Appear (< 36%)' },
  { value: 'ABSENT', label: 'Absent (AB)' },
  { value: 'NOT_EVALUATED', label: 'Pending / Not Evaluated' },
];

/**
 * Authoritative 15 Separate Subjects Offered at Govt. Higher Secondary School Shangus (Class 11th & 12th)
 * Compulsory: General English
 * Science: Physics, Chemistry, Botany, Zoology, Mathematics
 * Electives / Vocational: Environmental Science, Physical Education, Healthcare, IT & ITeS
 * Humanities: Economics, Political Science, History, Education, Urdu
 */
export const STANDARD_15_GAZETTE_SUBJECTS = [
  { code: 'EN', name: 'General English', defaultMax: 50 },
  { code: 'PH', name: 'Physics', defaultMax: 50 },
  { code: 'CH', name: 'Chemistry', defaultMax: 50 },
  { code: 'BO', name: 'Botany', defaultMax: 50 },
  { code: 'ZO', name: 'Zoology', defaultMax: 50 },
  { code: 'MA', name: 'Mathematics', defaultMax: 50 },
  { code: 'ES', name: 'Environmental Science', defaultMax: 50 },
  { code: 'PD', name: 'Physical Education', defaultMax: 50 },
  { code: 'HTC', name: 'Healthcare', defaultMax: 50 },
  { code: 'ITE', name: 'IT & ITeS', defaultMax: 50 },
  { code: 'EC', name: 'Economics', defaultMax: 50 },
  { code: 'PS', name: 'Political Science', defaultMax: 50 },
  { code: 'HT', name: 'History', defaultMax: 50 },
  { code: 'ED', name: 'Education', defaultMax: 50 },
  { code: 'UR', name: 'Urdu', defaultMax: 50 },
];

/**
 * Authoritative 7 Standard Subjects Offered for Class 10th (Secondary) at Govt. Higher Secondary School Shangus:
 * 1. General English (EN)
 * 2. Mathematics (MA)
 * 3. Science (SC)
 * 4. Social Science (SS)
 * 5. Urdu (UR)
 * 6. Healthcare (HTC)
 * 7. IT & ITeS (ITE)
 */
export const STANDARD_7_CLASS_10TH_SUBJECTS = [
  { code: 'EN', name: 'General English', defaultMax: 50 },
  { code: 'MA', name: 'Mathematics', defaultMax: 50 },
  { code: 'SC', name: 'Science', defaultMax: 50 },
  { code: 'SS', name: 'Social Science', defaultMax: 50 },
  { code: 'UR', name: 'Urdu', defaultMax: 50 },
  { code: 'HTC', name: 'Healthcare', defaultMax: 50 },
  { code: 'ITE', name: 'IT & ITeS', defaultMax: 50 },
];

/**
 * Multi-tier student record matcher against a teacher's evaluation section records.
 * Compares Board Reg No, Form No, Class Roll No, and normalized Candidate Name.
 */
function matchStudentRecord(rec, student, identity) {
  if (!rec) return false;

  // 1. Board Registration Number (100% authoritative)
  const rowReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
  if (rowReg && identity.reg && rowReg === identity.reg) return true;

  // 2. Form Number
  const rowForm = identityKey(rec.formNo || rec.form || rec.id);
  if (rowForm && identity.form && rowForm === identity.form) return true;

  // 3. Class Roll Number
  const rowRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
  if (rowRoll && identity.roll && rowRoll === identity.roll && rowRoll !== '-' && rowRoll !== '—' && rowRoll !== 'n/a') return true;

  // 4. Candidate Name (clean alphanumeric match)
  const rowName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const stuName = String(student.studentName || student.name || student["Student's Name"] || student["Student's Name (as per school records)"] || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (rowName && stuName && rowName.length > 3 && (rowName === stuName || rowName.includes(stuName) || stuName.includes(rowName))) return true;

  return false;
}

export default function ConsolidatedGazetteView({ allStudents = [] }) {
  const [selectedEvalType, setSelectedEvalType] = useState('Pre-Board Test');
  const [selectedClass, setSelectedClass] = useState('11th');
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedStream, setSelectedStream] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedResultFilter, setSelectedResultFilter] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedSubjectResult, setSelectedSubjectResult] = useState('All');
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

  // Real-Time Live Firestore Listener: Immediately reflects teacher partial or full submissions
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'practicalsData'),
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setPracticalsDocs(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Real-time practicalsData listener error:', err);
        getDocs(collection(db, 'practicalsData'))
          .then(snap => setPracticalsDocs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
          .finally(() => setLoading(false));
      }
    );
    return () => unsubscribe();
  }, []);

  // Manual refresh fallback
  const refreshPracticalsData = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'practicalsData'));
      setPracticalsDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to manually reload practicalsData:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Aggregate student and 15 subject marks matrix
  const { gazetteRows, subjectsList, stats } = useMemo(() => {
    const targetClass = classKey(selectedClass);
    const targetSession = sessionKey(selectedSession);

    // 1. Identify matching practicals documents submitted by teachers (including partial submissions)
    const matchingDocs = practicalsDocs.filter(section => {
      // Must contain student records
      if (!Array.isArray(section.records) || section.records.length === 0) return false;

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

    // Sort matchingDocs: exact class match first, then newest timestamp
    matchingDocs.sort((a, b) => {
      const aExact = String(a.className || '').trim() === selectedClass ? 1 : 0;
      const bExact = String(b.className || '').trim() === selectedClass ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const getTs = (d) => {
        const t = d.updatedAt || d.approvedAt || d.submittedAt;
        if (!t) return 0;
        const dt = new Date(t);
        return isNaN(dt.getTime()) ? 0 : dt.getTime();
      };
      return getTs(b) - getTs(a);
    });

    // 2. Select appropriate standard subjects list based on class (Class 10th/9th has only 7 subjects, 11th/12th has 15 subjects)
    const isSecondary = targetClass === '10th' || targetClass === '9th' || targetClass === '10' || targetClass === '9';
    const baseSubjects = isSecondary ? STANDARD_7_CLASS_10TH_SUBJECTS : STANDARD_15_GAZETTE_SUBJECTS;

    // Active evaluation configuration & selective Pre-Board check
    const activeEvalConfig = availableEvaluations.find(e => (e.evalType || e.title) === selectedEvalType);
    const isPreBoard = String(selectedEvalType).toLowerCase().includes('pre-board') ||
                       String(selectedEvalType).toLowerCase().includes('preboard') ||
                       (activeEvalConfig && activeEvalConfig.normalizeTo50 === true && (String(activeEvalConfig.evalType).toLowerCase().includes('pre-board') || String(activeEvalConfig.evalType).toLowerCase().includes('preboard')));

    const subjectsListArray = baseSubjects.map(subj => {
      // Find matching document for this subject to retrieve teacher's maxMarks and minMarks
      const matchedDoc = matchingDocs.find(sec => {
        const c = (sec.subjectCode || '').toUpperCase().trim();
        const n = String(sec.subjectName || sec.subject || '').toLowerCase();
        if (c === subj.code) return true;
        if (subj.code === 'EN' && (c === 'GE' || n.includes('english'))) return true;
        if (subj.code === 'PH' && (c === 'PHY' || n.includes('physics'))) return true;
        if (subj.code === 'CH' && (c === 'CHEM' || n.includes('chemistry'))) return true;
        if (subj.code === 'BO' && (c === 'BO' || n.includes('botany'))) return true;
        if (subj.code === 'ZO' && (c === 'ZO' || n.includes('zoology'))) return true;
        if ((subj.code === 'BO' || subj.code === 'ZO') && (c === 'BI' || n.includes('biology'))) return true;
        if (subj.code === 'MA' && (c === 'MATH' || c === 'MATHS' || n.includes('mathematics') || n.includes('math'))) return true;
        if (subj.code === 'SC' && (c === 'SC' || c === 'SCI' || c === 'SCIENCE' || (n.includes('science') && !n.includes('social') && !n.includes('pol') && !n.includes('environmental') && !n.includes('computer')))) return true;
        if (subj.code === 'SS' && (c === 'SS' || c === 'SST' || c === 'SOC' || n.includes('social science') || n.includes('social studies') || n === 'sst')) return true;
        if (subj.code === 'ES' && (c === 'EVS' || n.includes('environmental') || n.includes('env'))) return true;
        if (subj.code === 'PD' && (c === 'PE' || c === 'PET' || n.includes('physical'))) return true;
        if (subj.code === 'HTC' && (c === 'HC' || (c === 'HT' && n.includes('health')) || n.includes('healthcare') || n.includes('health care'))) return true;
        if (subj.code === 'ITE' && (c === 'IT' || c === 'CS' || c === 'IP' || n.includes('ites') || n.includes('information') || n.includes('it & ites') || n.includes('it and ites'))) return true;
        if (subj.code === 'EC' && (c === 'ECO' || n.includes('economics'))) return true;
        if (subj.code === 'PS' && (c === 'POL' || n.includes('political') || n.includes('pol science'))) return true;
        if (subj.code === 'HT' && (c === 'HIST' || (c === 'HT' && !n.includes('health')) || n.includes('history'))) return true;
        if (subj.code === 'ED' && (c === 'EDU' || n.includes('education'))) return true;
        if (subj.code === 'UR' && (c === 'UR' || n.includes('urdu'))) return true;
        return n === subj.name.toLowerCase() || n.includes(subj.name.toLowerCase());
      });

      // Check subject override for this class & subject
      const override = getSubjectOverride(activeEvalConfig?.subjectOverrides, subj.code, selectedClass);

      let maxMarks;
      let minMarks;

      if (isPreBoard) {
        // Pre-Board Gazette strictly standardizes columns to 50M
        maxMarks = 50;
        minMarks = 18;
      } else {
        // Non-pre-board examinations (Term End, Mid Term, Unit Tests, Internal, External)
        // preserve the authentic entered or configured assessment scale
        if (override && Number(override.maxMarks) > 0) {
          maxMarks = Number(override.maxMarks);
          minMarks = Number(override.minMarks) > 0 ? Number(override.minMarks) : Math.ceil(maxMarks * 0.36);
        } else if (matchedDoc && Number(matchedDoc.maxMarks) > 0) {
          maxMarks = Number(matchedDoc.maxMarks);
          minMarks = Number(matchedDoc.minMarks) > 0 ? Number(matchedDoc.minMarks) : Math.ceil(maxMarks * 0.36);
        } else {
          maxMarks = subj.defaultMax || 50;
          minMarks = Math.ceil(maxMarks * 0.36);
        }
      }

      return {
        code: subj.code,
        name: subj.name,
        maxMarks,
        minMarks,
      };
    });

    // Filter cohort students for class and session
    const cohort = allStudents.filter(student => sameCohort(student, selectedSession, selectedClass) && !student._deleted);

    // 3. Compile student rows, populate 15 subject marks, and calculate total, %, result, and grade
    const compiledRows = cohort.map((student, index) => {
      const identity = recordIdentity(student);

      // Authoritative Admission Status: any student with an assigned Class Roll Number is Approved/Confirmed
      const hasAssignedRoll = Boolean(student.classRollNo || student['Class Roll No'] || student.rollNo);
      const rawStatus = student.Status || student.status || student.admissionStatus || student['Application Status'] || '';
      const isExplicitApproved = String(rawStatus).toLowerCase().includes('appr') || student.isApproved === true;
      const isApproved = isExplicitApproved || (hasAssignedRoll && !String(rawStatus).toLowerCase().includes('reject'));
      const isProvisional = !isApproved && (String(rawStatus).toLowerCase().includes('provis') || student.isProvisional === true);
      const admissionStatus = isApproved ? 'Approved' : isProvisional ? 'Provisional' : (String(rawStatus).trim() || 'Submitted');

      // ── Comprehensive Board Registration Number Resolution ──
      const rawReg = (
        student.boardRegNo ||
        student.regNo ||
        student.reg ||
        student['Board Registration Number'] ||
        student['Board Registration No.'] ||
        student['Board Registration No'] ||
        student['Board Reg. No.'] ||
        student['Board Reg No'] ||
        student['Registration No. (allotted by JKBOSE)'] ||
        student['Registration No. (allotted by JKBOSE )'] ||
        student['Registration No.'] ||
        student['Registration No'] ||
        student['Reg. No.'] ||
        student['Reg No'] ||
        student['REG. NO.'] ||
        student['REG NO'] ||
        student['Board Registration No. (Class 10th)'] ||
        student['Board Registration No. (Class 11th)'] ||
        student['Board Registration No. (Class 9th)'] ||
        student['DIET Registration No.'] ||
        ''
      ).toString().trim();

      const rawStream = (
        student.stream ||
        student.Stream ||
        student['Stream for Class 11th'] ||
        student['Stream for Class 12th'] ||
        student['Stream & Subjects for Class 12th'] ||
        student['Stream'] ||
        ''
      ).toString().trim();

      let resolvedRegNo = (rawReg && rawReg !== '-' && rawReg !== '—' && rawReg !== 'null' && rawReg !== 'undefined') ? rawReg : '';
      let resolvedStream = (rawStream && rawStream.toLowerCase() !== 'general' && rawStream !== '-' && rawStream !== '—') ? rawStream : '';

      const fNo = identityKey(student.formNo || student['Form Number'] || student.form);
      const rNo = identityKey(student.classRollNo || student['Class Roll No'] || student.rollNo);
      const sName = (student.studentName || student.name || student["Student's Name (as per school records)"] || student["Student's Name"] || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

      // Fallback lookup against verified students catalog
      const catalogMatch = verifiedCatalog.find(c => {
        if (fNo && identityKey(c.fNo) === fNo) return true;
        if (rNo && identityKey(c.classRollNo) === rNo && (c.className === selectedClass || !c.className)) return true;
        if (sName && sName.length > 3) {
          const cName = String(c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          if (cName === sName && (c.className === selectedClass || !c.className)) return true;
        }
        return false;
      });

      if (catalogMatch) {
        if (!resolvedRegNo && catalogMatch.boardRegNo && catalogMatch.boardRegNo.trim()) {
          resolvedRegNo = catalogMatch.boardRegNo.trim();
        }
        if (!resolvedStream && catalogMatch.stream && catalogMatch.stream.trim()) {
          resolvedStream = catalogMatch.stream.trim();
        }
      }

      // Infer stream from enrolled/studied subjects if still empty or 'General'
      if (!resolvedStream || resolvedStream.toLowerCase() === 'general') {
        const subStr = String(
          student['Subjects to be taken in Class 11th'] ||
          student['Subjects Studied in Class 11th'] ||
          student['Subjects to be taken in Class 12th'] ||
          student['Subjects Studied in Class 12th'] ||
          student.subjects ||
          ''
        ).toLowerCase();

        if (subStr.includes('physic') || subStr.includes('chemist') || subStr.includes('biolog')) {
          resolvedStream = 'Science';
        } else if (subStr.includes('history') || subStr.includes('political') || subStr.includes('education') || subStr.includes('urdu') || subStr.includes('econom')) {
          resolvedStream = 'Humanities';
        }
      }

      if (!resolvedRegNo) resolvedRegNo = '—';
      if (!resolvedStream) resolvedStream = 'General';

      const subjectMarks = {};
      let totalObtained = 0;
      let totalMax = 0;
      let evaluatedSubjectsCount = 0;
      let absentSubjectsCount = 0;
      let failedSubjectsCount = 0;

      // Populate each of the 15 subject columns
      subjectsListArray.forEach(sMeta => {
        const code = sMeta.code;
        let foundRecord = null;
        let foundRecordDoc = null;
        let foundRecordIsAbsent = false;
        let isFromBiology = false;

        // Search matching teacher submission for this subject
        for (const sec of matchingDocs) {
          const sCode = (sec.subjectCode || '').toUpperCase().trim();
          const sName = String(sec.subjectName || sec.subject || '').toLowerCase();

          const isDirectMatch = sCode === code || sName === sMeta.name.toLowerCase() ||
            (code === 'EN' && (sCode === 'GE' || sName.includes('english'))) ||
            (code === 'PH' && (sCode === 'PHY' || sName.includes('physics'))) ||
            (code === 'CH' && (sCode === 'CHEM' || sName.includes('chemistry'))) ||
            (code === 'BO' && (sCode === 'BO' || sName.includes('botany'))) ||
            (code === 'ZO' && (sCode === 'ZO' || sName.includes('zoology'))) ||
            (code === 'MA' && (sCode === 'MATH' || sCode === 'MATHS' || sName.includes('mathematics') || sName.includes('math'))) ||
            (code === 'SC' && (sCode === 'SC' || sCode === 'SCI' || sCode === 'SCIENCE' || (sName.includes('science') && !sName.includes('social') && !sName.includes('pol') && !sName.includes('environmental') && !sName.includes('computer')))) ||
            (code === 'SS' && (sCode === 'SS' || sCode === 'SST' || sCode === 'SOC' || sName.includes('social science') || sName.includes('social studies') || sName === 'sst')) ||
            (code === 'ES' && (sCode === 'EVS' || sName.includes('environmental') || sName.includes('env'))) ||
            (code === 'PD' && (sCode === 'PE' || sCode === 'PET' || sName.includes('physical'))) ||
            (code === 'HTC' && (sCode === 'HC' || (sCode === 'HT' && sName.includes('health')) || sName.includes('healthcare') || sName.includes('health care'))) ||
            (code === 'ITE' && (sCode === 'IT' || sCode === 'CS' || sCode === 'IP' || sName.includes('ites') || sName.includes('information') || sName.includes('it & ites') || sName.includes('it and ites'))) ||
            (code === 'EC' && (sCode === 'ECO' || sName.includes('economics'))) ||
            (code === 'PS' && (sCode === 'POL' || sName.includes('political') || sName.includes('pol science'))) ||
            (code === 'HT' && (sCode === 'HIST' || (sCode === 'HT' && !sName.includes('health')) || sName.includes('history'))) ||
            (code === 'ED' && (sCode === 'EDU' || sCode === 'ED' || (sName.includes('education') && !sName.includes('physical') && !sName.includes('ped')))) ||
            (code === 'UR' && (sCode === 'UR' || sName.includes('urdu')));

          if (isDirectMatch) {
            const recs = sec.records || [];
            const match = recs.find(r => matchStudentRecord(r, student, identity));
            if (match) {
              const rawM = match.totalMarks ?? match.practicalMarks;
              const isAb = /^(a|ab|absent)$/i.test(String(rawM).trim());
              if (!foundRecord || (foundRecordIsAbsent && !isAb && rawM !== '' && rawM !== null && rawM !== undefined)) {
                foundRecord = match;
                foundRecordDoc = sec;
                foundRecordIsAbsent = isAb;
                isFromBiology = false;
                if (!isAb) break;
              }
            }
          }
        }

        // Fallback for BO and ZO from Biology (BI) submission if no separate BO/ZO was submitted
        if (!foundRecord && (code === 'BO' || code === 'ZO')) {
          for (const sec of matchingDocs) {
            const sCode = (sec.subjectCode || '').toUpperCase().trim();
            const sName = String(sec.subjectName || sec.subject || '').toLowerCase();
            if (sCode === 'BI' || sName.includes('biology')) {
              const recs = sec.records || [];
              const match = recs.find(r => matchStudentRecord(r, student, identity));
              if (match) {
                foundRecord = match;
                foundRecordDoc = sec;
                isFromBiology = true;
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
            totalMax += sMeta.maxMarks;
            subjectMarks[code] = {
              obtained: 'AB',
              isAbsent: true,
              isPass: false,
              isFailed: true,
              maxMarks: sMeta.maxMarks,
              minMarks: sMeta.minMarks,
            };
          } else if (hasNumeric) {
            evaluatedSubjectsCount++;
            // Calculate scaled score:
            // Fetch subject-specific paper override for this class & subject (e.g. Botany 25M, Zoology 50M)
            const override = getSubjectOverride(activeEvalConfig?.subjectOverrides, code, selectedClass);
            let nativePaperMax = Number(foundRecordDoc?.maxMarks);
            if (!nativePaperMax || nativePaperMax <= 0) {
              if (override && Number(override.maxMarks) > 0) {
                nativePaperMax = Number(override.maxMarks);
              } else if (code === 'BO') {
                // Botany default in Pre-Board is 25M
                nativePaperMax = 25;
              } else if (code === 'ZO') {
                // Zoology default in Pre-Board is 50M
                nativePaperMax = 50;
              } else {
                nativePaperMax = isPreBoard ? 50 : sMeta.maxMarks;
              }
            }

            let marksVal = numeric;
            if (isPreBoard) {
              if (isFromBiology) {
                // Biology combined paper (e.g. 50M combined)
                const biMax = Number(foundRecordDoc?.maxMarks) || 50;
                marksVal = Math.round((numeric / biMax) * 50);
              } else if (nativePaperMax > 0 && nativePaperMax !== 50) {
                // Asymmetric scaling: Botany 25M scales 2x into 50M, Zoology 50M scales 1x into 50M
                marksVal = Math.round((numeric / nativePaperMax) * 50);
              }
              marksVal = Math.min(50, Math.max(0, marksVal));
            } else {
              // Non-Pre-Board (Term End, Mid Term, Unit Test, Internal, External)
              // Retains the exact marks entered on the native paper scale
              marksVal = numeric;
              if (nativePaperMax > 0) {
                marksVal = Math.min(nativePaperMax, Math.max(0, marksVal));
              }
            }

            const isPass = marksVal >= sMeta.minMarks;
            totalObtained += marksVal;
            totalMax += sMeta.maxMarks;
            if (!isPass) failedSubjectsCount++;

            subjectMarks[code] = {
              obtained: marksVal,
              nativeMark: numeric,
              nativeMax: nativePaperMax,
              isAbsent: false,
              isPass,
              isFailed: !isPass,
              maxMarks: sMeta.maxMarks,
              minMarks: sMeta.minMarks,
            };
          } else {
            subjectMarks[code] = {
              obtained: null,
              isAbsent: false,
              isPass: false,
              isFailed: false,
              maxMarks: sMeta.maxMarks,
              minMarks: sMeta.minMarks,
            };
          }
        } else {
          subjectMarks[code] = {
            obtained: null,
            isAbsent: false,
            isPass: false,
            isFailed: false,
            maxMarks: sMeta.maxMarks,
            minMarks: sMeta.minMarks,
          };
        }
      });

      // Further stream inference from recorded subject marks if still 'General'
      if (resolvedStream === 'General') {
        if (subjectMarks.PH?.obtained !== null || subjectMarks.CH?.obtained !== null || subjectMarks.BO?.obtained !== null || subjectMarks.ZO?.obtained !== null) {
          resolvedStream = 'Science';
        } else if (subjectMarks.HT?.obtained !== null || subjectMarks.PS?.obtained !== null || subjectMarks.ED?.obtained !== null || subjectMarks.UR?.obtained !== null || subjectMarks.EC?.obtained !== null) {
          resolvedStream = 'Humanities';
        }
      }

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
          division = 'Re-Appear / Fail';
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
        regNo: resolvedRegNo,
        formNo: student.formNo || student['Form Number'] || student.form || '—',
        name: formatConsistentName(student.studentName || student.name || student["Student's Name (as per school records)"] || student["Student's Name"] || 'Student'),
        fatherName: formatConsistentName(student.fatherName || student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || '—'),
        stream: resolvedStream,
        admissionStatus,
        isApproved,
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

    compiledRows.sort((a, b) => {
      const aHas = a.rollNo && a.rollNo !== '—';
      const bHas = b.rollNo && b.rollNo !== '—';
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (aHas && bHas) {
        const numA = parseInt(a.rollNo, 10);
        const numB = parseInt(b.rollNo, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
      }
      return (a.name || '').localeCompare(b.name || '');
    });

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

  // Subject-Specific Analysis & Drilldown Metrics
  const selectedSubjectMeta = useMemo(() => {
    if (selectedSubject === 'All') return null;
    return subjectsList.find(s => s.code === selectedSubject) || null;
  }, [selectedSubject, subjectsList]);

  const subjectStats = useMemo(() => {
    if (!selectedSubjectMeta) return null;
    const code = selectedSubjectMeta.code;
    const enrolledRows = gazetteRows.filter(r => {
      const m = r.subjectMarks[code];
      const hasMark = m && (m.obtained !== null || m.isAbsent);
      return hasMark || isStudentEnrolledInSubject(r.student, code, selectedClass);
    });
    const rowsWithSubject = enrolledRows.filter(r => {
      const m = r.subjectMarks[code];
      return m && (m.obtained !== null || m.isAbsent);
    });
    const appearedCount = rowsWithSubject.length;
    const passedCount = rowsWithSubject.filter(r => r.subjectMarks[code]?.isPass).length;
    const failedCount = rowsWithSubject.filter(r => r.subjectMarks[code]?.isFailed && !r.subjectMarks[code]?.isAbsent).length;
    const absentCount = rowsWithSubject.filter(r => r.subjectMarks[code]?.isAbsent).length;
    const numericScores = rowsWithSubject
      .filter(r => typeof r.subjectMarks[code]?.obtained === 'number')
      .map(r => r.subjectMarks[code].obtained);
    const avgScore = numericScores.length
      ? (numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1)
      : '0.0';
    const passPct = appearedCount > 0 ? Math.round((passedCount / appearedCount) * 100) : 0;

    return {
      code,
      name: selectedSubjectMeta.name,
      maxMarks: selectedSubjectMeta.maxMarks,
      minMarks: selectedSubjectMeta.minMarks,
      totalEnrolled: enrolledRows.length,
      appearedCount,
      passedCount,
      failedCount,
      absentCount,
      avgScore,
      passPct
    };
  }, [selectedSubjectMeta, gazetteRows, selectedClass]);

  // Filtered rows for Search, Stream, Admission Status, Subject, and Result
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
        if (target === 'approved') return st.includes('appr') || r.isApproved === true;
        if (target === 'submitted') return st.includes('submit');
        if (target === 'provisional') return st.includes('provis');
        if (target === 'pending') return st.includes('pend') || st.includes('review');
        if (target === 'draft') return st.includes('draft');
        if (target === 'withdrawn') return st.includes('withdr');
        return st === target;
      });
    }

    // 3. Overall Result Status Filter (Pass, Re-Appear, Absent, Pending)
    if (selectedResultFilter !== 'All') {
      rows = rows.filter(r => r.resultStatus === selectedResultFilter);
    }

    // 4. Particular Subject Filter & Drilldown
    if (selectedSubject !== 'All') {
      rows = rows.filter(r => {
        const m = r.subjectMarks[selectedSubject];
        const hasMark = m && (m.obtained !== null || m.isAbsent);
        const isEnrolled = isStudentEnrolledInSubject(r.student, selectedSubject, selectedClass);
        if (selectedSubjectResult === 'EVALUATED') return hasMark;
        if (selectedSubjectResult === 'PASS') return m && m.isPass;
        if (selectedSubjectResult === 'RE-APPEAR') return m && m.isFailed && !m.isAbsent;
        if (selectedSubjectResult === 'ABSENT') return m && m.isAbsent;
        if (selectedSubjectResult === 'NOT_EVALUATED') return isEnrolled && !hasMark;
        return isEnrolled || hasMark;
      });
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
  }, [gazetteRows, selectedStream, selectedStatus, selectedResultFilter, selectedSubject, selectedSubjectResult, searchQuery]);

  // Export to Excel (.xlsx) with all 15 separate subject columns
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      showToast('No candidate records available to export.', 'warning');
      return;
    }

    const headerRow = [
      'S.No',
      'Class Roll No',
      'Board Reg. No',
      'Candidate Name',
      "Father's Name",
      'Stream',
      'Status'
    ];

    subjectsList.forEach(s => {
      headerRow.push(`${s.code} [Max:${s.maxMarks}]`);
    });

    headerRow.push('Total Obtained', 'Max Marks', 'Percentage %', 'Result', 'Grade / Division');

    const dataRows = filteredRows.map((r, idx) => {
      const row = [
        idx + 1,
        r.rollNo || '—',
        r.regNo || '—',
        r.name || '—',
        r.fatherName || '—',
        r.stream || 'General',
        r.admissionStatus || 'Approved'
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

    const titleRows = [
      [`GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG`],
      [`CONSOLIDATED 15-SUBJECT TABULATION REGISTER & RESULT GAZETTE - ${selectedEvalType.toUpperCase()}`],
    ];
    if (selectedSubject !== 'All') {
      titleRows.push([`Subject: ${selectedSubjectMeta?.name || selectedSubject} (${selectedSubject}) | Filter: ${selectedSubjectResult} | Candidates: ${filteredRows.length}`]);
    }
    titleRows.push([`Class: ${selectedClass} | Academic Session: ${selectedSession} | Status: ${selectedStatus} | Generated: ${new Date().toLocaleDateString()}`]);
    titleRows.push([]);

    const worksheet = XLSX.utils.aoa_to_sheet([
      ...titleRows,
      headerRow,
      ...dataRows
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedClass}_Gazette`);

    const filename = selectedSubject !== 'All'
      ? `HSS_Shangus_${selectedClass}_${selectedSubject}_${selectedSubjectResult}_${selectedSession}_Gazette.xlsx`
      : `HSS_Shangus_${selectedClass}_${selectedEvalType.replace(/\s+/g, '_')}_${selectedSession}_Gazette.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;

    const headers = ['S.No', 'Roll No', 'Reg No', 'Candidate Name', 'Father Name', 'Stream', 'Status'];
    subjectsList.forEach(s => headers.push(`"${s.code} /${s.maxMarks}"`));
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
    const csvFilename = selectedSubject !== 'All'
      ? `Gazette_${selectedClass}_${selectedSubject}_${selectedSubjectResult}_${selectedSession}.csv`
      : `Gazette_${selectedClass}_${selectedSession}.csv`;
    link.setAttribute('download', csvFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dedicated End-to-End Multi-Page Landscape Print Generator with 15 Abbreviations
  const handlePrint = () => {
    if (filteredRows.length === 0) {
      showToast('No candidate records available to print.', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    const title = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG';
    const subtitle = selectedSubject !== 'All'
      ? `OFFICIAL TABULATION REGISTER & RESULT GAZETTE — SUBJECT: ${selectedSubjectMeta?.name?.toUpperCase() || selectedSubject} (${selectedSubject})`
      : 'OFFICIAL TABULATION REGISTER & CONSOLIDATED RESULT GAZETTE';
    const metaInfo = `Assessment: ${selectedEvalType} | Class: ${selectedClass} | Academic Session: ${selectedSession} | Status: ${selectedStatus === 'All' ? 'All Categories' : selectedStatus}${selectedSubject !== 'All' ? ` | Filter: ${selectedSubjectResult}` : ''} | Candidates: ${filteredRows.length} | Date: ${new Date().toLocaleDateString()}`;

    // Subject Headers: Abbreviation only (with Botany & Zoology separate)
    const subjectHeadersHtml = subjectsList.map(s => {
      const isSelected = selectedSubject === s.code;
      return `
        <th style="padding: 3px 2px; text-align: center; border: 1px solid #334155; font-size: 7.5pt; ${isSelected ? 'background: #ccfbf1 !important; border: 2px solid #0f766e;' : 'background: #f1f5f9;'} min-width: 32px;" title="${s.name}">
          <div style="font-weight: 800; font-family: monospace; ${isSelected ? 'color: #0f766e;' : ''}">${s.code}</div>
          <div style="font-size: 6.5pt; color: #64748b; font-family: monospace;">/${s.maxMarks}</div>
        </th>
      `;
    }).join('');

    const rowsHtml = filteredRows.map((row, idx) => {
      const isPass = row.resultStatus === 'PASS';
      const isFail = row.resultStatus === 'RE-APPEAR' || row.resultStatus === 'FAIL';

      const subjectCellsHtml = subjectsList.map(s => {
        const isSelected = selectedSubject === s.code;
        const markObj = row.subjectMarks[s.code];
        if (!markObj || markObj.obtained === null) {
          return `<td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; color: #94a3b8; font-size: 7.5pt; ${isSelected ? 'background: #f0fdfa;' : ''}">—</td>`;
        }
        if (markObj.isAbsent) {
          return `<td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #dc2626; font-size: 7.5pt; ${isSelected ? 'background: #fee2e2;' : ''}">AB</td>`;
        }
        const val = markObj.obtained;
        const isFailed = markObj.isFailed;
        return `
          <td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; font-size: 7.5pt; ${isSelected ? (isFailed ? 'color: #dc2626; background: #fee2e2; border-left: 2px solid #0f766e; border-right: 2px solid #0f766e;' : 'color: #0f766e; background: #f0fdfa; border-left: 2px solid #0f766e; border-right: 2px solid #0f766e;') : (isFailed ? 'color: #dc2626; background: #fef2f2;' : 'color: #0f172a;')}">
            ${val !== null ? val : '—'}
          </td>
        `;
      }).join('');

      return `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid; break-inside: avoid;">
          <td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-size: 7.5pt; color: #64748b;">${idx + 1}</td>
          <td style="padding: 3px 2px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; font-size: 8pt;">${row.rollNo || '—'}</td>
          <td style="padding: 3px 2px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 7.5pt; font-weight: 600; color: #1e293b; white-space: nowrap;">${row.regNo || '—'}</td>
          <td style="padding: 3px 4px; border: 1px solid #cbd5e1;">
            <div style="font-weight: bold; font-size: 8pt; color: #0f172a;">${row.name}</div>
            <div style="font-size: 6.5pt; color: #64748b;">S/O: ${row.fatherName}</div>
          </td>
          <td style="padding: 3px 2px; border: 1px solid #cbd5e1; font-size: 7pt; color: #334155;">${row.stream || 'General'}</td>
          ${subjectCellsHtml}
          <td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; font-size: 7.5pt;">
            ${row.totalMax > 0 ? `${row.totalObtained}/${row.totalMax}` : '—'}
          </td>
          <td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 800; color: #0f766e; font-size: 7.5pt;">
            ${row.percentage}
          </td>
          <td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-size: 7pt; font-weight: bold; ${isPass ? 'color: #166534;' : isFail ? 'color: #991b1b;' : 'color: #854d0e;'}">
            ${row.resultStatus}
          </td>
          <td style="padding: 3px 2px; text-align: center; border: 1px solid #cbd5e1; font-size: 7pt; color: #334155;">
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
              margin: 7mm 5mm 8mm 5mm;
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
              padding: 4px;
              font-size: 7.5pt;
            }
            .header-block {
              text-align: center;
              margin-bottom: 6px;
              padding-bottom: 4px;
              border-bottom: 2px solid #0f172a;
            }
            .header-block h1 {
              font-size: 12pt;
              font-weight: 900;
              margin: 0 0 2px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f172a;
            }
            .header-block h2 {
              font-size: 9.5pt;
              font-weight: 800;
              margin: 0 0 2px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #334155;
            }
            .header-block p {
              font-size: 7.5pt;
              font-weight: 600;
              margin: 0;
              color: #475569;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
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
              padding: 3px 2px;
              font-size: 7pt;
            }
            .signatory-block {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 30px;
              padding-top: 10px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .sig-line {
              text-align: center;
              width: 170px;
              border-top: 1.5px solid #0f172a;
              padding-top: 4px;
              font-weight: 800;
              font-size: 8pt;
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
                <th style="width: 25px; text-align: center;">S.No</th>
                <th style="width: 48px;">Roll No</th>
                <th style="width: 65px;">Reg. No</th>
                <th style="min-width: 115px;">Candidate & Parentage</th>
                <th style="width: 50px;">Stream</th>
                ${subjectHeadersHtml}
                <th style="width: 45px; text-align: center;">Total</th>
                <th style="width: 38px; text-align: center;">%</th>
                <th style="width: 50px; text-align: center;">Result</th>
                <th style="width: 60px; text-align: center;">Grade</th>
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

  // Official Subject-Wise Award Roll Print Handler (2-column JKBOSE Format)
  const handlePrintIndividualAwardRoll = useCallback((subjCode) => {
    const targetSubjCode = subjCode || (selectedSubject !== 'All' ? selectedSubject : subjectsList[0]?.code);
    if (!targetSubjCode) return;

    const subMeta = subjectsList.find(s => s.code === targetSubjCode);
    if (!subMeta) return;

    // Filter students enrolled or who have a record for this subject
    const subjectStudents = gazetteRows.filter(row => {
      const sm = row.subjectMarks?.[targetSubjCode];
      return sm && (sm.obtained !== null || sm.isAbsent || sm.nativeMark !== undefined);
    });

    const targetList = subjectStudents.length > 0 ? subjectStudents : gazetteRows;

    // Determine native max / min marks for this subject
    const activeEvalConfig = availableEvaluations.find(e => (e.evalType || e.title) === selectedEvalType);
    const override = getSubjectOverride(activeEvalConfig?.subjectOverrides, targetSubjCode, selectedClass);
    const nativeMax = (override && Number(override.maxMarks) > 0)
      ? Number(override.maxMarks)
      : (targetList[0]?.subjectMarks?.[targetSubjCode]?.nativeMax || subMeta.maxMarks);
    const nativeMin = (override && Number(override.minMarks) > 0)
      ? Number(override.minMarks)
      : (targetList[0]?.subjectMarks?.[targetSubjCode]?.minMarks || subMeta.minMarks || Math.ceil(nativeMax * 0.36));

    const records = targetList.map(row => {
      const sm = row.subjectMarks?.[targetSubjCode];
      let markVal = '';
      if (sm) {
        if (sm.isAbsent) {
          markVal = 'AB';
        } else if (sm.nativeMark !== undefined && sm.nativeMark !== null) {
          markVal = sm.nativeMark;
        } else if (sm.obtained !== null && sm.obtained !== undefined) {
          markVal = sm.obtained;
        }
      }
      return {
        examRollNo: row.examRollNo && row.examRollNo !== '—' ? row.examRollNo : row.rollNo,
        rollNo: row.rollNo,
        regNo: row.regNo,
        name: row.name,
        fatherName: row.fatherName,
        totalMarks: markVal,
        practicalMarks: markVal,
        marks: markVal,
      };
    });

    printIndividualAwardRoll({
      subjectCode: subMeta.code,
      subjectName: subMeta.name,
      className: selectedClass,
      session: selectedSession,
      evaluationType: selectedEvalType,
      records,
      maxMarks: nativeMax,
      minMarks: nativeMin,
    });
  }, [gazetteRows, subjectsList, selectedSubject, selectedClass, selectedSession, selectedEvalType, availableEvaluations]);

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100">
      {/* Dynamic Multi-Page Print Style Sheet */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @page {
          size: landscape;
          margin: 7mm 5mm;
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

      {/* Modern Compact Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs space-y-2 no-print">
        {/* Top Header: Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 flex items-center justify-center font-black flex-shrink-0">
              <Award size={15} />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight m-0 truncate">
              Master Gazette & Tabulation Register
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredRows.length === 0}
              className="h-7.5 px-3 rounded-lg bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Print 15-Subject Landscape Official Gazette"
            >
              <Printer size={13} />
              <span>Print Gazette</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintIndividualAwardRoll(selectedSubject !== 'All' ? selectedSubject : null)}
              disabled={filteredRows.length === 0}
              className="h-7.5 px-3 rounded-lg bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title={selectedSubject !== 'All' ? `Print Official 2-Column Award Roll for ${selectedSubject}` : 'Print Official 2-Column Subject Award Roll'}
            >
              <FileText size={13} />
              <span>{selectedSubject !== 'All' ? `Award Roll (${selectedSubject})` : 'Subject Award'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0}
              className="h-7.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              className="h-7.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              title="Export CSV"
            >
              <Download size={12} />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={refreshPracticalsData}
              disabled={loading}
              className="h-7.5 w-7.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              title="Refresh live data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Unified Single-Row Multi-Filter Bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800">
          {/* Evaluation */}
          <div className="w-48 min-w-[150px] flex-1 sm:flex-initial">
            <select
              value={selectedEvalType}
              onChange={(e) => setSelectedEvalType(e.target.value)}
              className="w-full h-7.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-teal-800 dark:text-teal-300 font-bold focus:outline-none focus:border-teal-600 cursor-pointer truncate"
              title="Evaluation Type"
            >
              <option value="ALL">All Evaluations</option>
              {Array.from(
                new Map(
                  availableEvaluations
                    .filter(ev => Boolean(ev && (ev.evalType || ev.title)))
                    .map(ev => [String(ev.evalType || ev.title).trim().toLowerCase(), ev.evalType || ev.title])
                ).values()
              ).map(evalTypeTitle => (
                <option key={evalTypeTitle} value={evalTypeTitle}>
                  {evalTypeTitle}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div className="w-24">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-7.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600 cursor-pointer"
              title="Class"
            >
              {CLASSES.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>
          </div>

          {/* Session */}
          <div className="w-24">
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full h-7.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600 cursor-pointer"
              title="Academic Session"
            >
              {SESSIONS.map(sess => (
                <option key={sess} value={sess}>{sess}</option>
              ))}
            </select>
          </div>

          {/* Stream */}
          <div className="w-28">
            <select
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
              className="w-full h-7.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-teal-600 cursor-pointer"
              title="Stream"
            >
              {STREAMS.map(str => (
                <option key={str} value={str}>{str === 'All' ? 'All Streams' : str}</option>
              ))}
            </select>
          </div>

          {/* Status / Category */}
          <div className="w-36 min-w-[120px]">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-7.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-indigo-700 dark:text-indigo-400 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer truncate"
              title="Category / Admission Status"
            >
              {STATUS_CATEGORIES.map(st => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>

          {/* Overall Results */}
          <div className="w-28">
            <select
              value={selectedResultFilter}
              onChange={(e) => setSelectedResultFilter(e.target.value)}
              className="w-full h-7.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-emerald-700 dark:text-emerald-400 font-bold focus:outline-none focus:border-teal-600 cursor-pointer"
              title="Overall Candidate Result"
            >
              {RESULT_FILTERS.map(rf => (
                <option key={rf.value} value={rf.value}>{rf.label}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter Dropdown */}
          <div className="w-40 min-w-[130px]">
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                if (e.target.value === 'All') setSelectedSubjectResult('All');
              }}
              className={`w-full h-7.5 px-2 rounded-lg text-xs font-extrabold focus:outline-none cursor-pointer transition-all truncate ${
                selectedSubject !== 'All'
                  ? 'bg-teal-700 text-white border border-teal-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-teal-800 dark:text-teal-300 font-bold'
              }`}
              title="Subject Filter"
            >
              <option value="All" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">All {subjectsList.length} Subjects</option>
              {subjectsList.map(s => (
                <option key={s.code} value={s.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {s.code} — {s.name} (/{s.maxMarks})
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="flex-1 min-w-[150px]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate, roll, reg..."
                className="w-full h-7.5 pl-7 pr-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

            {/* Subject-Specific Result Filter & Quick Action Pills (Visible when a subject is picked) */}
            {selectedSubject !== 'All' && (
              <div className="flex items-center gap-2 flex-wrap animate-fadeIn">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Filter {selectedSubject} Result:</span>
                
                {/* Interactive Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { value: 'All', label: 'All Candidates', count: gazetteRows.length },
                    { value: 'EVALUATED', label: 'Evaluated', count: subjectStats?.appearedCount || 0 },
                    { value: 'PASS', label: 'Passed', count: subjectStats?.passedCount || 0 },
                    { value: 'RE-APPEAR', label: 'Re-Appear', count: subjectStats?.failedCount || 0 },
                    { value: 'ABSENT', label: 'Absent', count: subjectStats?.absentCount || 0 },
                    { value: 'NOT_EVALUATED', label: 'Not Evaluated', count: Math.max(0, gazetteRows.length - (subjectStats?.appearedCount || 0)) },
                  ].map(pill => {
                    const isActive = selectedSubjectResult === pill.value;
                    return (
                      <button
                        key={pill.value}
                        type="button"
                        onClick={() => setSelectedSubjectResult(pill.value)}
                        className={`h-7 px-2 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 border ${
                          isActive
                            ? pill.value === 'PASS'
                              ? 'bg-emerald-700 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-400'
                              : pill.value === 'RE-APPEAR'
                              ? 'bg-rose-700 text-white border-rose-600 shadow-xs ring-1 ring-rose-400'
                              : pill.value === 'ABSENT'
                              ? 'bg-slate-700 text-white border-slate-600 shadow-xs ring-1 ring-slate-400'
                              : 'bg-teal-700 text-white border-teal-600 shadow-xs ring-1 ring-teal-400'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                        title={`Filter to ${pill.label} candidates for ${selectedSubject}`}
                      >
                        <span>{pill.label}</span>
                        <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                          isActive ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {pill.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedSubject('All'); setSelectedSubjectResult('All'); }}
                  className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs border border-slate-200 dark:border-slate-700"
                  title={`Reset subject filter to view full ${subjectsList.length} subjects`}
                >
                  <XCircle size={12} />
                  <span>Show All {subjectsList.length} Subjects</span>
                </button>
              </div>
            )}
          </div>

      {/* KPI Metric Ribbon */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 px-3 flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar no-print shadow-2xs">
        {selectedSubject !== 'All' && subjectStats ? (
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold text-slate-700 dark:text-slate-300 divide-x divide-slate-200 dark:divide-slate-800">
            <div className="flex items-center gap-1.5 whitespace-nowrap bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 px-2.5 py-1 rounded-lg text-teal-900 dark:text-teal-200">
              <Tag size={13} className="text-teal-600 dark:text-teal-400" />
              <span className="font-extrabold text-xs">{subjectStats.name} ({subjectStats.code})</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">Max: {subjectStats.maxMarks}</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedSubjectResult(selectedSubjectResult === 'EVALUATED' ? 'All' : 'EVALUATED')}
              className={`flex items-center gap-1.5 pl-3 pr-2 py-0.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                selectedSubjectResult === 'EVALUATED' ? 'bg-indigo-100 dark:bg-indigo-950/80 ring-2 ring-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Click to filter by Evaluated candidates in this subject"
            >
              <FileText size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Evaluated:</span>
              <span className="font-black text-indigo-700 dark:text-indigo-300">{subjectStats.appearedCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSubjectResult(selectedSubjectResult === 'PASS' ? 'All' : 'PASS')}
              className={`flex items-center gap-1.5 pl-3 pr-2 py-0.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                selectedSubjectResult === 'PASS' ? 'bg-emerald-100 dark:bg-emerald-950/80 ring-2 ring-emerald-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Click to filter by Passed candidates in this subject"
            >
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Passed:</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400">{subjectStats.passedCount}</span>
            </button>

            <div className="flex items-center gap-1.5 pl-3 whitespace-nowrap">
              <TrendingUp size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Pass Rate:</span>
              <span className="font-black text-amber-700 dark:text-amber-300">{subjectStats.passPct}%</span>
            </div>

            <div className="flex items-center gap-1.5 pl-3 whitespace-nowrap">
              <BarChart3 size={14} className="text-teal-600 dark:text-teal-400" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Avg Score:</span>
              <span className="font-black text-teal-700 dark:text-teal-300">{subjectStats.avgScore}/{subjectStats.maxMarks}</span>
            </div>

            {subjectStats.failedCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSubjectResult(selectedSubjectResult === 'RE-APPEAR' ? 'All' : 'RE-APPEAR')}
                className={`flex items-center gap-1.5 pl-3 pr-2 py-0.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  selectedSubjectResult === 'RE-APPEAR' ? 'bg-rose-100 dark:bg-rose-950/80 ring-2 ring-rose-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Click to filter by Re-Appear / Failed candidates in this subject"
              >
                <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Re-Appear:</span>
                <span className="font-black text-rose-700 dark:text-rose-300">{subjectStats.failedCount}</span>
              </button>
            )}

            {subjectStats.absentCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSubjectResult(selectedSubjectResult === 'ABSENT' ? 'All' : 'ABSENT')}
                className={`flex items-center gap-1.5 pl-3 pr-2 py-0.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  selectedSubjectResult === 'ABSENT' ? 'bg-slate-200 dark:bg-slate-800 ring-2 ring-slate-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Click to filter by Absent candidates in this subject"
              >
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Absent:</span>
                <span className="font-black text-slate-700 dark:text-slate-300">{subjectStats.absentCount}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handlePrintIndividualAwardRoll(subjectStats.code)}
              className="flex items-center gap-1.5 ml-3 px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
              title={`Print Official 2-Column Award Roll for ${subjectStats.name}`}
            >
              <Printer size={13} />
              <span>Print {subjectStats.code} Award</span>
            </button>
          </div>
        ) : (
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
        )}
        <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap pl-2 border-l border-slate-100 dark:border-slate-800">
          Showing {filteredRows.length} candidates
        </div>
      </div>

      {/* Official Master Tabulation Register / Gazette Card */}
      <div id="official-gazette-print-area" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Printable Institutional Letterhead */}
        <div className="hidden print:block p-4 pb-2 text-center border-b-2 border-black">
          <h1 className="text-base font-black uppercase tracking-wider text-black m-0">
            Govt. Higher Secondary School Shangus, Anantnag
          </h1>
          <h2 className="text-sm font-extrabold uppercase text-black m-0">
            {selectedSubject !== 'All' ? `Official Tabulation Register & Result Gazette — ${selectedSubjectMeta?.name || selectedSubject}` : 'Official 15-Subject Tabulation Register & Consolidated Result Gazette'}
          </h2>
          <p className="text-xs text-black font-semibold m-0">
            Assessment: <strong>{selectedEvalType}</strong> | Class: <strong>{selectedClass}</strong> | Academic Session: <strong>{selectedSession}</strong> | Status: <strong>{selectedStatus === 'All' ? 'All Categories' : selectedStatus}</strong>{selectedSubject !== 'All' ? <> | Subject: <strong>{selectedSubjectMeta?.name} ({selectedSubject})</strong></> : null} | Date: <strong>{new Date().toLocaleDateString()}</strong>
          </p>
        </div>

        {/* 15-Subject Gazette Table with High-Density Layout */}
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse select-text">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-950 border-b-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="py-2 px-1 text-center w-8">S.No</th>
                <th className="py-2 px-1.5 w-14 min-w-[48px]">Roll No</th>
                <th className="py-2 px-1.5 w-36 min-w-[125px]">REG. NO</th>
                <th className="py-2 px-2 min-w-[140px]">Candidate & Parentage</th>
                <th className="py-2 px-1.5 w-16 min-w-[60px]">Stream</th>

                {/* 15 Separate Subject Columns with Abbreviations Only (Botany & Zoology Separate) */}
                {subjectsList.map(s => {
                  const isSelected = selectedSubject === s.code;
                  return (
                    <th
                      key={s.code}
                      onClick={() => {
                        setSelectedSubject(isSelected ? 'All' : s.code);
                        if (isSelected) setSelectedSubjectResult('All');
                      }}
                      className={`py-1.5 px-1 text-center w-11 min-w-[42px] cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-teal-700 text-white dark:bg-teal-600 ring-2 ring-teal-400 ring-offset-1 shadow-md z-10'
                          : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                      title={`Click to filter by ${s.name} (${s.code}) - Max Marks: ${s.maxMarks}`}
                    >
                      <span className={`block font-mono font-black text-[11px] leading-tight ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                        {s.code}
                      </span>
                      <span className={`text-[8.5px] font-mono leading-none ${isSelected ? 'text-teal-200 font-extrabold' : 'text-slate-400'}`}>
                        /{s.maxMarks}
                      </span>
                    </th>
                  );
                })}

                <th className="py-2 px-1.5 text-center w-14 min-w-[50px]">Total</th>
                <th className="py-2 px-1 text-center w-12 min-w-[44px]">%</th>
                <th className="py-2 px-1.5 text-center w-18 min-w-[70px]">Result</th>
                <th className="py-2 px-1.5 text-center w-20 min-w-[70px]">Grade</th>
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
                    <td className="py-1.5 px-1 text-center text-slate-500 dark:text-slate-400 font-sans text-xs">{idx + 1}</td>
                    <td className="py-1.5 px-1.5 font-mono font-bold text-slate-900 dark:text-white text-xs">{row.rollNo}</td>
                    <td className="py-1.5 px-1.5 font-mono text-[10.5px] w-36 min-w-[125px] select-all">
                      {row.regNo && row.regNo !== '—' ? (
                        <span className="font-bold text-slate-800 dark:text-slate-200 tracking-tight whitespace-nowrap" title={`Board Registration: ${row.regNo}`}>
                          {row.regNo}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 font-sans">
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
                    <td className="py-1.5 px-1.5 font-sans text-xs text-slate-700 dark:text-slate-300 font-medium">{row.stream}</td>

                    {/* 15 Separate Subject Marks Columns */}
                    {subjectsList.map(s => {
                      const isSelected = selectedSubject === s.code;
                      const markObj = row.subjectMarks[s.code];
                      if (!markObj || markObj.obtained === null) {
                        return (
                          <td
                            key={s.code}
                            className={`py-1.5 px-1 text-center font-mono text-xs ${
                              isSelected ? 'bg-teal-50/70 dark:bg-teal-950/40 border-x border-teal-300 dark:border-teal-700 text-slate-400 dark:text-slate-500 font-bold' : 'text-slate-400 dark:text-slate-600'
                            }`}
                            title={`${s.name} (${s.code}): Not Evaluated / Pending`}
                          >
                            —
                          </td>
                        );
                      }

                      if (markObj.isAbsent) {
                        return (
                          <td
                            key={s.code}
                            className={`py-1.5 px-1 text-center text-rose-700 dark:text-rose-400 font-bold text-[10px] font-mono ${
                              isSelected ? 'bg-rose-100/70 dark:bg-rose-950/50 border-x-2 border-rose-400' : ''
                            }`}
                            title={`${s.name} (${s.code}): Absent (AB) — Max: ${s.maxMarks}`}
                          >
                            AB
                          </td>
                        );
                      }

                      const val = markObj.obtained;
                      const isFailed = markObj.isFailed;

                      return (
                        <td
                          key={s.code}
                          className={`py-1.5 px-1 text-center font-mono font-bold text-xs ${
                            isSelected
                              ? isFailed
                                ? 'text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/50 border-x-2 border-rose-400 font-black'
                                : 'text-teal-950 dark:text-teal-100 bg-teal-100/70 dark:bg-teal-950/60 border-x-2 border-teal-400 font-black'
                              : isFailed
                              ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                          title={`${s.name} (${s.code}): ${val}/${s.maxMarks} (${markObj.isPass ? 'Passed' : 'Re-Appear / Failed'})`}
                        >
                          {val}
                        </td>
                      );
                    })}

                    {/* Calculated Grand Total */}
                    <td className="py-1.5 px-1.5 text-center font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {row.totalMax > 0 ? `${row.totalObtained}/${row.totalMax}` : '—'}
                    </td>

                    {/* Calculated Percentage */}
                    <td className="py-1.5 px-1 text-center font-mono font-black text-teal-700 dark:text-teal-300 text-xs">
                      {row.percentage}
                    </td>

                    {/* Calculated Result Status */}
                    <td className="py-1.5 px-1.5 text-center font-sans">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider inline-block ${
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
                    <td className="py-1.5 px-1.5 text-center font-sans text-[11px] font-semibold text-slate-700 dark:text-slate-300">
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
