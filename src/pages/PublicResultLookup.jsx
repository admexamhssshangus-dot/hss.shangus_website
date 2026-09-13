import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, Printer, Award, CheckCircle2, AlertCircle, ArrowLeft,
  RefreshCw, School, BookOpen, ShieldCheck, X, ChevronDown, Check,
  User, Sparkles, Hash, Layers, FileText, CheckCircle, Clock
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { publicLookup } from '../services/backendEndpoint';
import SEO from '../components/SEO';
import { DEFAULT_SCHOOL_EVALUATIONS } from '../utils/practicalsSettingsManager';
import verifiedCatalog from '../data/verifiedStudentsCatalog.json';
import { getCachedCollection, fetchStudentPhotoOnDemand } from '../services/dbCache';
import { identityKey, classKey, sessionKey, formatConsistentName } from '../utils/recordIdentity';

/**
 * Authoritative Standard Curriculum Rosters for Govt. Higher Secondary School Shangus
 */
const STANDARD_STREAM_SUBJECTS = {
  Science: [
    { code: 'EN', name: 'General English', defaultMax: 50 },
    { code: 'PH', name: 'Physics', defaultMax: 50 },
    { code: 'CH', name: 'Chemistry', defaultMax: 50 },
    { code: 'BO', name: 'Botany', defaultMax: 50 },
    { code: 'ZO', name: 'Zoology', defaultMax: 50 },
    { code: 'ES', name: 'Environmental Science', defaultMax: 50 },
  ],
  Humanities: [
    { code: 'EN', name: 'General English', defaultMax: 50 },
    { code: 'PS', name: 'Political Science', defaultMax: 50 },
    { code: 'ED', name: 'Education', defaultMax: 50 },
    { code: 'HT', name: 'History', defaultMax: 50 },
    { code: 'UR', name: 'Urdu', defaultMax: 50 },
    { code: 'ES', name: 'Environmental Science', defaultMax: 50 },
  ],
  Secondary: [
    { code: 'EN', name: 'General English', defaultMax: 50 },
    { code: 'MA', name: 'Mathematics', defaultMax: 50 },
    { code: 'SC', name: 'Science', defaultMax: 50 },
    { code: 'SS', name: 'Social Science', defaultMax: 50 },
    { code: 'UR', name: 'Urdu', defaultMax: 50 },
    { code: 'HTC', name: 'Healthcare', defaultMax: 50 },
    { code: 'ITE', name: 'IT & ITeS', defaultMax: 50 },
  ],
};

/**
 * Authoritative Educational Performance Descriptors (NEP 2020 / Progressive Assessment Standard)
 * Avoids punitive and demoralizing labels like "FAIL" or "RE-APPEAR".
 * Uses growth-oriented achievement descriptors:
 * - Excellent (>= 85%)
 * - Very Good (>= 70%)
 * - Good (>= 50%)
 * - Satisfactory (>= 36% / Passing Criteria)
 * - Needs Improvement (< 36% / Below Minimum)
 */
export const getSubjectPerformanceDescriptor = (marksVal, maxMarks, minMarks, isAbsent) => {
  if (isAbsent) {
    return {
      status: 'Absent',
      tone: 'neutral',
      isPass: false,
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
    };
  }
  if (typeof marksVal !== 'number' || isNaN(marksVal)) {
    return {
      status: 'Awaiting Award',
      tone: 'neutral',
      isPass: false,
      badgeClass: 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700'
    };
  }

  const max = Number(maxMarks) || 50;
  const min = Number(minMarks) || Math.ceil(max * 0.36);
  const isPass = marksVal >= min;
  const pct = max > 0 ? (marksVal / max) * 100 : 0;

  if (!isPass) {
    return {
      status: 'Needs Improvement',
      shortStatus: 'Improve',
      tone: 'improve',
      isPass: false,
      badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
    };
  }

  if (pct >= 85) {
    return {
      status: 'Excellent',
      shortStatus: 'Excellent',
      tone: 'excellent',
      isPass: true,
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
    };
  }

  if (pct >= 70) {
    return {
      status: 'Very Good',
      shortStatus: 'Very Good',
      tone: 'veryGood',
      isPass: true,
      badgeClass: 'bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
    };
  }

  if (pct >= 50) {
    return {
      status: 'Good',
      shortStatus: 'Good',
      tone: 'good',
      isPass: true,
      badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
    };
  }

  return {
    status: 'Satisfactory',
    shortStatus: 'Satisfactory',
    tone: 'satisfactory',
    isPass: true,
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
  };
};

export const getOverallResultDescriptor = (evaluatedCount, totalCount, totalObtained, totalMax, hasFail, allAbsent) => {
  if (evaluatedCount === 0) {
    return {
      resultStatus: 'AWAITING AWARD',
      division: 'Evaluation Pending',
      badgeClass: 'bg-slate-600 text-white'
    };
  }

  if (allAbsent) {
    return {
      resultStatus: 'ABSENT',
      division: 'Absent',
      badgeClass: 'bg-slate-600 text-white'
    };
  }

  const isPartial = evaluatedCount < totalCount;
  const pct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : '0.0';
  const nPct = Number(pct);

  if (isPartial) {
    return {
      resultStatus: 'IN PROGRESS',
      division: `In Progress (${evaluatedCount}/${totalCount} Tabulated)`,
      badgeClass: 'bg-teal-700 text-white'
    };
  }

  // All subjects have been evaluated
  if (hasFail) {
    return {
      resultStatus: 'NEEDS IMPROVEMENT',
      division: 'Scope for Improvement',
      badgeClass: 'bg-amber-600 text-white'
    };
  }

  if (nPct >= 85) {
    return {
      resultStatus: 'EXCELLENT',
      division: 'Distinction (Outstanding)',
      badgeClass: 'bg-emerald-700 text-white'
    };
  }
  if (nPct >= 70) {
    return {
      resultStatus: 'VERY GOOD',
      division: 'First Division (Very Good)',
      badgeClass: 'bg-teal-700 text-white'
    };
  }
  if (nPct >= 50) {
    return {
      resultStatus: 'GOOD',
      division: 'Second Division (Good)',
      badgeClass: 'bg-sky-700 text-white'
    };
  }
  return {
    resultStatus: 'SATISFACTORY',
    division: 'Third Division (Satisfactory)',
    badgeClass: 'bg-emerald-600 text-white'
  };
};

export default function PublicResultLookup() {
  const [searchParams] = useSearchParams();
  const initialReg = searchParams.get('reg') || searchParams.get('roll') || searchParams.get('fno') || '';
  const initialClass = searchParams.get('class') || '11th';
  const initialSession = searchParams.get('session') || '2025-26';

  const [queryInput, setQueryInput] = useState(initialReg);
  const [queryDob, setQueryDob] = useState('');
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [selectedSession, setSelectedSession] = useState(initialSession);
  const [selectedEvalType, setSelectedEvalType] = useState('Pre-Board Test');

  const [evalOptions, setEvalOptions] = useState([]);
  const [availableSessions, setAvailableSessions] = useState(['2025-26', '2024-25', '2023-24']);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [studentResult, setStudentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSearchExpandedOnMobile, setIsSearchExpandedOnMobile] = useState(false);

  // 0. Set clean-print-mode on body to prevent global duplicate print headers
  useEffect(() => {
    document.body.classList.add('clean-print-mode');
    return () => {
      document.body.classList.remove('clean-print-mode');
    };
  }, []);

  // 1. Resilient School Assessment Configuration Loading
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const { evaluations } = await publicLookup('public-result', { action: 'config' });
        if (!isMounted) return;
        if (Array.isArray(evaluations) && evaluations.length > 0) {
          setEvalOptions(evaluations);
          const sessions = [...new Set(evaluations.map(item => item.session))].filter(Boolean);
          if (sessions.length) setAvailableSessions(sessions);
          if (evaluations[0]) {
            setSelectedEvalType(evaluations[0].evalType || evaluations[0].title);
            if (evaluations[0].session) setSelectedSession(evaluations[0].session);
          }
          return;
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'test') {
          console.warn('Serverless assessment config unavailable, using school defaults:', e);
          if (isMounted) setErrorMsg(e.message || 'Assessment service unavailable.');
          return;
        }
      }

      // Fallback to active evaluations preset (Pre-Board Test, Internal, External)
      if (!isMounted) return;
      const fallbackEvals = DEFAULT_SCHOOL_EVALUATIONS.map(ev => ({
        id: ev.id,
        title: ev.title,
        evalType: ev.evalType,
        session: ev.session || '2025-26',
        classes: ev.classes || ['10th', '11th', '12th']
      }));
      setEvalOptions(fallbackEvals);
      setAvailableSessions(['2025-26', '2024-25', '2023-24']);
      if (fallbackEvals[0]) {
        setSelectedEvalType(fallbackEvals[0].evalType || fallbackEvals[0].title);
      }
    }

    loadConfig().finally(() => {
      if (isMounted) setLoadingConfig(false);
    });

    return () => { isMounted = false; };
  }, []);

  // 2. Comprehensive Search & Tabulation Flow
  const handleLookup = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const rawQuery = (queryInput || '').trim();
    if (!rawQuery) {
      setErrorMsg('Please enter your Roll Number, Registration Number, or Form Number.');
      return;
    }

    setSearching(true);
    setSearchAttempted(true);
    setErrorMsg('');
    setStudentResult(null);

    const cleanQuery = rawQuery.replace(/[^a-zA-Z0-9/_-]/g, '').trim();
    const isRollQuery = /^\d{1,3}$/.test(cleanQuery);

    // Anti-scraping guard: Require Date of Birth when querying short class roll numbers (up to 3 digits)
    if (isRollQuery && (!queryDob || !queryDob.trim())) {
      setErrorMsg('Date of Birth (DOB) is required when searching by Class Roll No to safeguard student privacy and prevent sequential lookups.');
      setSearching(false);
      return;
    }

    // ── Tier 1: Try Serverless Backend Lookup ──
    try {
      const response = await publicLookup('public-result', {
        query: cleanQuery,
        dob: queryDob,
        className: selectedClass,
        session: selectedSession,
        evaluation: selectedEvalType
      });
      if (response && response.result) {
        const res = response.result;
        const pUrl = (res.photoUrl || '');
        const cleanPhoto = (pUrl.includes('drive.google.com') || pUrl.includes('googleusercontent.com') || pUrl.includes('docs.google.com')) ? '' : pUrl;
        
        // Normalize subjects and overall status to encouraging, modern labels
        const rawSubs = Array.isArray(res.subjects) ? res.subjects : [];
        const sanitizedSubjects = rawSubs.map(sub => {
          const desc = getSubjectPerformanceDescriptor(sub.marksObtained, sub.maxMarks, sub.minMarks, sub.isAbsent);
          return {
            ...sub,
            status: desc.status,
            statusTone: desc.tone,
            badgeClass: desc.badgeClass,
            isPass: desc.isPass
          };
        });

        const evCount = res.evaluatedCount ?? sanitizedSubjects.filter(s => s.isEvaluated).length;
        const totCount = res.totalCount ?? (sanitizedSubjects.length || 6);
        const anyFail = sanitizedSubjects.some(s => s.isEvaluated && !s.isPass && !s.isAbsent);
        const allAb = sanitizedSubjects.length > 0 && sanitizedSubjects.every(s => s.isAbsent);
        const overall = getOverallResultDescriptor(evCount, totCount, res.totalObtained, res.totalMax, anyFail, allAb);

        setStudentResult({
          ...res,
          name: formatConsistentName(res.name || res.studentName),
          fatherName: formatConsistentName(res.fatherName || res.parentage),
          photoUrl: cleanPhoto,
          subjects: sanitizedSubjects.length > 0 ? sanitizedSubjects : res.subjects,
          resultStatus: overall.resultStatus,
          division: overall.division
        });
        setIsSearchExpandedOnMobile(false);
        setSearching(false);
        return;
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'test') {
        console.warn('Serverless result lookup unavailable, trying verified student catalog fallback:', err);
      }
    }

    // ── Tier 2: Resilient Client Fallback using Verified Catalog & Practical Data ──
    try {
      const normQ = cleanQuery.toLowerCase();
      const normClass = String(selectedClass || '').toLowerCase().replace(/class/i, '').trim();

      let matchedStudent = null;
      if (Array.isArray(verifiedCatalog)) {
        const cleanDigitsOnly = normQ.replace(/\D/g, '');
        const targetClsKey = classKey(selectedClass);

        // Helper to select match, prioritizing candidates in the selected class
        const candidateMatches = (predicate) => {
          const all = verifiedCatalog.filter(predicate);
          if (all.length === 0) return null;
          const inClass = all.find(s => classKey(s.className) === targetClsKey);
          return inClass || all[0];
        };

        // Match 1: Form Number (e.g. 250001, 250027, 250199, 6084)
        matchedStudent = candidateMatches(s => {
          const f = String(s.fNo || '').trim().toLowerCase();
          return f && f === normQ;
        });

        // Match 2: Board Registration Number (100% authoritative exact / alphanumeric)
        if (!matchedStudent) {
          matchedStudent = candidateMatches(s => {
            const r = String(s.boardRegNo || '').trim().toLowerCase();
            if (!r) return false;
            const rClean = r.replace(/[^a-z0-9]/g, '');
            const qClean = normQ.replace(/[^a-z0-9]/g, '');
            return r === normQ || rClean === qClean;
          });
        }

        // Match 3: Class Roll Number or Board Exam Roll Number
        if (!matchedStudent) {
          matchedStudent = candidateMatches(s => {
            const roll = String(s.classRollNo || '').trim().toLowerCase();
            const examRoll = String(s.examRollNo || '').trim().toLowerCase();
            return (roll && roll === normQ) || (examRoll && examRoll === normQ);
          });
        }

        // Match 4: Robust Registration Suffix or JKBOSE Reg Typo/Fuzzy Match (e.g. '2501010000610001' vs '2501100020610001' or suffix '610001')
        if (!matchedStudent && cleanDigitsOnly.length >= 6) {
          matchedStudent = candidateMatches(s => {
            const rDigits = String(s.boardRegNo || '').replace(/\D/g, '');
            if (!rDigits || rDigits.length < 6) return false;
            // Query is suffix of registration, or registration ends with query
            if (rDigits.endsWith(cleanDigitsOnly) || cleanDigitsOnly.endsWith(rDigits.slice(-6))) {
              return !targetClsKey || classKey(s.className) === targetClsKey;
            }
            // 14-16 digit JKBOSE pattern: matching session prefix (first 4) & roll suffix (last 6)
            if (rDigits.length >= 12 && cleanDigitsOnly.length >= 12) {
              const prefixMatch = rDigits.slice(0, 4) === cleanDigitsOnly.slice(0, 4);
              const suffixMatch = rDigits.slice(-6) === cleanDigitsOnly.slice(-6);
              return prefixMatch && suffixMatch && (!targetClsKey || classKey(s.className) === targetClsKey);
            }
            return false;
          });
        }
      }

      if (matchedStudent) {
        // Anti-scraping verification: verify DOB if queried via Class Roll No
        if (isRollQuery && matchedStudent.dob) {
          const isDobMatching = (recordDob, userDob) => {
            if (!recordDob || !userDob) return true;
            const cleanR = String(recordDob).trim().toLowerCase();
            const cleanU = String(userDob).trim().toLowerCase();
            if (cleanR === cleanU) return true;

            const rParts = cleanR.split(/[-/.]/);
            const uParts = cleanU.split(/[-/.]/);
            if (rParts.length === 3 && uParts.length === 3) {
              const rYear = rParts.find(p => p.length === 4);
              const uYear = uParts.find(p => p.length === 4);
              if (rYear && uYear && rYear === uYear) {
                const rOther = rParts.filter(p => p !== rYear).map(Number).sort((a, b) => a - b);
                const uOther = uParts.filter(p => p !== uYear).map(Number).sort((a, b) => a - b);
                if (rOther[0] === uOther[0] && rOther[1] === uOther[1]) return true;
              }
            }
            return false;
          };

          if (!isDobMatching(matchedStudent.dob, queryDob)) {
            setErrorMsg('The Roll Number and Date of Birth combination do not match school records. Please check your credentials.');
            setStudentResult(null);
            setSearching(false);
            return;
          }
        }

        // Determine stream and curriculum template - prefer student's enrolled subjects
        const isHigherSec = selectedClass === '11th' || selectedClass === '12th';
        const rawStream = String(matchedStudent.stream || '').toLowerCase();
        const streamName = isHigherSec
          ? (rawStream.includes('scien') ? 'Science' : 'Humanities')
          : 'General';

        const templateRoster = (Array.isArray(matchedStudent.subjects) && matchedStudent.subjects.length > 0)
          ? matchedStudent.subjects.map(s => ({
              code: s.code,
              name: s.name,
              defaultMax: s.defaultMax || 50
            }))
          : isHigherSec
            ? (streamName === 'Science' ? STANDARD_STREAM_SUBJECTS.Science : STANDARD_STREAM_SUBJECTS.Humanities)
            : STANDARD_STREAM_SUBJECTS.Secondary;

        // Fetch fresh practicals data from Firestore (falling back to cache on error)
        let practicalDocs = [];
        try {
          const snap = await getDocs(collection(db, 'practicalsData'));
          practicalDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (pErr) {
          const cached = await getCachedCollection('practicalsData', false, 10 * 60 * 1000).catch(() => []);
          practicalDocs = cached || [];
        }

        // Identify matching teacher submission sections
        const targetClass = classKey(selectedClass);
        const targetSession = sessionKey(selectedSession);
        const targetEval = identityKey(selectedEvalType);

        const matchingSections = practicalDocs.filter(sec => {
          if (!Array.isArray(sec.records) || sec.records.length === 0) return false;
          const docCls = classKey(sec.className || sec.class || sec.selectedClass || sec.docId || '');
          if (docCls !== targetClass) return false;

          const rawSess = sec.sessionCanonical || sec.yearSuffix || sec.session || sec.Session || sec.docId || '';
          const docSess = sessionKey(rawSess);
          const isSessionMatched = !selectedSession || selectedSession === 'All' ||
            docSess === targetSession ||
            (targetSession === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26'))) ||
            (targetSession === '2024-25' && (docSess === '2025' || String(rawSess).includes('2025') || String(rawSess).includes('2024-25')));
          if (!isSessionMatched) return false;

          if (selectedEvalType && selectedEvalType !== 'ALL') {
            const docEval = identityKey(sec.practicalType || sec.evaluationType || sec.examTitle || sec.type || sec.docId || '');
            const isEvalMatched = docEval === targetEval ||
              docEval.includes(targetEval) || targetEval.includes(docEval) ||
              (targetEval.includes('preboard') && docEval.includes('preboard')) ||
              (targetEval.includes('internal') && docEval.includes('internal')) ||
              (targetEval.includes('external') && docEval.includes('external'));
            if (!isEvalMatched) return false;
          }
          return true;
        });

        // Multi-tier student record matcher against a teacher's section sheet
        const matchRecord = (rec) => {
          if (!rec) return false;
          const rReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
          const sReg = identityKey(matchedStudent.boardRegNo);
          if (rReg && sReg && (rReg === sReg || (rReg.length >= 6 && sReg.length >= 6 && (rReg.endsWith(sReg.slice(-6)) || sReg.endsWith(rReg.slice(-6)))))) return true;

          const rForm = identityKey(rec.formNo || rec.fNo || rec.id);
          const sForm = identityKey(matchedStudent.fNo);
          if (rForm && sForm && rForm === sForm) return true;

          const rRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
          const sRoll = identityKey(matchedStudent.classRollNo);
          const sExamRoll = identityKey(matchedStudent.examRollNo);
          if (rRoll && sRoll && rRoll === sRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a') return true;
          if (rRoll && sExamRoll && rRoll === sExamRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a') return true;

          const rName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const sName = String(matchedStudent.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          if (rName && sName && rName.length > 3 && (rName === sName || rName.includes(sName) || sName.includes(rName))) return true;

          return false;
        };

        // Build the complete student subject roster with placeholders for pending subjects
        const finalSubjectsList = [];
        const matchedSectionIds = new Set();

        templateRoster.forEach(tpl => {
          let foundRec = null;
          let foundSec = null;
          let isFromBiology = false;

          // 1. Direct match by subject code or subject name
          for (const sec of matchingSections) {
            const c = (sec.subjectCode || '').toUpperCase().trim();
            const n = String(sec.subjectName || sec.subject || '').toLowerCase();
            const isMatch = c === tpl.code || n === tpl.name.toLowerCase() ||
              (tpl.code === 'EN' && (c === 'GE' || n.includes('english'))) ||
              (tpl.code === 'PH' && (c === 'PHY' || n.includes('physics'))) ||
              (tpl.code === 'CH' && (c === 'CHEM' || n.includes('chemistry'))) ||
              (tpl.code === 'BO' && (c === 'BO' || n.includes('botany'))) ||
              (tpl.code === 'ZO' && (c === 'ZO' || n.includes('zoology'))) ||
              (tpl.code === 'MA' && (c === 'MATH' || c === 'MATHS' || n.includes('mathematics') || n.includes('math'))) ||
              (tpl.code === 'SC' && (c === 'SC' || c === 'SCI' || c === 'SCIENCE' || (n.includes('science') && !n.includes('social') && !n.includes('pol') && !n.includes('environmental') && !n.includes('computer')))) ||
              (tpl.code === 'SS' && (c === 'SS' || c === 'SST' || c === 'SOC' || n.includes('social science') || n.includes('social studies') || n === 'sst')) ||
              (tpl.code === 'ES' && (c === 'EVS' || n.includes('environmental') || n.includes('env'))) ||
              (tpl.code === 'PS' && (c === 'POL' || n.includes('political'))) ||
              (tpl.code === 'HT' && (c === 'HIST' || n.includes('history'))) ||
              (tpl.code === 'ED' && (c === 'EDU' || n.includes('education'))) ||
              (tpl.code === 'UR' && (c === 'UR' || n.includes('urdu'))) ||
              (tpl.code === 'HTC' && (c === 'HTC' || c === 'HC' || (c === 'HT' && n.includes('health')) || n.includes('healthcare') || n.includes('health care'))) ||
              (tpl.code === 'ITE' && (c === 'ITE' || c === 'IT' || c === 'CS' || c === 'IP' || n.includes('ites') || n.includes('information') || n.includes('it & ites') || n.includes('it and ites')));

            if (isMatch) {
              const rec = (sec.records || []).find(matchRecord);
              if (rec) {
                foundRec = rec;
                foundSec = sec;
                matchedSectionIds.add(sec.id || sec.docId);
                break;
              }
            }
          }

          // 2. Botany & Zoology fallback from Biology (BI)
          if (!foundRec && (tpl.code === 'BO' || tpl.code === 'ZO')) {
            for (const sec of matchingSections) {
              const c = (sec.subjectCode || '').toUpperCase().trim();
              const n = String(sec.subjectName || sec.subject || '').toLowerCase();
              if (c === 'BI' || n.includes('biology')) {
                const rec = (sec.records || []).find(matchRecord);
                if (rec) {
                  foundRec = rec;
                  foundSec = sec;
                  isFromBiology = true;
                  matchedSectionIds.add(sec.id || sec.docId);
                  break;
                }
              }
            }
          }

          if (foundRec && foundSec) {
            const rawMark = foundRec.totalMarks ?? foundRec.practicalMarks;
            const isAbsent = /^(a|ab|absent)$/i.test(String(rawMark).trim());
            const num = Number(rawMark);
            const docMax = Number(foundSec.maxMarks) || tpl.defaultMax;
            const maxMarks = isFromBiology ? Math.round(docMax / 2) : docMax;
            const minMarks = Math.ceil(maxMarks * 0.36);
            const marksVal = isAbsent ? 'AB' : (isFromBiology ? Math.round(num / 2) : num);
            const desc = getSubjectPerformanceDescriptor(marksVal, maxMarks, minMarks, isAbsent);

            finalSubjectsList.push({
              subjectCode: tpl.code,
              subjectName: tpl.name,
              maxMarks,
              minMarks,
              marksObtained: isAbsent ? 'AB' : marksVal,
              isAbsent,
              isPass: desc.isPass,
              isEvaluated: true,
              status: desc.status,
              statusTone: desc.tone,
              badgeClass: desc.badgeClass
            });
          } else {
            // Subject has not been evaluated yet -> Place holder entry!
            finalSubjectsList.push({
              subjectCode: tpl.code,
              subjectName: tpl.name,
              maxMarks: tpl.defaultMax,
              minMarks: Math.ceil(tpl.defaultMax * 0.36),
              marksObtained: '—',
              isAbsent: false,
              isPass: false,
              isEvaluated: false,
              status: 'Awaiting Award',
              statusTone: 'neutral',
              badgeClass: 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700'
            });
          }
        });

        // 3. Append any additional evaluated subjects found in sections (e.g. Healthcare, IT & ITeS, Math, etc.)
        matchingSections.forEach(sec => {
          if (!matchedSectionIds.has(sec.id || sec.docId)) {
            const rec = (sec.records || []).find(matchRecord);
            if (rec) {
              const rawMark = rec.totalMarks ?? rec.practicalMarks;
              const isAbsent = /^(a|ab|absent)$/i.test(String(rawMark).trim());
              const num = Number(rawMark);
              const maxMarks = Number(sec.maxMarks) || 50;
              const minMarks = Number(sec.minMarks) || Math.ceil(maxMarks * 0.36);
              const marksVal = isAbsent ? 'AB' : num;
              const desc = getSubjectPerformanceDescriptor(marksVal, maxMarks, minMarks, isAbsent);

              finalSubjectsList.push({
                subjectCode: (sec.subjectCode || 'ELEC').toUpperCase(),
                subjectName: sec.subjectName || sec.subject || 'Elective Subject',
                maxMarks,
                minMarks,
                marksObtained: isAbsent ? 'AB' : marksVal,
                isAbsent,
                isPass: desc.isPass,
                isEvaluated: true,
                status: desc.status,
                statusTone: desc.tone,
                badgeClass: desc.badgeClass
              });
            }
          }
        });

        // 4. Calculate Grand Totals and Award Roll Status
        const evaluatedSubjects = finalSubjectsList.filter(s => s.isEvaluated);
        const evaluatedCount = evaluatedSubjects.length;
        const totalCount = finalSubjectsList.length;
        const totalObtained = evaluatedSubjects.reduce((acc, s) => acc + (typeof s.marksObtained === 'number' ? s.marksObtained : 0), 0);
        const totalMax = evaluatedSubjects.reduce((acc, s) => acc + s.maxMarks, 0);
        const hasMarks = evaluatedCount > 0;
        const pct = hasMarks && totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : null;

        const allAbsent = hasMarks && evaluatedSubjects.every(s => s.isAbsent);
        const hasFail = hasMarks && evaluatedSubjects.some(s => !s.isPass && !s.isAbsent);
        const overall = getOverallResultDescriptor(evaluatedCount, totalCount, totalObtained, totalMax, hasFail, allAbsent);
        const resultStatus = overall.resultStatus;
        const division = overall.division;

        let firebasePhoto = '';
        try {
          const fetched = await fetchStudentPhotoOnDemand(matchedStudent);
          if (fetched && !fetched.includes('drive.google.com') && !fetched.includes('googleusercontent.com') && !fetched.includes('docs.google.com')) {
            firebasePhoto = fetched;
          }
        } catch (_) {}

        setStudentResult({
          name: formatConsistentName(matchedStudent.name || 'Student Candidate'),
          fatherName: formatConsistentName(matchedStudent.fatherName || '—'),
          className: matchedStudent.className || selectedClass,
          classRollNo: matchedStudent.classRollNo || '—',
          boardRegNo: matchedStudent.boardRegNo || '—',
          formNo: matchedStudent.fNo || '—',
          stream: streamName,
          session: matchedStudent.session || selectedSession,
          photoUrl: firebasePhoto,
          evalTitle: selectedEvalType,
          subjects: finalSubjectsList,
          evaluatedCount,
          totalCount,
          hasMarks,
          totalObtained,
          totalMax,
          percentage: pct !== null ? `${pct}%` : '—',
          division,
          resultStatus,
          verifiedFromCatalog: true
        });
        setIsSearchExpandedOnMobile(false);
        return;
      }

      // Neither serverless nor catalog matched
      setErrorMsg(`No candidate record found for "${cleanQuery}" in Class ${selectedClass} (${selectedSession}). Please check your Roll Number, Registration Number, or Form Number.`);
    } catch (fallbackErr) {
      console.error('Error during fallback lookup:', fallbackErr);
      setErrorMsg('Unable to retrieve results. Please verify your details and try again.');
    } finally {
      setSearching(false);
    }
  }, [queryInput, queryDob, selectedClass, selectedSession, selectedEvalType]);

  // Check if current query resembles a short sequential Class Roll No (1 to 3 digits)
  const isShortRollQuery = /^\d{1,3}$/.test((queryInput || '').trim());

  // Automatic lookup if params provided in URL
  const automaticLookupStarted = useRef(false);
  useEffect(() => {
    if (initialReg && !loadingConfig && !automaticLookupStarted.current && evalOptions.length) {
      automaticLookupStarted.current = true;
      handleLookup();
    }
  }, [initialReg, loadingConfig, handleLookup, evalOptions.length]);

  return (
    <div className="min-h-screen print:min-h-0 print:h-auto print:p-0 print:m-0 print:bg-white bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-3 sm:py-6 px-3 sm:px-6">
      <SEO
        title="Student Examination Results | Govt. HSS Shangus"
        description="Official online student evaluation and examination results scorecard portal for Govt. Higher Secondary School Shangus."
      />

      {/* Clean, Minimal & Modern Print Style Sheet */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @page {
          size: portrait;
          margin: 6mm 8mm 6mm 8mm;
        }
        @media print {
          /* 1. Global Document & Layout Reset */
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            font-size: 9pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
          }

          /* Force all React ancestor wrappers to collapse heights and padding to zero in print */
          #root,
          #root > div,
          main,
          #main-content,
          .min-h-screen {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            display: block !important;
            overflow: visible !important;
          }

          /* Remove all decorative pseudo-elements & accessibility skip links */
          body::before, body::after, html::before, html::after, .ui-skip-link {
            display: none !important;
            content: none !important;
            height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            visibility: hidden !important;
          }

          /* Suppress all non-printable chrome */
          header, nav, footer, .site-footer, .print\\:hidden, #nprogress, .no-print {
            display: none !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: hidden !important;
          }

          /* Scorecard 1-Page Constraint & Clean Crisp White Layout */
          #official-scorecard-print {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 6px !important;
            box-shadow: none !important;
            padding: 8px 12px !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            overflow: hidden !important;
          }

          /* Prevent table rows and summaries from splitting across pages */
          #official-scorecard-print table,
          #official-scorecard-print tr,
          #official-scorecard-print tbody,
          #official-scorecard-print tfoot {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Strip all background fills/shades in print so that no shade boxes bleed */
          #official-scorecard-print,
          #official-scorecard-print div,
          #official-scorecard-print table,
          #official-scorecard-print thead,
          #official-scorecard-print tbody,
          #official-scorecard-print tfoot,
          #official-scorecard-print tr,
          #official-scorecard-print th,
          #official-scorecard-print td {
            background: transparent !important;
            background-color: transparent !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />

      <div className="max-w-3xl mx-auto space-y-2.5 print:max-w-none print:w-full print:space-y-0 print:m-0 print:p-0">
        {/* Minimal Navigation & Verification Indicator (Desktop & Tablet only to maximize mobile viewport) */}
        <div className="hidden sm:flex items-center justify-between gap-2 print:hidden pb-0.5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>School Home</span>
          </Link>

          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 flex items-center gap-1">
            <ShieldCheck size={11} className="text-teal-600 dark:text-teal-400" />
            <span>Examination Results Portal • Session {selectedSession}</span>
          </span>
        </div>

        {/* Collapsed Search Bar on Mobile when Result is Displayed */}
        {studentResult && !isSearchExpandedOnMobile && (
          <div className="sm:hidden flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs print:hidden">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/80 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                <Search size={11} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate">
                  Class {selectedClass} • Roll {queryInput}
                </p>
                <p className="text-[9.5px] text-slate-400 leading-tight truncate">
                  {selectedEvalType} • {selectedSession}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSearchExpandedOnMobile(true)}
              className="px-2.5 py-1 text-[10.5px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded-lg border border-teal-200 dark:border-teal-800 shrink-0 cursor-pointer transition-colors flex items-center gap-1"
            >
              <RefreshCw size={10.5} />
              <span>Search Again</span>
            </button>
          </div>
        )}

        {/* Unified Responsive Search Form */}
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 sm:p-2.5 shadow-2xs space-y-1.5 print:hidden ${
          studentResult && !isSearchExpandedOnMobile ? 'hidden sm:block' : 'block'
        }`}>
          {studentResult && isSearchExpandedOnMobile && (
            <div className="sm:hidden flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800 text-[10.5px]">
              <span className="font-bold text-slate-500">Modify Search</span>
              <button
                type="button"
                onClick={() => setIsSearchExpandedOnMobile(false)}
                className="font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <X size={11} /> Close
              </button>
            </div>
          )}
          <form onSubmit={handleLookup} className="flex flex-col gap-1.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Roll No (e.g. 101), Reg No, or Form No..."
                  className="w-full h-8 pl-7 pr-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
                />
                {queryInput && (
                  <button
                    type="button"
                    onClick={() => setQueryInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Class Dropdown */}
              <div className="w-full sm:w-28">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  aria-label="Select Class"
                  className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-600 cursor-pointer"
                >
                  <option value="11th">Class 11th</option>
                  <option value="12th">Class 12th</option>
                  <option value="10th">Class 10th</option>
                  <option value="9th">Class 9th</option>
                </select>
              </div>

              {/* Evaluation Dropdown */}
              <div className="w-full sm:w-36">
                <select
                  value={selectedEvalType}
                  onChange={(e) => setSelectedEvalType(e.target.value)}
                  aria-label="Evaluation"
                  className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-600 truncate cursor-pointer"
                >
                  {evalOptions.map(ev => (
                    <option key={ev.id || ev.evalType} value={ev.evalType || ev.title}>
                      {ev.evalType || ev.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Session Dropdown */}
              <div className="w-full sm:w-28">
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  aria-label="Academic Session"
                  className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-600 cursor-pointer"
                >
                  {availableSessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={searching || loadingConfig || (!evalOptions.length && process.env.NODE_ENV === 'test')}
                className="h-8 px-3.5 rounded-lg bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                {searching ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search size={12} />
                    <span>Search Result</span>
                  </>
                )}
              </button>
            </div>

            {/* Dynamic DOB Security Verification for Class Roll Numbers */}
            {isShortRollQuery && (
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs animate-fadeIn">
                <div className="flex items-center gap-1 font-bold text-amber-900 dark:text-amber-200 shrink-0 text-[11px]">
                  <ShieldCheck size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>DOB:</span>
                </div>
                <input
                  type="date"
                  required
                  value={queryDob}
                  onChange={(e) => setQueryDob(e.target.value)}
                  aria-label="Student Date of Birth"
                  className="h-7 px-2 text-xs font-mono font-bold rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-amber-600 cursor-pointer"
                />
              </div>
            )}
          </form>

          {errorMsg && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-start gap-1.5 animate-fadeIn">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Minimal, Clean and Modern Official Scorecard */}
        {studentResult && (
          <div
            id="official-scorecard-print"
            className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg sm:rounded-xl p-2.5 sm:p-5 print:p-2.5 shadow-xs space-y-2 sm:space-y-3 print:space-y-1.5 animate-fadeIn print:border-slate-300 print:bg-white print:rounded-md"
          >
            {/* Action Bar (Hidden on Print) */}
            <div className="relative z-10 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 print:hidden">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[9px] sm:text-[9.5px] font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={10} />
                <span>Verified Record</span>
              </span>

              <button
                type="button"
                onClick={() => window.print()}
                className="h-6 sm:h-7 px-2.5 sm:px-3 rounded-lg bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white font-bold text-[10.5px] sm:text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                title="Print Clean 1-Page Scorecard"
              >
                <Printer size={11} />
                <span>Print / Save PDF</span>
              </button>
            </div>

            {/* Institutional Header: Full on Desktop & Print, Minimal on Mobile Screen */}
            <div className="relative z-10 text-center pb-1.5 sm:pb-2 border-b border-slate-200 dark:border-slate-800 print:border-slate-300 print:pb-1">
              <img
                src="/logo192.png"
                alt="School Crest"
                className="hidden sm:block print:block w-10 h-10 sm:w-11 sm:h-11 mx-auto mb-1 object-contain opacity-75 print:opacity-80 filter contrast-110"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <p className="hidden sm:block print:block text-[11px] font-bold tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase m-0">
                Govt. Higher Secondary School Shangus
              </p>
              <h2 className="text-xs sm:text-base font-black uppercase tracking-tight text-slate-900 dark:text-white print:text-black m-0 leading-tight">
                Student Evaluation Scorecard
              </h2>
              <p className="text-[10px] sm:text-[10.5px] font-medium text-slate-500 dark:text-slate-400 print:text-slate-600 m-0 mt-0.5">
                <strong className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{studentResult.evalTitle}</strong>
                <span className="mx-1 opacity-40">•</span>
                <span>Session {studentResult.session}</span>
                <span className="mx-1 opacity-40">•</span>
                <span>Class {studentResult.className}</span>
              </p>
            </div>

            {/* Candidate Identity Profile Box */}
            <div className="relative z-10 flex items-stretch gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 print:border-slate-300 print:bg-transparent print:p-2">
              {/* Photo Box: Compact on mobile screen, standard on desktop & print */}
              <div className="w-11 h-14 sm:w-16 sm:h-20 rounded-md sm:rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center print:border-slate-400 print:bg-transparent shadow-2xs">
                {studentResult.photoUrl && !studentResult.photoUrl.includes('drive.google.com') && !studentResult.photoUrl.includes('googleusercontent.com') ? (
                  <img
                    src={studentResult.photoUrl}
                    alt={studentResult.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 print:text-slate-500">
                    <User size={18} className="sm:w-[22px] sm:h-[22px]" />
                    <span className="text-[7.5px] sm:text-[8px] uppercase tracking-wider font-semibold mt-0.5">Photo</span>
                  </div>
                )}
              </div>

              {/* Candidate Info Grid */}
              <div className="min-w-0 flex-1 flex flex-col justify-between">
                {/* Top Row: Candidate Name & Stream */}
                <div>
                  <span className="text-[8.5px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider block">
                    Candidate Name
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.2">
                    <span className="text-xs sm:text-base font-black text-slate-900 dark:text-white print:text-black leading-tight">
                      {studentResult.name}
                    </span>
                    <span className="text-[8.5px] sm:text-[9px] font-black px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 uppercase border border-teal-200/80 dark:border-teal-800/80 print:border-slate-400 print:text-slate-800 print:bg-transparent">
                      {studentResult.stream || 'General'}
                    </span>
                  </div>
                </div>

                {/* Mobile-Only Compact Roll Info Row (Saves ~90px of vertical space on mobile) */}
                <div className="sm:hidden flex items-center justify-between text-[10px] font-mono pt-1 text-slate-700 dark:text-slate-300">
                  <span>Roll: <strong className="text-teal-700 dark:text-teal-300 font-bold">{studentResult.classRollNo || '—'}</strong></span>
                  <span>Class: <strong>{studentResult.className}</strong></span>
                  <span className="truncate max-w-[125px] text-[9.5px] text-slate-500">S/o {studentResult.fatherName || '—'}</span>
                </div>

                {/* Desktop & Print: Full 2-column info & 4 Attribute Cards */}
                <div className="hidden sm:block print:block space-y-2 mt-1">
                  <div className="sm:text-left">
                    <span className="text-[9px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider block">
                      Father's Name
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 print:text-black leading-tight mt-0.5">
                      {studentResult.fatherName || '—'}
                    </p>
                  </div>

                  {/* 4 Key Registration & Roll Attributes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Class</span>
                      <strong className="text-slate-800 dark:text-slate-200 print:text-black font-bold">{studentResult.className}</strong>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Class Roll No</span>
                      <strong className="text-teal-700 dark:text-teal-300 print:text-black font-bold">{studentResult.classRollNo || '—'}</strong>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Board Reg No</span>
                      <strong className="text-slate-800 dark:text-slate-200 print:text-black font-bold text-[11px] sm:text-xs">{studentResult.boardRegNo || '—'}</strong>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0 sm:text-right">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Form No</span>
                      <strong className="text-slate-800 dark:text-slate-200 print:text-black font-bold">{studentResult.formNo || '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject-Wise Performance Table */}
            <div className="relative z-10 space-y-1 pt-0.5 sm:pt-1">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider pb-0.5">
                <span>Academic Performance</span>
                <span className="font-mono">
                  Tabulated: {studentResult.evaluatedCount || 0} / {studentResult.totalCount || 0}
                </span>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-300 print:rounded-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 print:bg-transparent print:border-slate-300 print:text-slate-700">
                    <tr>
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5 text-center w-8 hidden sm:table-cell print:table-cell">#</th>
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5">Subject</th>
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5 text-center w-12 font-mono hidden sm:table-cell print:table-cell">Max</th>
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5 text-center w-12 font-mono hidden sm:table-cell print:table-cell">Min</th>
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5 text-center w-16 font-mono">Marks</th>
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5 text-center w-28 sm:w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 print:divide-slate-200 text-[11px]">
                    {studentResult.subjects && studentResult.subjects.map((sub, idx) => (
                      <tr
                        key={sub.subjectCode || idx}
                        className={sub.isEvaluated
                          ? (sub.isPass ? 'bg-emerald-50/20 dark:bg-emerald-950/10 print:bg-transparent' : 'bg-amber-50/20 dark:bg-amber-950/10 print:bg-transparent')
                          : 'bg-white dark:bg-slate-900/40 print:bg-transparent'
                        }
                      >
                        <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono text-[10px] text-slate-400 print:text-slate-500 hidden sm:table-cell print:table-cell">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-2 print:py-0.5 print:px-1.5 font-medium text-slate-800 dark:text-slate-200 print:text-black">
                          <span className="font-semibold">{sub.subjectName}</span>
                          <span className="text-[9px] text-slate-400 print:text-slate-500 font-mono ml-1">[{sub.subjectCode}]</span>
                          <span className="sm:hidden text-[9px] text-slate-400 font-mono ml-1.5">• Max: {sub.maxMarks}</span>
                        </td>
                        <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono text-slate-500 dark:text-slate-400 print:text-slate-600 text-[10.5px] hidden sm:table-cell print:table-cell">
                          {sub.maxMarks}
                        </td>
                        <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono text-slate-500 dark:text-slate-400 print:text-slate-600 text-[10.5px] hidden sm:table-cell print:table-cell">
                          {sub.minMarks}
                        </td>
                        <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono font-bold text-xs">
                          {sub.isEvaluated ? (
                            sub.isAbsent ? (
                              <span className="text-slate-500 dark:text-slate-400 print:text-black font-bold">AB</span>
                            ) : (
                              <span className={sub.isPass ? 'text-slate-900 dark:text-white print:text-black font-black' : 'text-amber-700 dark:text-amber-400 print:text-black font-black'}>
                                {sub.marksObtained}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 print:text-slate-400 font-bold">—</span>
                          )}
                        </td>
                        <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center">
                          {sub.isEvaluated ? (
                            <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold uppercase tracking-tight inline-block print:border-slate-400 print:text-black print:bg-transparent ${
                              sub.badgeClass || (
                                sub.isAbsent
                                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  : sub.isPass
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                              )
                            }`}>
                              {sub.status}
                            </span>
                          ) : (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[8.5px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 print:border-slate-300 print:text-slate-500 inline-block">
                              Awaiting Award
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/80 dark:bg-slate-800/60 font-bold border-t border-slate-200 dark:border-slate-700 print:border-slate-300 print:bg-transparent text-[10.5px]">
                    <tr>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-slate-700 dark:text-slate-200 print:text-black uppercase font-bold text-[9.5px] sm:text-[10px] sm:hidden">
                        Total
                      </td>
                      <td colSpan={2} className="py-1 px-2 print:py-0.5 print:px-1.5 text-slate-700 dark:text-slate-200 print:text-black uppercase font-bold text-[10px] hidden sm:table-cell print:table-cell">
                        Tabulated Total / Result
                      </td>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300 print:text-black hidden sm:table-cell print:table-cell">
                        {studentResult.totalMax > 0 ? studentResult.totalMax : '—'}
                      </td>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono text-slate-400 print:text-slate-500 hidden sm:table-cell print:table-cell">—</td>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono font-black text-teal-800 dark:text-teal-300 print:text-black text-xs">
                        {studentResult.hasMarks ? studentResult.totalObtained : '—'}
                      </td>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center">
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold uppercase inline-block print:border print:border-slate-400 print:bg-transparent print:text-black ${
                          studentResult.resultStatus === 'EXCELLENT'
                            ? 'bg-emerald-700 text-white'
                            : studentResult.resultStatus === 'VERY GOOD'
                            ? 'bg-teal-700 text-white'
                            : studentResult.resultStatus === 'GOOD'
                            ? 'bg-sky-700 text-white'
                            : studentResult.resultStatus === 'SATISFACTORY' || studentResult.resultStatus === 'PASS'
                            ? 'bg-emerald-600 text-white'
                            : studentResult.resultStatus === 'IN PROGRESS' || studentResult.resultStatus === 'PROVISIONAL PASS'
                            ? 'bg-teal-700 text-white'
                            : studentResult.resultStatus === 'NEEDS IMPROVEMENT' || studentResult.resultStatus === 'RE-APPEAR' || studentResult.resultStatus === 'FAIL'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-600 text-white'
                        }`}>
                          {studentResult.resultStatus === 'RE-APPEAR' || studentResult.resultStatus === 'FAIL' ? 'NEEDS IMPROVEMENT' : studentResult.resultStatus}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Status Note under table */}
              <div className="flex items-center justify-between gap-2 pt-0.5 text-[8.5px] sm:text-[9px] text-slate-500 dark:text-slate-400 print:text-slate-600">
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-teal-600 print:text-slate-500 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-none">
                    {studentResult.evaluatedCount < studentResult.totalCount
                      ? `Provisional Roll • ${studentResult.evaluatedCount}/${studentResult.totalCount} subjects tabulated.`
                      : `Official Award Roll • Verified.`
                    }
                  </span>
                </div>
                {studentResult.hasMarks && (
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300 print:text-black shrink-0">
                    {studentResult.percentage} ({String(studentResult.division || 'In Progress').replace(/re-appear|fail/gi, 'Scope for Improvement')})
                  </span>
                )}
              </div>
            </div>

            {/* Official 3-Signatory Block: Hidden on Mobile Screen, Visible on Desktop & Print */}
            <div className="relative z-10 pt-3 print:pt-2 hidden sm:grid print:grid grid-cols-3 gap-4 text-center text-[9px] font-bold text-slate-600 dark:text-slate-400 print:text-slate-800 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 mt-2 print:mt-1">
              <div>
                <p className="border-t border-slate-300 dark:border-slate-700 print:border-slate-400 pt-1 m-0">Evaluator / Teacher</p>
              </div>
              <div>
                <p className="border-t border-slate-300 dark:border-slate-700 print:border-slate-400 pt-1 m-0">I/C Examinations</p>
              </div>
              <div>
                <p className="border-t border-slate-300 dark:border-slate-700 print:border-slate-400 pt-1 m-0">Principal</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty Search Prompt */}
        {!studentResult && !searching && searchAttempted && !errorMsg && (
          <div className="p-4 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 print:hidden">
            <BookOpen size={20} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-bold text-xs text-slate-600 dark:text-slate-300">No candidate record found.</p>
            <p className="text-[10.5px] text-slate-400">Please verify your Roll No, Registration No, or Form No.</p>
          </div>
        )}
      </div>
    </div>
  );
}
