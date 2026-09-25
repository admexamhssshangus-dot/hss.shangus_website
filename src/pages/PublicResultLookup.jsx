import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, Printer, Award, CheckCircle2, AlertCircle, ArrowLeft,
  RefreshCw, School, BookOpen, ShieldCheck, X, ChevronDown, Check,
  User, Sparkles, Hash, Layers, FileText, CheckCircle, Clock, History
} from 'lucide-react';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { publicLookup } from '../services/backendEndpoint';
import SEO from '../components/SEO';
import { DEFAULT_SCHOOL_EVALUATIONS, SUBJECT_CONFIG_DEFS, getSubjectOverride } from '../utils/practicalsSettingsManager';
import verifiedCatalog from '../data/verifiedStudentsCatalog.json';
import { getCachedCollection, fetchStudentPhotoOnDemand } from '../services/dbCache';
import { identityKey, classKey, sessionKey, formatConsistentName } from '../utils/recordIdentity';

const STORAGE_KEY_RECENT_SEARCHES = 'hss_recent_results_lookups';
const STORAGE_KEY_LAST_LOOKUP = 'hss_last_result_lookup';

const loadRecentSearches = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_RECENT_SEARCHES) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
};

const loadLastLookup = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAST_LOOKUP) : null;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

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
    { code: 'UR', name: 'Urdu', defaultMax: 50 },
    { code: 'SC', name: 'Science', defaultMax: 50 },
    { code: 'SS', name: 'Social Science', defaultMax: 50 },
    { code: 'ITE', name: 'IT & ITeS', defaultMax: 50 },
  ],
};

// Stream-Subject Incompatibility Constraints to prevent cross-stream leaks (e.g. Botany in Humanities)
const SCIENCE_ONLY_SUBJECT_CODES = new Set(['PH', 'CH', 'BO', 'ZO', 'BI', 'BT']);
const SCIENCE_ONLY_SUBJECT_NAMES = ['physics', 'chemistry', 'botany', 'zoology', 'biology', 'biotechnology'];

const HUMANITIES_ONLY_SUBJECT_CODES = new Set(['HT', 'PS', 'ED', 'SO', 'HS', 'PHIL', 'PSY', 'GEO']);
const HUMANITIES_ONLY_SUBJECT_NAMES = ['history', 'political', 'education', 'sociology', 'philosophy', 'psychology', 'geography'];

export const isSubjectCompatibleWithStream = (code, name, stream, className) => {
  const normStream = String(stream || '').toLowerCase();
  const c = String(code || '').toUpperCase().trim();
  const n = String(name || '').toLowerCase();
  const normClass = String(className || '').toLowerCase().trim();
  const isSecondary = ['10th', '9th', '10', '9', 'x', 'ix'].includes(classKey(normClass)) || normClass.includes('10') || normClass.includes('9');

  // Secondary-only subjects (SC: General Science, SS: Social Science) must NEVER be assigned to Higher Secondary (11th/12th)
  // students or Higher Secondary streams (Science / Humanities)
  if (!isSecondary && (normStream.includes('scien') || normStream.includes('human') || normStream.includes('art') || normClass.includes('11') || normClass.includes('12'))) {
    if (c === 'SC' || c === 'SS' || n === 'science' || n === 'social science' || n === 'general science' || n.includes('class 10') || n.includes('class 9') || n.includes('social studies')) {
      return false;
    }
  }

  // Secondary (Class 9th/10th) students cannot take Higher Secondary specific stream subjects
  if (isSecondary) {
    if (['PH', 'CH', 'BO', 'ZO', 'PS', 'ED', 'HT', 'SO', 'EC'].includes(c)) return false;
  }

  const isScienceSubj = SCIENCE_ONLY_SUBJECT_CODES.has(c) || SCIENCE_ONLY_SUBJECT_NAMES.some(s => n.includes(s));
  const isHumanitiesSubj = HUMANITIES_ONLY_SUBJECT_CODES.has(c) || HUMANITIES_ONLY_SUBJECT_NAMES.some(s => n.includes(s));

  if (normStream.includes('human') || normStream.includes('art')) {
    if (isScienceSubj) return false;
  }
  if (normStream.includes('scien')) {
    if (isHumanitiesSubj) return false;
  }
  return true;
};

export const isSubjectEnrolledByStudent = (secCode, secName, student) => {
  const stream = student?.stream || (['11th', '12th'].includes(student?.className) ? 'Humanities' : 'General');
  const cls = student?.className;
  const isSec = ['10th', '9th', '10', '9', 'x', 'ix'].includes(classKey(cls));
  const c = String(secCode || '').toUpperCase().trim();
  const n = String(secName || '').toLowerCase();

  // If subject is incompatible with stream or class, reject immediately
  if (!isSubjectCompatibleWithStream(c, n, stream, cls)) return false;

  // For Higher Secondary Science students, core subjects General English (EN), Physics (PH), and Chemistry (CH) are always enrolled
  if (!isSec && String(stream).toLowerCase().includes('scien')) {
    if (c === 'PH' || c === 'CH' || c === 'EN' || c === 'GE') return true;
  }

  const enrolled = extractEnrolledSubjects(student);
  if (!Array.isArray(enrolled) || enrolled.length === 0) {
    return isSubjectCompatibleWithStream(secCode, secName, stream, cls);
  }

  return enrolled.some(sub => {
    const sCode = String(typeof sub === 'object' ? sub.code : sub || '').toUpperCase().trim();
    const sName = String(typeof sub === 'object' ? sub.name : sub || '').toLowerCase();

    if (sCode === c) return true;
    if (sName === n) return true;
    if (sCode === 'EN' && (c === 'GE' || n.includes('english'))) return true;
    if (sCode === 'GE' && (c === 'EN' || n.includes('english'))) return true;
    if (sCode === 'PH' && (c === 'PHY' || n.includes('physics'))) return true;
    if (sCode === 'CH' && (c === 'CHEM' || n.includes('chemistry'))) return true;
    if (sCode === 'BO' && (c === 'BO' || n.includes('botany'))) return true;
    if (sCode === 'ZO' && (c === 'ZO' || n.includes('zoology'))) return true;
    if (sCode === 'BI' && (c === 'BO' || c === 'ZO' || n.includes('biology') || n.includes('botany') || n.includes('zoology'))) return true;
    if (sCode === 'MA' && (c === 'MATH' || c === 'MATHS' || n.includes('math'))) return true;
    if (sCode === 'ES' && (c === 'EVS' || n.includes('environmental') || n.includes('env'))) return true;
    if (sCode === 'PS' && (c === 'POL' || n.includes('political'))) return true;
    if (sCode === 'HT' && (c === 'HIST' || n.includes('history'))) return true;
    if (sCode === 'ED' && (c === 'EDU' || n.includes('education'))) return true;
    if (sCode === 'UR' && (c === 'UR' || n.includes('urdu'))) return true;
    if (sCode === 'AR' && (c === 'AR' || n.includes('arabic'))) return true;
    if (sCode === 'PD' && (c === 'PHE' || c === 'PED' || n.includes('physical'))) return true;
    if (sCode === 'HTC' && (c === 'HTC' || c === 'HC' || n.includes('health'))) return true;
    if (sCode === 'ITE' && (c === 'ITE' || c === 'IT' || c === 'CS' || c === 'IP' || n.includes('information') || n.includes('ites'))) return true;
    return false;
  });
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

/**
 * Normalizes raw paper marks to a standard target scale (default 50).
 * Handles custom raw paper scales (e.g. 20, 25, 30, 40, 50, 70, 100),
 * absent candidates ('AB'), empty values, and calculates proportional pass mark (36%).
 */
export function normalizeMarksToScale(rawMarks, rawMax = 50, targetMax = 50) {
  const normTargetMax = Number(targetMax) > 0 ? Number(targetMax) : 50;
  const targetMinPass = Math.ceil(normTargetMax * 0.36);

  if (rawMarks === null || rawMarks === undefined || rawMarks === '' || rawMarks === '—') {
    return {
      normalizedMarks: '—',
      maxMarks: normTargetMax,
      minMarks: targetMinPass,
      rawMarks: '—',
      rawMax: Number(rawMax) || 50,
      isAbsent: false,
      isEvaluated: false
    };
  }

  const strMark = String(rawMarks).trim().toUpperCase();
  if (/^(A|AB|ABSENT)$/i.test(strMark)) {
    return {
      normalizedMarks: 'AB',
      maxMarks: normTargetMax,
      minMarks: targetMinPass,
      rawMarks: 'AB',
      rawMax: Number(rawMax) || 50,
      isAbsent: true,
      isEvaluated: true
    };
  }

  const numVal = Number(strMark);
  const parsedRawMax = Number(rawMax) > 0 ? Number(rawMax) : 50;

  if (isNaN(numVal)) {
    return {
      normalizedMarks: '—',
      maxMarks: normTargetMax,
      minMarks: targetMinPass,
      rawMarks: '—',
      rawMax: parsedRawMax,
      isAbsent: false,
      isEvaluated: false
    };
  }

  // Calculate normalized marks rounded to nearest integer
  let normalized = parsedRawMax === normTargetMax
    ? Math.round(numVal)
    : Math.round((numVal / parsedRawMax) * normTargetMax);

  normalized = Math.min(normTargetMax, Math.max(0, normalized));

  return {
    normalizedMarks: normalized,
    maxMarks: normTargetMax,
    minMarks: targetMinPass,
    rawMarks: numVal,
    rawMax: parsedRawMax,
    rawScore: `${numVal}/${parsedRawMax}`,
    isAbsent: false,
    isEvaluated: true
  };
}

/**
 * Extracts and canonicalizes enrolled subjects from a student record across
 * schema variations (subjects array, subs string, selectedSubjects, subjects1..6, Subject 1..6, etc.)
 */
export function extractEnrolledSubjects(student) {
  if (!student || typeof student !== 'object') return [];

  const normClass = String(student.className || student.Class || student.class || '').toLowerCase().trim();
  const isSecondary = ['10th', '9th', '10', '9', 'x', 'ix'].includes(classKey(normClass)) || normClass.includes('10') || normClass.includes('9');

  const sanitizeSubjList = (list) => {
    if (!Array.isArray(list)) return [];
    return list.filter(sub => {
      const code = String(typeof sub === 'object' ? sub.code : sub || '').toUpperCase().trim();
      const name = String(typeof sub === 'object' ? sub.name : sub || '').toLowerCase();
      // If student is in Class 11th or 12th, Class 10th subjects SC and SS are invalid
      if (!isSecondary) {
        if (code === 'SC' || code === 'SS' || name.includes('class 10th') || name.includes('class 9th') || name === 'science' || name === 'social science' || name.includes('social studies')) {
          return false;
        }
      }
      return true;
    });
  };

  // 1. Direct array of objects or strings
  let rawList = [];
  if (Array.isArray(student.subjects) && student.subjects.length > 0) {
    rawList = student.subjects;
  } else if (Array.isArray(student.selectedSubjects) && student.selectedSubjects.length > 0) {
    rawList = student.selectedSubjects;
  } else if (Array.isArray(student.expectedSubjectCodes) && student.expectedSubjectCodes.length > 0) {
    rawList = student.expectedSubjectCodes;
  }

  // Check 11th/12th admission form subjects if student is in 11th/12th and rawList is empty or contaminated with 10th subjects
  const isContaminatedWithSecondary = !isSecondary && rawList.some(s => {
    const c = String(typeof s === 'object' ? s.code : s || '').toUpperCase().trim();
    return c === 'SC' || c === 'SS';
  });

  if (rawList.length === 0 || isContaminatedWithSecondary) {
    const altSubs = student['Subjects Studied in Class 11th'] ||
                    student['Subjects to be taken in Class 12th'] ||
                    student['Subjects to be taken in Class 11th'] ||
                    (student['Stream & Subjects for Class 12th'] && !/same as/i.test(student['Stream & Subjects for Class 12th']) ? student['Stream & Subjects for Class 12th'] : '');
    if (typeof altSubs === 'string' && altSubs.trim()) {
      const parts = altSubs.split(/[,;|+]/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        rawList = parts;
      }
    }
  }

  // 2. Individual numbered slots (subjects1..subjects6, subject1..subject6, Subject 1..Subject 6, etc.)
  if (rawList.length === 0) {
    const slotValues = [];
    for (let i = 1; i <= 6; i++) {
      const val = student[`subjects${i}`] || student[`Subjects${i}`] ||
                  student[`subject${i}`] || student[`Subject${i}`] ||
                  student[`Subject ${i}`] || student[`sub${i}`] || student[`Sub${i}`] ||
                  student[`subject_${i}`] || student[`subjects_${i}`];
      if (val && typeof val === 'string' && val.trim() && val.trim() !== '-' && val.trim() !== '—') {
        slotValues.push(val.trim());
      }
    }
    if (slotValues.length > 0) {
      rawList = slotValues;
    }
  }

  // 3. Delimited string fields: subjects, subs, 'Subjects to be taken in Class 10th', etc.
  if (rawList.length === 0) {
    const combinedRaw = student.subjects || student.Subjects || student.subs || student.Subs ||
                        student.selectedSubjects || student.subjectList ||
                        student['Subjects Studied in Class 11th'] ||
                        student['Subjects to be taken in Class 12th'] ||
                        student['Subjects to be taken in Class 11th'] ||
                        student['Subjects to be taken in Class 10th'] ||
                        student['Subjects Studied in Class 10th'] ||
                        student['Subjects Offered'] || '';
    if (typeof combinedRaw === 'string' && combinedRaw.trim()) {
      const parts = combinedRaw.split(/[,;|+]/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        rawList = parts;
      }
    }
  }

  return sanitizeSubjList(rawList);
}

/**
 * Filters and deduplicates practical evaluation sections by subject, prioritizing
 * latest active / pending submissions over older records.
 */
export function filterAndDeduplicateSections(practicalDocs, targetClassName, targetSessionName, targetEvalName) {
  if (!Array.isArray(practicalDocs) || practicalDocs.length === 0) return [];
  const targetClass = classKey(targetClassName);
  const targetSession = sessionKey(targetSessionName);
  const targetEval = identityKey(targetEvalName);

  const matchingSectionsRaw = practicalDocs.filter(sec => {
    if (!Array.isArray(sec.records) || sec.records.length === 0) return false;
    if (String(sec.id || '').startsWith('history_') || String(sec.docId || '').startsWith('history_')) return false;
    if ((sec.isDraft === true && sec.status !== 'approved') || (sec.status === 'draft' && sec.status !== 'approved') || sec.status === 'rejected') return false;

    // Class matching (handles exact, composite '11th,12th', and numerical aliases)
    const rawCls = String(sec.className || sec.class || sec.selectedClass || sec.docId || '').toLowerCase();
    const docCls = classKey(rawCls);
    const isClassMatched = docCls === targetClass ||
      (targetClass === '11' && (rawCls.includes('11') || rawCls.includes('xi'))) ||
      (targetClass === '12' && (rawCls.includes('12') || rawCls.includes('xii'))) ||
      (targetClass === '10' && (rawCls.includes('10') || rawCls.includes('x')));
    if (!isClassMatched) return false;

    const rawSess = sec.sessionCanonical || sec.yearSuffix || sec.session || sec.Session || sec.docId || '';
    const docSess = sessionKey(rawSess);
    const isSessionMatched = !targetSessionName || targetSessionName === 'All' ||
      !rawSess ||
      docSess === targetSession ||
      (targetSession === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26'))) ||
      (targetSession === '2024-25' && (docSess === '2025' || String(rawSess).includes('2025') || String(rawSess).includes('2024-25')));
    if (!isSessionMatched) return false;

    if (targetEvalName && targetEvalName !== 'ALL') {
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

  const countEvaluated = (sec) => {
    if (!Array.isArray(sec?.records)) return 0;
    return sec.records.filter(r => {
      const m = r.totalMarks ?? r.practicalMarks;
      return m !== null && m !== undefined && m !== '' && !/^(a|ab|absent)$/i.test(String(m).trim());
    }).length;
  };

  const isExactClassMatch = (cls, target) => {
    const c = String(cls || '').trim().toLowerCase();
    const t = String(target || '').trim().toLowerCase();
    if (c === t) return true;
    if (t === '11th' && (c === '11th,12th' || c === '11th, 12th' || c === '12th,11th')) return true;
    return false;
  };

  const sectionsBySubj = new Map();
  for (const sec of matchingSectionsRaw) {
    let sKey = (sec.subjectCode || sec.subject || '').toUpperCase().trim();
    if (sKey === 'GE' || sKey === 'ENGLISH' || sKey === 'GENERAL ENGLISH') sKey = 'EN';
    if (!sKey) continue;
    const existing = sectionsBySubj.get(sKey);
    if (!existing) {
      sectionsBySubj.set(sKey, sec);
    } else {
      const aExact = isExactClassMatch(sec.className, targetClassName) ? 1 : 0;
      const bExact = isExactClassMatch(existing.className, targetClassName) ? 1 : 0;
      const aEval = countEvaluated(sec);
      const bEval = countEvaluated(existing);

      let winner = existing;
      let loser = sec;
      if (aExact !== bExact && Math.abs(aEval - bEval) <= 1) {
        if (aExact > bExact) {
          winner = sec;
          loser = existing;
        }
      } else if (aEval !== bEval) {
        if (aEval > bEval) {
          winner = sec;
          loser = existing;
        }
      } else {
        const isPending = (sec.id && sec.id.startsWith('pending_')) || sec.status === 'pending_approval';
        const existPending = (existing.id && existing.id.startsWith('pending_')) || existing.status === 'pending_approval';
        const secTime = Date.parse(sec.updatedAt || sec.submittedAt || sec.timestamp || 0) || 0;
        const existTime = Date.parse(existing.updatedAt || existing.submittedAt || existing.timestamp || 0) || 0;
        if ((isPending && !existPending) || secTime > existTime) {
          winner = sec;
          loser = existing;
        }
      }

      // Merge records so students who have evaluated marks in loser are not lost to an 'AB' in winner
      const mergedRecords = (winner.records || []).map(r => {
        const rawM = r.totalMarks ?? r.practicalMarks;
        const isAb = rawM === null || rawM === undefined || rawM === '' || /^(a|ab|absent)$/i.test(String(rawM).trim());
        if (isAb) {
          const loserMatch = (loser.records || []).find(lr => {
            const rReg = String(r.regNo || '').replace(/[^0-9]/g, '');
            const lrReg = String(lr.regNo || '').replace(/[^0-9]/g, '');
            if (rReg && lrReg && rReg.length >= 10 && rReg === lrReg) return true;
            const rForm = String(r.formNo || '').trim();
            const lrForm = String(lr.formNo || '').trim();
            if (rForm && lrForm && rForm === lrForm) return true;
            const rRoll = String(r.rollNo || '').trim();
            const lrRoll = String(lr.rollNo || '').trim();
            if (rRoll && lrRoll && rRoll === lrRoll && rRoll !== '-' && rRoll !== '') return true;
            return false;
          });
          if (loserMatch) {
            const lRawM = loserMatch.totalMarks ?? loserMatch.practicalMarks;
            const isLAb = lRawM === null || lRawM === undefined || lRawM === '' || /^(a|ab|absent)$/i.test(String(lRawM).trim());
            if (!isLAb) {
              return { ...r, ...loserMatch };
            }
          }
        }
        return r;
      });

      sectionsBySubj.set(sKey, { ...winner, records: mergedRecords });
    }
  }
  return Array.from(sectionsBySubj.values());
}

/**
 * Computes the complete scorecard subject roster with automatic normalization to 50M
 * and flexible Botany & Zoology combined (50M) vs separate (50M each) display.
 */
export function computeScorecardSubjects({
  matchedStudent,
  streamName,
  matchingSections = [],
  matchRecord,
  biologyDisplayMode = 'combined',
  evalConfig = null
}) {
  let botanySec = null;
  let zoologySec = null;
  let biologySec = null;
  let botanyRec = null;
  let zoologyRec = null;
  let biologyRec = null;

  for (const sec of matchingSections) {
    const c = (sec.subjectCode || '').toUpperCase().trim();
    const n = String(sec.subjectName || sec.subject || '').toLowerCase();
    const rec = (sec.records || []).find(matchRecord);
    if (!rec) continue;

    const rawM = rec.totalMarks ?? rec.practicalMarks;
    const isAb = rawM === null || rawM === undefined || rawM === '' || /^(a|ab|absent)$/i.test(String(rawM).trim());

    if (c === 'BO' || n.includes('botany')) {
      const currAb = !botanyRec || /^(a|ab|absent)$/i.test(String(botanyRec.totalMarks ?? botanyRec.practicalMarks).trim());
      if (!botanyRec || (currAb && !isAb)) {
        botanySec = sec;
        botanyRec = rec;
      }
    } else if (c === 'ZO' || n.includes('zoology')) {
      const currAb = !zoologyRec || /^(a|ab|absent)$/i.test(String(zoologyRec.totalMarks ?? zoologyRec.practicalMarks).trim());
      if (!zoologyRec || (currAb && !isAb)) {
        zoologySec = sec;
        zoologyRec = rec;
      }
    } else if (c === 'BI' || n.includes('biology')) {
      const currAb = !biologyRec || /^(a|ab|absent)$/i.test(String(biologyRec.totalMarks ?? biologyRec.practicalMarks).trim());
      if (!biologyRec || (currAb && !isAb)) {
        biologySec = sec;
        biologyRec = rec;
      }
    }
  }

  const stuClass = matchedStudent?.className || matchedStudent?.class || '11th';
  const evalTypeStr = String(evalConfig?.evalType || evalConfig?.title || '').toLowerCase();
  const isPreBoard = !evalConfig || !evalTypeStr || evalTypeStr.includes('pre-board') || evalTypeStr.includes('preboard') || evalConfig?.normalizeTo50 === true;

  const normClass = String(matchedStudent?.className || '').toLowerCase().trim();
  const isSecondary = ['10th', '9th', '10', '9', 'x', 'ix'].includes(classKey(normClass)) || normClass.includes('10') || normClass.includes('9');
  const isScience = !isSecondary && String(streamName || '').toLowerCase().includes('scien');
  const enrolledSubs = extractEnrolledSubjects(matchedStudent);

  const hasRegisteredBio = !isSecondary && Array.isArray(enrolledSubs) &&
    enrolledSubs.some(s => {
      const code = typeof s === 'string' ? '' : (s.code || '');
      const name = typeof s === 'string' ? s : (s.name || '');
      return ['BI', 'BO', 'ZO'].includes(code) || /biology|botany|zoology/i.test(name);
    });
  const hasBioActivity = !isSecondary && Boolean(botanyRec || zoologyRec || biologyRec || hasRegisteredBio || (isScience && enrolledSubs.length === 0));

  let rawTemplate = [];
  if (enrolledSubs.length > 0) {
    rawTemplate = enrolledSubs.map(s => {
      let rawCode = '';
      let rawName = '';
      let defaultMax = 50;
      if (typeof s === 'string') {
        rawCode = s.trim();
        rawName = s.trim();
      } else if (s && typeof s === 'object') {
        rawCode = s.code || s.subjectCode || '';
        rawName = s.name || s.subjectName || rawCode;
        if (s.defaultMax) defaultMax = s.defaultMax;
      }

      const sClean = (rawName || rawCode || '').trim();
      const sLower = sClean.toLowerCase();
      const cUpper = (rawCode || rawName || '').trim().toUpperCase();

      const foundDef = SUBJECT_CONFIG_DEFS.find(d => 
        d.code.toUpperCase() === cUpper || 
        d.code.toLowerCase() === sLower ||
        d.name.toLowerCase() === sLower ||
        (d.code === 'SC' && /^(science|sci|general science)$/i.test(sLower)) ||
        (d.code === 'SS' && /^(social science|social studies|sst|soc)$/i.test(sLower)) ||
        (d.code === 'MA' && /^(math|maths|mathematics)$/i.test(sLower)) ||
        ((d.code === 'EN' || d.code === 'GE') && /^(english|general english|gen eng|ge|en)$/i.test(sLower)) ||
        ((d.code === 'EN' || d.code === 'GE') && (cUpper === 'GE' || cUpper === 'EN')) ||
        (d.code === 'UR' && /^(urdu)$/i.test(sLower)) ||
        (d.code === 'HTC' && /^(healthcare|health care|hc)$/i.test(sLower)) ||
        (d.code === 'ITE' && /^(it and ites|it & ites|ites|it)$/i.test(sLower))
      );

      let canonicalName = foundDef?.name;
      if (!canonicalName || canonicalName === 'GE' || canonicalName === 'EN') {
        if (/^(ge|en|gen eng|general english|english)$/i.test(sLower) || cUpper === 'GE' || cUpper === 'EN') {
          canonicalName = 'General English';
        } else {
          canonicalName = rawName || rawCode || 'General Subject';
        }
      }

      let canonicalCode = foundDef?.code || (cUpper.length <= 4 ? cUpper : 'GEN');
      if (cUpper === 'EN' || cUpper === 'GE' || /^(ge|en|gen eng|general english|english)$/i.test(sLower)) {
        canonicalCode = 'EN';
        canonicalName = 'General English';
      }

      return {
        code: canonicalCode,
        name: canonicalName,
        defaultMax
      };
    });

    if (!isSecondary) {
      // 1. Strictly purge secondary-only subjects (SC and SS) from Higher Secondary student templates
      rawTemplate = rawTemplate.filter(t => t.code !== 'SC' && t.code !== 'SS' && !/class 10|class 9|social science/i.test(t.name || ''));

      // 2. Guarantee mandatory core Higher Secondary subjects for Science stream
      if (isScience) {
        const hasEN = rawTemplate.some(t => t.code === 'EN' || t.code === 'GE' || /english/i.test(t.name || ''));
        const hasPH = rawTemplate.some(t => t.code === 'PH' || /physics/i.test(t.name || ''));
        const hasCH = rawTemplate.some(t => t.code === 'CH' || /chemistry/i.test(t.name || ''));
        if (!hasEN) rawTemplate.unshift({ code: 'EN', name: 'General English', defaultMax: 50 });
        if (!hasPH) rawTemplate.push({ code: 'PH', name: 'Physics', defaultMax: 50 });
        if (!hasCH) rawTemplate.push({ code: 'CH', name: 'Chemistry', defaultMax: 50 });
      }

      // 3. Fallback if rawTemplate became empty after purging
      if (rawTemplate.length === 0) {
        if (isScience) {
          rawTemplate = [
            { code: 'EN', name: 'General English', defaultMax: 50 },
            { code: 'PH', name: 'Physics', defaultMax: 50 },
            { code: 'CH', name: 'Chemistry', defaultMax: 50 },
            { code: 'ES', name: 'Environmental Science', defaultMax: 50 }
          ];
        } else {
          rawTemplate = (STANDARD_STREAM_SUBJECTS.Humanities || []).map(s => ({ ...s }));
        }
      }
    }

    if (isSecondary) {
      const hasVocational = rawTemplate.some(t =>
        ['HTC', 'ITE', 'IT', 'HC'].includes(String(t.code || '').toUpperCase()) ||
        /vocational|healthcare|health care|it & ites|it and ites|information technology/i.test(t.name || '')
      );
      if (!hasVocational) {
        let vocSub = null;
        for (const sec of matchingSections) {
          const c = (sec.subjectCode || '').toUpperCase().trim();
          const n = String(sec.subjectName || sec.subject || '').toLowerCase();
          if (c === 'HTC' || c === 'HC' || n.includes('health')) {
            vocSub = { code: 'HTC', name: 'Healthcare', defaultMax: 50 };
            break;
          }
          if (c === 'ITE' || c === 'IT' || n.includes('it & ites') || n.includes('information')) {
            vocSub = { code: 'ITE', name: 'IT & ITeS', defaultMax: 50 };
            break;
          }
        }
        if (!vocSub && matchedStudent) {
          const vocField = String(
            matchedStudent.vocational ||
            matchedStudent.Vocational ||
            matchedStudent['Vocational subject'] ||
            matchedStudent['Vocational Subject'] ||
            matchedStudent.vocationalSubject ||
            matchedStudent.trade ||
            matchedStudent.Trade || ''
          ).toLowerCase();
          if (vocField.includes('health') || vocField.includes('htc')) {
            vocSub = { code: 'HTC', name: 'Healthcare', defaultMax: 50 };
          } else if (vocField.includes('it') || vocField.includes('ite')) {
            vocSub = { code: 'ITE', name: 'IT & ITeS', defaultMax: 50 };
          }
        }
        if (!vocSub) {
          vocSub = { code: 'ITE', name: 'IT & ITeS', defaultMax: 50 };
        }
        rawTemplate.push(vocSub);
      }
    }
  } else if (isSecondary) {
    rawTemplate = (STANDARD_STREAM_SUBJECTS.Secondary || []).map(s => ({ ...s }));
  } else if (isScience) {
    rawTemplate = [
      { code: 'EN', name: 'General English', defaultMax: 50 },
      { code: 'PH', name: 'Physics', defaultMax: 50 },
      { code: 'CH', name: 'Chemistry', defaultMax: 50 },
      { code: 'ES', name: 'Environmental Science', defaultMax: 50 }
    ];
  } else {
    rawTemplate = (STANDARD_STREAM_SUBJECTS.Humanities || []).map(s => ({ ...s }));
  }

  const finalSubjectsList = [];
  const matchedSectionIds = new Set();
  if (botanySec && botanyRec) matchedSectionIds.add(botanySec.id || botanySec.docId);
  if (zoologySec && zoologyRec) matchedSectionIds.add(zoologySec.id || zoologySec.docId);
  if (biologySec && biologyRec) matchedSectionIds.add(biologySec.id || biologySec.docId);

  // Process Biology / Botany / Zoology if applicable
  if (hasBioActivity) {
    if (biologyDisplayMode === 'combined') {
      if (biologyRec && !botanyRec && !zoologyRec) {
        const rawVal = biologyRec.totalMarks ?? biologyRec.practicalMarks;
        const docMax = Number(biologySec?.maxMarks) || 50;
        const norm = normalizeMarksToScale(rawVal, docMax, 50);
        const desc = getSubjectPerformanceDescriptor(norm.normalizedMarks, 50, 18, norm.isAbsent);

        finalSubjectsList.push({
          subjectCode: 'BI',
          subjectName: 'Biology (Botany & Zoology)',
          maxMarks: 50,
          minMarks: 18,
          marksObtained: norm.normalizedMarks,
          rawScore: norm.rawScore,
          rawMax: docMax,
          isAbsent: norm.isAbsent,
          isPass: desc.isPass,
          isEvaluated: norm.isEvaluated,
          status: desc.status,
          statusTone: desc.tone,
          badgeClass: desc.badgeClass,
          componentNote: norm.rawScore && docMax !== 50 ? `Raw: ${norm.rawScore}` : null
        });
      } else {
        const boRaw = botanyRec ? (botanyRec.totalMarks ?? botanyRec.practicalMarks) : null;
        const zoRaw = zoologyRec ? (zoologyRec.totalMarks ?? zoologyRec.practicalMarks) : null;
        const boOverride = getSubjectOverride(evalConfig?.subjectOverrides, 'BO', stuClass);
        const zoOverride = getSubjectOverride(evalConfig?.subjectOverrides, 'ZO', stuClass);
        const boMax = Number(botanySec?.maxMarks) || Number(boOverride?.maxMarks) || 25;
        const zoMax = Number(zoologySec?.maxMarks) || Number(zoOverride?.maxMarks) || 25;

        const boIsAb = boRaw !== null && /^(a|ab|absent)$/i.test(String(boRaw).trim());
        const zoIsAb = zoRaw !== null && /^(a|ab|absent)$/i.test(String(zoRaw).trim());

        const boEvaluated = botanyRec !== null && boRaw !== null && boRaw !== '';
        const zoEvaluated = zoologyRec !== null && zoRaw !== null && zoRaw !== '';

        let boPart = 0;
        let zoPart = 0;
        if (boEvaluated && !boIsAb) {
          const num = Number(boRaw);
          boPart = isNaN(num) ? 0 : Math.round((num / boMax) * 25);
        }
        if (zoEvaluated && !zoIsAb) {
          const num = Number(zoRaw);
          zoPart = isNaN(num) ? 0 : Math.round((num / zoMax) * 25);
        }

        const isBothAbsent = boEvaluated && zoEvaluated && boIsAb && zoIsAb;
        const isAnyEvaluated = boEvaluated || zoEvaluated;
        const isBothEvaluated = boEvaluated && zoEvaluated;

        let compParts = [];
        if (boEvaluated) {
          compParts.push(`BO: ${boIsAb ? 'AB' : `${boRaw}/${boMax}`}`);
        } else {
          compParts.push(`BO: Awaiting`);
        }
        if (zoEvaluated) {
          compParts.push(`ZO: ${zoIsAb ? 'AB' : `${zoRaw}/${zoMax}`}`);
        } else {
          compParts.push(`ZO: Awaiting`);
        }

        let marksObtained = '—';
        let targetMax = 50;
        let targetMin = 18;
        let desc;

        if (!isAnyEvaluated) {
          marksObtained = '—';
          desc = {
            status: 'Awaiting Award',
            tone: 'neutral',
            isPass: false,
            badgeClass: 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700'
          };
        } else if (isBothEvaluated) {
          marksObtained = isBothAbsent ? 'AB' : Math.min(50, boPart + zoPart);
          desc = getSubjectPerformanceDescriptor(marksObtained, 50, 18, isBothAbsent);
        } else {
          // Exactly one component evaluated (e.g. Botany evaluated, Zoology awaiting)
          if (boEvaluated) {
            targetMax = boMax;
            targetMin = Math.ceil(boMax * 0.36);
            marksObtained = boIsAb ? 'AB' : Number(boRaw);
            const baseDesc = getSubjectPerformanceDescriptor(marksObtained, targetMax, targetMin, boIsAb);
            desc = {
              ...baseDesc,
              status: `${baseDesc.status} (ZO Awaiting)`
            };
          } else {
            targetMax = zoMax;
            targetMin = Math.ceil(zoMax * 0.36);
            marksObtained = zoIsAb ? 'AB' : Number(zoRaw);
            const baseDesc = getSubjectPerformanceDescriptor(marksObtained, targetMax, targetMin, zoIsAb);
            desc = {
              ...baseDesc,
              status: `${baseDesc.status} (BO Awaiting)`
            };
          }
        }

        finalSubjectsList.push({
          subjectCode: 'BI',
          subjectName: 'Biology (Botany & Zoology)',
          maxMarks: targetMax,
          minMarks: targetMin,
          marksObtained,
          isAbsent: isBothAbsent,
          isPass: desc.isPass,
          isEvaluated: isAnyEvaluated,
          status: desc.status,
          statusTone: desc.tone,
          badgeClass: desc.badgeClass,
          componentNote: compParts.join(' • ')
        });
      }
    } else {
      // SEPARATE BOTANY & ZOOLOGY
      if (botanyRec) {
        const boRaw = botanyRec.totalMarks ?? botanyRec.practicalMarks;
        const boOverride = getSubjectOverride(evalConfig?.subjectOverrides, 'BO', stuClass);
        const boMax = Number(botanySec?.maxMarks) || Number(boOverride?.maxMarks) || 25;
        const boTargetMax = isPreBoard ? 50 : boMax;
        const boTargetMin = Math.ceil(boTargetMax * 0.36);
        const norm = normalizeMarksToScale(boRaw, boMax, boTargetMax);
        const desc = getSubjectPerformanceDescriptor(norm.normalizedMarks, boTargetMax, boTargetMin, norm.isAbsent);

        finalSubjectsList.push({
          subjectCode: 'BO',
          subjectName: 'Botany',
          maxMarks: boTargetMax,
          minMarks: boTargetMin,
          marksObtained: norm.normalizedMarks,
          rawScore: norm.rawScore,
          rawMax: boMax,
          isAbsent: norm.isAbsent,
          isPass: desc.isPass,
          isEvaluated: norm.isEvaluated,
          status: desc.status,
          statusTone: desc.tone,
          badgeClass: desc.badgeClass,
          componentNote: norm.rawScore && boMax !== boTargetMax ? `Raw Paper: ${norm.rawScore}` : null
        });
      } else {
        const boOverride = getSubjectOverride(evalConfig?.subjectOverrides, 'BO', stuClass);
        const boTargetMax = isPreBoard ? 50 : (Number(boOverride?.maxMarks) || 25);
        const boTargetMin = Math.ceil(boTargetMax * 0.36);
        finalSubjectsList.push({
          subjectCode: 'BO',
          subjectName: 'Botany',
          maxMarks: boTargetMax,
          minMarks: boTargetMin,
          marksObtained: '—',
          isAbsent: false,
          isPass: false,
          isEvaluated: false,
          status: 'Awaiting Award',
          statusTone: 'neutral',
          badgeClass: 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700',
          componentNote: null
        });
      }

      if (zoologyRec) {
        const zoRaw = zoologyRec.totalMarks ?? zoologyRec.practicalMarks;
        const zoOverride = getSubjectOverride(evalConfig?.subjectOverrides, 'ZO', stuClass);
        const zoMax = Number(zoologySec?.maxMarks) || Number(zoOverride?.maxMarks) || 50;
        const zoTargetMax = isPreBoard ? 50 : zoMax;
        const zoTargetMin = Math.ceil(zoTargetMax * 0.36);
        const norm = normalizeMarksToScale(zoRaw, zoMax, zoTargetMax);
        const desc = getSubjectPerformanceDescriptor(norm.normalizedMarks, zoTargetMax, zoTargetMin, norm.isAbsent);

        finalSubjectsList.push({
          subjectCode: 'ZO',
          subjectName: 'Zoology',
          maxMarks: zoTargetMax,
          minMarks: zoTargetMin,
          marksObtained: norm.normalizedMarks,
          rawScore: norm.rawScore,
          rawMax: zoMax,
          isAbsent: norm.isAbsent,
          isPass: desc.isPass,
          isEvaluated: norm.isEvaluated,
          status: desc.status,
          statusTone: desc.tone,
          badgeClass: desc.badgeClass,
          componentNote: norm.rawScore && zoMax !== zoTargetMax ? `Raw Paper: ${norm.rawScore}` : null
        });
      } else {
        const zoOverride = getSubjectOverride(evalConfig?.subjectOverrides, 'ZO', stuClass);
        const zoTargetMax = isPreBoard ? 50 : (Number(zoOverride?.maxMarks) || 50);
        const zoTargetMin = Math.ceil(zoTargetMax * 0.36);
        finalSubjectsList.push({
          subjectCode: 'ZO',
          subjectName: 'Zoology',
          maxMarks: zoTargetMax,
          minMarks: zoTargetMin,
          marksObtained: '—',
          isAbsent: false,
          isPass: false,
          isEvaluated: false,
          status: 'Awaiting Award',
          statusTone: 'neutral',
          badgeClass: 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700',
          componentNote: null
        });
      }
    }
  }

  // Process all other non-Biology template subjects
  const nonBioTemplate = rawTemplate.filter(t => !['BI', 'BO', 'ZO'].includes(t.code) && !/biology|botany|zoology/i.test(t.name || ''));

  nonBioTemplate.forEach(tpl => {
    let foundRec = null;
    let foundSec = null;

    for (const sec of matchingSections) {
      const c = (sec.subjectCode || '').toUpperCase().trim();
      const n = String(sec.subjectName || sec.subject || '').toLowerCase();
      const tplName = (tpl.name || '').toLowerCase();
      const isMatch = c === tpl.code || (tplName && n === tplName) ||
        ((tpl.code === 'EN' || tpl.code === 'GE') && (c === 'GE' || c === 'EN' || n.includes('english'))) ||
        (tpl.code === 'PH' && (c === 'PHY' || n.includes('physics'))) ||
        (tpl.code === 'CH' && (c === 'CHEM' || n.includes('chemistry'))) ||
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
          const rawM = rec.totalMarks ?? rec.practicalMarks;
          const isAb = rawM === null || rawM === undefined || rawM === '' || /^(a|ab|absent)$/i.test(String(rawM).trim());
          if (!isAb) {
            foundRec = rec;
            foundSec = sec;
            matchedSectionIds.add(sec.id || sec.docId);
            break;
          } else if (!foundRec) {
            foundRec = rec;
            foundSec = sec;
            matchedSectionIds.add(sec.id || sec.docId);
          }
        }
      }
    }

    if (foundRec && foundSec) {
      const rawMark = foundRec.totalMarks ?? foundRec.practicalMarks;
      const defaultAssessmentMax = Number(evalConfig?.maxMarks) > 0 ? Number(evalConfig.maxMarks) : 50;
      const subjOverride = getSubjectOverride(evalConfig?.subjectOverrides, tpl.code, stuClass);
      const docMax = Number(foundSec.maxMarks) || Number(subjOverride?.maxMarks) || defaultAssessmentMax;
      const targetScale = isPreBoard ? 50 : docMax;
      const targetMin = Math.ceil(targetScale * 0.36);
      const norm = normalizeMarksToScale(rawMark, docMax, targetScale);
      const desc = getSubjectPerformanceDescriptor(norm.normalizedMarks, targetScale, targetMin, norm.isAbsent);

      finalSubjectsList.push({
        subjectCode: tpl.code,
        subjectName: tpl.name,
        maxMarks: targetScale,
        minMarks: targetMin,
        marksObtained: norm.normalizedMarks,
        rawScore: norm.rawScore,
        rawMax: docMax,
        isAbsent: norm.isAbsent,
        isPass: desc.isPass,
        isEvaluated: norm.isEvaluated,
        status: desc.status,
        statusTone: desc.tone,
        badgeClass: desc.badgeClass,
        componentNote: norm.rawScore && docMax !== targetScale ? `Raw Paper: ${norm.rawScore}` : null
      });
    } else {
      const defaultAssessmentMax = Number(evalConfig?.maxMarks) > 0 ? Number(evalConfig.maxMarks) : 50;
      const subjOverride = getSubjectOverride(evalConfig?.subjectOverrides, tpl.code, stuClass);
      const targetScale = isPreBoard ? 50 : (Number(subjOverride?.maxMarks) || defaultAssessmentMax);
      const targetMin = Math.ceil(targetScale * 0.36);
      finalSubjectsList.push({
        subjectCode: tpl.code,
        subjectName: tpl.name,
        maxMarks: targetScale,
        minMarks: targetMin,
        marksObtained: '—',
        isAbsent: false,
        isPass: false,
        isEvaluated: false,
        status: 'Awaiting Award',
        statusTone: 'neutral',
        badgeClass: 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700',
        componentNote: null
      });
    }
  });

  // Additional electives found in sections
  matchingSections.forEach(sec => {
    if (!matchedSectionIds.has(sec.id || sec.docId)) {
      const secCode = (sec.subjectCode || '').toUpperCase().trim();
      const secName = sec.subjectName || sec.subject || '';

      if (['BO', 'ZO', 'BI'].includes(secCode) || /biology|botany|zoology/i.test(secName)) return;

      // Prevent duplicate General English from being added as an elective if already present
      const isEnglishSec = secCode === 'EN' || secCode === 'GE' || /^(english|general english|gen eng)$/i.test(secName.trim());
      const hasEnglishAlready = finalSubjectsList.some(s => s.subjectCode === 'EN' || s.subjectCode === 'GE' || /english/i.test(s.subjectName || ''));
      if (isEnglishSec && hasEnglishAlready) return;

      if (!isSubjectCompatibleWithStream(secCode, secName, streamName, normClass)) return;

      const rec = (sec.records || []).find(matchRecord);
      if (!rec) return;

      const rawMark = rec.totalMarks ?? rec.practicalMarks;
      const hasTeacherMark = rawMark !== null && rawMark !== undefined && rawMark !== '';

      if (Array.isArray(matchedStudent?.subjects) && matchedStudent.subjects.length > 0) {
        if (!hasTeacherMark && !isSubjectEnrolledByStudent(secCode, secName, matchedStudent)) return;
      }
        const docMax = Number(sec.maxMarks) || 50;
        const norm = normalizeMarksToScale(rawMark, docMax, 50);
        const desc = getSubjectPerformanceDescriptor(norm.normalizedMarks, 50, 18, norm.isAbsent);

        const canonicalElectiveCode = isEnglishSec ? 'EN' : (sec.subjectCode || 'ELEC').toUpperCase();
        const canonicalElectiveName = isEnglishSec ? 'General English' : (sec.subjectName || sec.subject || 'Elective Subject');

        finalSubjectsList.push({
          subjectCode: canonicalElectiveCode,
          subjectName: canonicalElectiveName,
          maxMarks: 50,
          minMarks: 18,
          marksObtained: norm.normalizedMarks,
          rawScore: norm.rawScore,
          rawMax: docMax,
          isAbsent: norm.isAbsent,
          isPass: desc.isPass,
          isEvaluated: norm.isEvaluated,
          status: desc.status,
          statusTone: desc.tone,
          badgeClass: desc.badgeClass,
          componentNote: norm.rawScore && docMax !== 50 ? `Raw Paper: ${norm.rawScore}` : null
        });
    }
  });

  // Deduplicate any duplicate subject entries (e.g. GE vs EN, or duplicate elective rows)
  const seenCanonical = new Set();
  const deduplicatedList = [];
  for (const sub of finalSubjectsList) {
    let cKey = (sub.subjectCode || '').toUpperCase().trim();
    if (cKey === 'GE' || /english/i.test(sub.subjectName || '')) {
      cKey = 'EN';
      sub.subjectCode = 'EN';
      sub.subjectName = 'General English';
    }
    if (seenCanonical.has(cKey)) {
      const existingIdx = deduplicatedList.findIndex(s => {
        const sKey = (s.subjectCode === 'GE' || /english/i.test(s.subjectName || '')) ? 'EN' : (s.subjectCode || '').toUpperCase().trim();
        return sKey === cKey;
      });
      if (existingIdx !== -1) {
        const existing = deduplicatedList[existingIdx];
        if (!existing.isEvaluated && sub.isEvaluated) {
          deduplicatedList[existingIdx] = sub;
        }
      }
      continue;
    }
    seenCanonical.add(cKey);
    deduplicatedList.push(sub);
  }

  const secondaryWeight = { EN: 1, MA: 2, UR: 3, HN: 3, SC: 4, SS: 5, ITE: 6, HTC: 6, HC: 6, IT: 6 };
  const codeWeight = { EN: 1, PH: 2, CH: 3, BI: 4, BO: 4, ZO: 5, MA: 6, ES: 7, ED: 8, HT: 9, PS: 10, UR: 11, SC: 12, SS: 13 };
  deduplicatedList.sort((a, b) => {
    if (isSecondary) {
      return (secondaryWeight[a.subjectCode] || 30) - (secondaryWeight[b.subjectCode] || 30);
    }
    return (codeWeight[a.subjectCode] || 30) - (codeWeight[b.subjectCode] || 30);
  });

  const evaluatedSubjects = deduplicatedList.filter(s => s.isEvaluated);
  const evaluatedCount = evaluatedSubjects.length;
  const totalCount = deduplicatedList.length;
  const totalObtained = evaluatedSubjects.reduce((acc, s) => acc + (typeof s.marksObtained === 'number' ? s.marksObtained : 0), 0);
  const totalMax = evaluatedSubjects.reduce((acc, s) => acc + s.maxMarks, 0);
  const hasMarks = evaluatedCount > 0;
  const pct = hasMarks && totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : null;

  const allAbsent = hasMarks && evaluatedSubjects.every(s => s.isAbsent);
  const hasFail = hasMarks && evaluatedSubjects.some(s => !s.isPass && !s.isAbsent);
  const overall = getOverallResultDescriptor(evaluatedCount, totalCount, totalObtained, totalMax, hasFail, allAbsent);

  return {
    subjects: deduplicatedList,
    evaluatedCount,
    totalCount,
    totalObtained,
    totalMax,
    hasMarks,
    percentage: pct !== null ? `${pct}%` : '—',
    division: overall.division,
    resultStatus: overall.resultStatus,
    hasBiologySubjects: hasBioActivity
  };
}

export default function PublicResultLookup() {
  const [searchParams] = useSearchParams();
  const initialReg = searchParams.get('reg') || searchParams.get('roll') || searchParams.get('fno') || '';
  const initialClass = searchParams.get('class') || '11th';
  const initialSession = searchParams.get('session') || '2025-26';

  const lastSavedLookup = useRef(loadLastLookup());
  const initialSaved = !initialReg && lastSavedLookup.current ? lastSavedLookup.current : null;

  const [queryInput, setQueryInput] = useState(initialReg || initialSaved?.query || '');
  const [queryDob, setQueryDob] = useState('');
  const [selectedClass, setSelectedClass] = useState(initialClass !== '11th' ? initialClass : (initialSaved?.className || initialClass));
  const [selectedSession, setSelectedSession] = useState(initialSession !== '2025-26' ? initialSession : (initialSaved?.session || initialSession));
  const [selectedEvalType, setSelectedEvalType] = useState(initialSaved?.evalType || 'Pre-Board Test');
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);

  const [evalOptions, setEvalOptions] = useState([]);
  const [availableSessions, setAvailableSessions] = useState(['2025-26', '2024-25', '2023-24']);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [studentResult, setStudentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSearchExpandedOnMobile, setIsSearchExpandedOnMobile] = useState(false);
  const [biologyDisplayMode, setBiologyDisplayMode] = useState('combined');
  const [livePracticalsDocs, setLivePracticalsDocs] = useState([]);

  // Real-Time Live Firestore Listener: Immediately reflects teacher evaluation submissions
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        collection(db, 'practicalsData'),
        (snapshot) => {
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setLivePracticalsDocs(docs);
        },
        (err) => {
          if (process.env.NODE_ENV === 'test') {
            console.warn('Real-time practicalsData listener notice:', err);
          }
        }
      );
    } catch (e) {
      if (process.env.NODE_ENV === 'test') {
        console.warn('Could not attach real-time practicalsData listener:', e);
      }
    }
    return () => unsubscribe();
  }, []);

  // Asynchronously hydrate student photo from Firebase if not yet populated or if Google Drive URL
  useEffect(() => {
    if (!studentResult || (studentResult.photoUrl && !studentResult.photoUrl.includes('drive.google.com') && !studentResult.photoUrl.includes('googleusercontent.com') && !studentResult.photoUrl.includes('docs.google.com'))) return;
    let isMounted = true;
    async function hydratePhoto() {
      try {
        const p = await fetchStudentPhotoOnDemand(studentResult.lookupContext?.matchedStudent || studentResult);
        if (isMounted && p && !p.includes('drive.google.com') && !p.includes('googleusercontent.com') && !p.includes('docs.google.com')) {
          setStudentResult(prev => prev ? { ...prev, photoUrl: p } : null);
        }
      } catch (_) {}
    }
    hydratePhoto();
    return () => { isMounted = false; };
  }, [studentResult]);

  // Active evaluation configuration matching selected evalType
  const activeEvalConfig = useMemo(() => {
    if (!evalOptions || evalOptions.length === 0) return null;
    return evalOptions.find(e => (e.evalType || e.title) === selectedEvalType) || null;
  }, [evalOptions, selectedEvalType]);

  // Synchronize biologyDisplayMode automatically when active assessment changes
  useEffect(() => {
    if (activeEvalConfig?.biologyDisplayMode) {
      setBiologyDisplayMode(activeEvalConfig.biologyDisplayMode);
    }
  }, [activeEvalConfig]);

  // Reactively derive active scorecard when toggling between Combined Bio and Separate BO & ZO
  // or when real-time practicalsData updates from live teacher submissions
  const activeScorecard = useMemo(() => {
    if (!studentResult) return null;
    if (studentResult.lookupContext) {
      const currentMatchingSections = livePracticalsDocs.length > 0
        ? filterAndDeduplicateSections(
            livePracticalsDocs,
            studentResult.className || selectedClass,
            studentResult.session || selectedSession,
            selectedEvalType
          )
        : studentResult.lookupContext.matchingSections;

      const computed = computeScorecardSubjects({
        matchedStudent: studentResult.lookupContext.matchedStudent,
        streamName: studentResult.lookupContext.streamName,
        matchingSections: currentMatchingSections,
        matchRecord: studentResult.lookupContext.matchRecord,
        biologyDisplayMode,
        evalConfig: activeEvalConfig
      });
      return {
        ...studentResult,
        ...computed
      };
    }
    return studentResult;
  }, [studentResult, livePracticalsDocs, biologyDisplayMode, activeEvalConfig, selectedClass, selectedSession, selectedEvalType]);

  const activeResult = activeScorecard || studentResult;

  // Helper to persist searches to localStorage
  const saveSearchToHistory = useCallback((entry) => {
    if (!entry || !entry.query) return;
    try {
      localStorage.setItem(STORAGE_KEY_LAST_LOOKUP, JSON.stringify({
        query: entry.query,
        className: entry.className,
        session: entry.session,
        evalType: entry.evalType
      }));

      const existing = loadRecentSearches();
      const updated = [
        {
          query: entry.query,
          className: entry.className,
          session: entry.session,
          evalType: entry.evalType,
          candidateName: entry.candidateName || '',
          timestamp: Date.now()
        },
        ...existing.filter(item => !(
          String(item.query).trim().toLowerCase() === String(entry.query).trim().toLowerCase() &&
          String(item.className) === String(entry.className) &&
          String(item.evalType) === String(entry.evalType)
        ))
      ];
      localStorage.setItem(STORAGE_KEY_RECENT_SEARCHES, JSON.stringify(updated.slice(0, 5)));
      setRecentSearches(updated.slice(0, 5));
    } catch (_) {}
  }, []);

  const handleRemoveRecent = (queryToRemove) => {
    try {
      const updated = recentSearches.filter(item => item.query !== queryToRemove);
      localStorage.setItem(STORAGE_KEY_RECENT_SEARCHES, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {}
  };

  const handleClearAllRecent = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_RECENT_SEARCHES);
      localStorage.removeItem(STORAGE_KEY_LAST_LOOKUP);
      setRecentSearches([]);
    } catch (_) {}
  };

  const handleSelectRecent = (item) => {
    setQueryInput(item.query || '');
    if (item.className) setSelectedClass(item.className);
    if (item.session) setSelectedSession(item.session);
    if (item.evalType) setSelectedEvalType(item.evalType);
    setErrorMsg('');
  };

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
            if (evaluations[0].biologyDisplayMode) setBiologyDisplayMode(evaluations[0].biologyDisplayMode);
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

      // Tier 1.5: Direct live Firestore configuration lookup
      try {
        const snap = await getDoc(doc(db, 'adminPracticalsSettings', 'config')).catch(() => null);
        if (!isMounted) return;
        if (snap && snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.customEvaluations) && data.customEvaluations.length > 0) {
            const published = data.customEvaluations.filter(item => item.isPublishedForStudents !== false);
            if (published.length > 0) {
              setEvalOptions(published);
              const sessions = [...new Set(published.map(item => item.session))].filter(Boolean);
              if (sessions.length) setAvailableSessions(sessions);
              if (published[0]) {
                setSelectedEvalType(published[0].evalType || published[0].title);
                if (published[0].session) setSelectedSession(published[0].session);
                if (published[0].biologyDisplayMode) setBiologyDisplayMode(published[0].biologyDisplayMode);
              }
              return;
            }
          }
        }
      } catch (fErr) {
        console.warn('Firestore evaluation config lookup note:', fErr);
      }

      // Fallback to active evaluations preset (Pre-Board Test, Internal, External)
      if (!isMounted) return;
      const fallbackEvals = DEFAULT_SCHOOL_EVALUATIONS.map(ev => ({
        id: ev.id,
        title: ev.title,
        evalType: ev.evalType,
        session: ev.session || '2025-26',
        classes: ev.classes || ['10th', '11th', '12th'],
        biologyDisplayMode: ev.biologyDisplayMode || 'combined',
        maxMarks: ev.maxMarks || 50,
        minMarks: ev.minMarks || 18,
        subjectOverrides: ev.subjectOverrides || {},
        allowedStatuses: ev.allowedStatuses || ['approved']
      }));
      setEvalOptions(fallbackEvals);
      setAvailableSessions(['2025-26', '2024-25', '2023-24']);
      if (fallbackEvals[0]) {
        setSelectedEvalType(fallbackEvals[0].evalType || fallbackEvals[0].title);
        if (fallbackEvals[0].biologyDisplayMode) setBiologyDisplayMode(fallbackEvals[0].biologyDisplayMode);
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
        
        // Normalize subjects and overall status to encouraging, modern labels with 50M scale
        const rawSubs = Array.isArray(res.subjects) ? res.subjects : [];
        const sanitizedSubjects = rawSubs.map(sub => {
          const rawM = sub.marksObtained;
          const isAb = sub.isAbsent || /^(a|ab|absent)$/i.test(String(rawM).trim());
          const docMax = Number(sub.maxMarks) || 50;
          const norm = normalizeMarksToScale(rawM, docMax, 50);
          const desc = getSubjectPerformanceDescriptor(norm.normalizedMarks, 50, 18, isAb);
          let sCode = (sub.subjectCode || '').toUpperCase().trim();
          let sName = sub.subjectName || '';
          if (sCode === 'GE' || /english/i.test(sName)) {
            sCode = 'EN';
            sName = 'General English';
          }
          return {
            ...sub,
            subjectCode: sCode,
            subjectName: sName,
            maxMarks: 50,
            minMarks: 18,
            marksObtained: isAb ? 'AB' : norm.normalizedMarks,
            rawScore: norm.rawScore,
            rawMax: docMax,
            status: desc.status,
            statusTone: desc.tone,
            badgeClass: desc.badgeClass,
            isPass: desc.isPass,
            isEvaluated: norm.isEvaluated,
            componentNote: norm.rawScore && docMax !== 50 ? `Raw Paper: ${norm.rawScore}` : (sub.componentNote || null)
          };
        });

        // Deduplicate any duplicate subjects in sanitizedSubjects (e.g. GE vs EN)
        const seenServerless = new Set();
        const deduplicatedServerless = [];
        for (const sub of sanitizedSubjects) {
          const cKey = sub.subjectCode;
          if (seenServerless.has(cKey)) {
            const existingIdx = deduplicatedServerless.findIndex(s => s.subjectCode === cKey);
            if (existingIdx !== -1 && !deduplicatedServerless[existingIdx].isEvaluated && sub.isEvaluated) {
              deduplicatedServerless[existingIdx] = sub;
            }
            continue;
          }
          seenServerless.add(cKey);
          deduplicatedServerless.push(sub);
        }

        const evCount = res.evaluatedCount ?? deduplicatedServerless.filter(s => s.isEvaluated).length;
        const totCount = res.totalCount ?? (deduplicatedServerless.length || 6);
        const anyFail = deduplicatedServerless.some(s => s.isEvaluated && !s.isPass && !s.isAbsent);
        const allAb = deduplicatedServerless.length > 0 && deduplicatedServerless.every(s => s.isAbsent);
        const totalObt = deduplicatedServerless.reduce((acc, s) => acc + (typeof s.marksObtained === 'number' ? s.marksObtained : 0), 0);
        const totalMx = deduplicatedServerless.reduce((acc, s) => acc + s.maxMarks, 0);
        const overall = getOverallResultDescriptor(evCount, totCount, totalObt, totalMx, anyFail, allAb);

        const hasBioInServerless = deduplicatedServerless.some(s => ['BI', 'BO', 'ZO'].includes((s.subjectCode || '').toUpperCase()) || /biology|botany|zoology/i.test(s.subjectName || ''));

        setStudentResult({
          ...res,
          name: formatConsistentName(res.name || res.studentName),
          fatherName: formatConsistentName(res.fatherName || res.parentage),
          photoUrl: cleanPhoto,
          subjects: deduplicatedServerless.length > 0 ? deduplicatedServerless : res.subjects,
          totalObtained: totalObt,
          totalMax: totalMx,
          evaluatedCount: evCount,
          totalCount: totCount,
          hasMarks: evCount > 0,
          percentage: evCount > 0 && totalMx > 0 ? `${((totalObt / totalMx) * 100).toFixed(1)}%` : '—',
          resultStatus: overall.resultStatus,
          division: overall.division,
          hasBiologySubjects: hasBioInServerless
        });
        saveSearchToHistory({
          query: cleanQuery,
          className: res.className || selectedClass,
          session: res.session || selectedSession,
          evalType: selectedEvalType,
          candidateName: formatConsistentName(res.name || res.studentName || '')
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

        // Match 4: Exact Full Registration Match (100% full match, no suffix/partial collision)
        if (!matchedStudent && cleanDigitsOnly.length >= 8) {
          matchedStudent = candidateMatches(s => {
            const rDigits = String(s.boardRegNo || s.regNo || '').replace(/\D/g, '');
            if (!rDigits || rDigits.length < 8) return false;
            return rDigits === cleanDigitsOnly && (!targetClsKey || classKey(s.className) === targetClsKey);
          });
        }

        // Match 5: Resilient fallback to verified seed database
        if (!matchedStudent) {
          try {
            const { CLEAN_PRACTICALS_SEED_DATA } = await import('../data/cleanPracticalsSeedData');
            if (Array.isArray(CLEAN_PRACTICALS_SEED_DATA)) {
              for (const doc of CLEAN_PRACTICALS_SEED_DATA) {
                const docCls = classKey(doc.className || '');
                if (targetClsKey && docCls && docCls !== targetClsKey) continue;
                const rec = (doc.records || []).find(r => {
                  const rReg = String(r.boardRegNo || '').replace(/[^a-z0-9]/g, '');
                  const rForm = String(r.formNo || r.fNo || '').trim().toLowerCase();
                  const rRoll = String(r.classRollNo || r.roll || '').trim().toLowerCase();
                  const qClean = normQ.replace(/[^a-z0-9]/g, '');
                  return (rReg && rReg === qClean) ||
                         (rForm && rForm === normQ) ||
                         (rRoll && rRoll === normQ);
                });
                if (rec) {
                  const parsedSubs = rec.subjects
                    ? String(rec.subjects).split(/[,;|+]/).map(s => {
                        const code = s.trim();
                        return { code, name: code };
                      }).filter(s => s.code)
                    : [];
                  matchedStudent = {
                    name: rec.name,
                    fatherName: rec.parentName || '—',
                    className: doc.className || selectedClass,
                    classRollNo: rec.classRollNo || '—',
                    examRollNo: rec.examRollNo || '—',
                    boardRegNo: rec.boardRegNo || cleanQuery,
                    formNo: rec.formNo || rec.fNo || '—',
                    fNo: rec.formNo || rec.fNo || '—',
                    stream: rec.stream || (doc.className === '11th' || doc.className === '12th' ? 'Humanities' : 'General'),
                    session: selectedSession,
                    subjects: parsedSubs
                  };
                  break;
                }
              }
            }
          } catch (_) {}
        }

        // Match 6: Discover candidate from live practicalsData or cached admissions/masterRegisters
        if (!matchedStudent) {
          try {
            let livePracticals = [];
            try {
              const snap = await getDocs(collection(db, 'practicalsData'));
              livePracticals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (_) {
              livePracticals = await getCachedCollection('practicalsData', false, 10 * 60 * 1000).catch(() => []) || [];
            }

            const targetClsKey = classKey(selectedClass);
            const qClean = normQ.replace(/[^a-z0-9]/g, '');

            // 6A. Search live teacher practical submission sheets
            for (const sec of livePracticals) {
              const secCls = classKey(sec.className || sec.class || sec.selectedClass || '');
              if (targetClsKey && secCls && secCls !== targetClsKey) continue;
              const rec = (sec.records || []).find(r => {
                const rReg = String(r.regNo || r.boardRegNo || r.reg || '').replace(/[^a-z0-9]/g, '');
                const rForm = String(r.formNo || r.fNo || '').trim().toLowerCase();
                const rRoll = String(r.classRollNo || r.rollNo || r.roll || '').trim().toLowerCase();
                const isRegMatch = Boolean(rReg && rReg === qClean);
                const isFormMatch = Boolean(rForm && rForm === normQ);
                const isRollMatch = Boolean(rRoll && rRoll === normQ);
                return isRegMatch || isFormMatch || isRollMatch;
              });
              if (rec) {
                let enrolled = extractEnrolledSubjects(rec);
                if (!Array.isArray(enrolled) || enrolled.length === 0) {
                  const targetSecCls = classKey(sec.className || selectedClass);
                  const isSec = ['10th', '9th', '10', '9'].includes(targetSecCls);
                  if (isSec) {
                    enrolled = [
                      { code: 'EN', name: 'General English' },
                      { code: 'MA', name: 'Mathematics' },
                      { code: 'SC', name: 'Science' },
                      { code: 'SS', name: 'Social Science' },
                      { code: 'UR', name: 'Urdu' }
                    ];
                  }
                }
                matchedStudent = {
                  name: rec.name || rec.studentName,
                  fatherName: rec.parentName || rec.fatherName || '—',
                  className: sec.className || selectedClass,
                  classRollNo: rec.classRollNo || rec.rollNo || '—',
                  examRollNo: rec.examRollNo || '—',
                  boardRegNo: rec.regNo || rec.boardRegNo || cleanQuery,
                  formNo: rec.formNo || rec.fNo || '—',
                  fNo: rec.formNo || rec.fNo || '—',
                  stream: rec.stream || (['11th', '12th'].includes(sec.className) ? 'Humanities' : 'General'),
                  session: sec.session || selectedSession,
                  dob: rec.dob || '',
                  subjects: enrolled
                };
                break;
              }
            }

            // 6B. Search cached admissions and masterRegisters (only when authenticated as staff)
            if (!matchedStudent && auth?.currentUser) {
              const [cachedAdm, cachedMaster] = await Promise.all([
                getCachedCollection('admissions', false, 10 * 60 * 1000).catch(() => []),
                getCachedCollection('masterRegisters', false, 10 * 60 * 1000).catch(() => [])
              ]);
              const allCandidates = [
                ...(Array.isArray(cachedAdm) ? cachedAdm : []),
                ...(Array.isArray(cachedMaster) ? cachedMaster.flatMap(d => d.items || d.students || d.records || d.data || [d]) : [])
              ];
              const found = allCandidates.find(st => {
                if (!st || typeof st !== 'object') return false;
                const stCls = classKey(st.selectedClass || st.className || st.Class || st.class || st['Admission sought for class'] || '');
                if (targetClsKey && stCls && stCls !== targetClsKey) return false;
                const stReg = String(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.'] || '').replace(/[^a-z0-9]/g, '');
                const stForm = String(st.formNo || st['Form Number'] || '').trim().toLowerCase();
                const stRoll = String(st.classRollNo || st['Class Roll No'] || '').trim().toLowerCase();
                const isRegMatch = Boolean(stReg && stReg === qClean);
                const isFormMatch = Boolean(stForm && stForm === normQ);
                const isRollMatch = Boolean(stRoll && stRoll === normQ);
                return isRegMatch || isFormMatch || isRollMatch;
              });
              if (found) {
                let enrolled = extractEnrolledSubjects(found);
                const isFoundSecondary = ['10th', '9th', '10', '9', 'x', 'ix'].includes(classKey(found.selectedClass || found.className || found.Class || selectedClass));
                const lacksVocational = isFoundSecondary && !enrolled.some(s => {
                  const code = typeof s === 'string' ? s : (s.code || '');
                  const name = typeof s === 'string' ? s : (s.name || '');
                  return ['HTC', 'ITE', 'IT', 'HC'].includes(String(code).toUpperCase()) || /vocational|healthcare|it & ites|information/i.test(name);
                });
                if ((enrolled.length === 0 || lacksVocational) && Array.isArray(verifiedCatalog)) {
                  const catMatch = verifiedCatalog.find(c => {
                    const cForm = String(c.fNo || '').trim().toLowerCase();
                    const fForm = String(found.formNo || found['Form Number'] || '').trim().toLowerCase();
                    if (cForm && fForm && cForm === fForm) return true;
                    const cReg = String(c.boardRegNo || '').replace(/[^a-z0-9]/g, '');
                    const fReg = String(found.boardRegNo || found.regNo || found['Board Registration Number'] || '').replace(/[^a-z0-9]/g, '');
                    if (cReg && fReg && cReg === fReg) return true;
                    const cName = String(c.name || '').trim().toLowerCase().replace(/[^a-z]/g, '');
                    const fName = String(found.name || found.studentName || found["Student's Name (as per school records)"] || found["Student's Name"] || '').trim().toLowerCase().replace(/[^a-z]/g, '');
                    const cDad = String(c.fatherName || '').trim().toLowerCase().replace(/[^a-z]/g, '');
                    const fDad = String(found.fatherName || found["Father's/Guardian's Name (as per school records)"] || found["Father's Name"] || '').trim().toLowerCase().replace(/[^a-z]/g, '');
                    return Boolean(cName && fName && (cName === fName || cName.includes(fName) || fName.includes(cName)) && cDad && fDad && (cDad === fDad || cDad.includes(fDad) || fDad.includes(cDad)));
                  });
                  if (catMatch && Array.isArray(catMatch.subjects) && catMatch.subjects.length > 0) {
                    enrolled = catMatch.subjects;
                  }
                }

                matchedStudent = {
                  name: found.name || found.studentName || found["Student's Name (as per school records)"] || found["Student's Name"],
                  fatherName: found.fatherName || found["Father's/Guardian's Name (as per school records)"] || found["Father's Name"] || '—',
                  className: found.selectedClass || found.className || found.Class || selectedClass,
                  classRollNo: found.classRollNo || found['Class Roll No'] || found.rollNo || '—',
                  examRollNo: found.examRollNo || '—',
                  boardRegNo: found.boardRegNo || found.regNo || found['Board Registration Number'] || cleanQuery,
                  formNo: found.formNo || found['Form Number'] || '—',
                  stream: found.stream || found.Stream || (['11th', '12th'].includes(selectedClass) ? 'Humanities' : 'General'),
                  session: found.selectedSession || found.Session || selectedSession,
                  dob: found.dob || found['DoB (figures)'] || found['Date of Birth'] || found.dateOfBirth || '',
                  subjects: enrolled
                };
              }
            }
          } catch (dErr) {
            console.warn('Live candidate fallback error:', dErr);
          }
        }
      }

      if (matchedStudent) {
        if (!matchedStudent.formNo && matchedStudent.fNo) matchedStudent.formNo = matchedStudent.fNo;
        if (!matchedStudent.fNo && matchedStudent.formNo) matchedStudent.fNo = matchedStudent.formNo;

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
        const hasScienceSubjects = Array.isArray(matchedStudent.subjects) && matchedStudent.subjects.some(s =>
          SCIENCE_ONLY_SUBJECT_CODES.has(String(s.code || '').toUpperCase()) ||
          SCIENCE_ONLY_SUBJECT_NAMES.some(n => String(s.name || '').toLowerCase().includes(n))
        );
        const hasHumanitiesSubjects = Array.isArray(matchedStudent.subjects) && matchedStudent.subjects.some(s =>
          HUMANITIES_ONLY_SUBJECT_CODES.has(String(s.code || '').toUpperCase()) ||
          HUMANITIES_ONLY_SUBJECT_NAMES.some(n => String(s.name || '').toLowerCase().includes(n))
        );

        const streamName = isHigherSec
          ? (rawStream.includes('scien') || (!rawStream.includes('human') && hasScienceSubjects)
              ? 'Science'
              : (rawStream.includes('human') || hasHumanitiesSubjects ? 'Humanities' : 'General'))
          : 'General';


        // Fetch fresh practicals data from Firestore (preferring live real-time docs, falling back to query/cache)
        let practicalDocs = livePracticalsDocs.length > 0 ? livePracticalsDocs : [];
        if (practicalDocs.length === 0) {
          try {
            const snap = await getDocs(collection(db, 'practicalsData'));
            practicalDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (pErr) {
            const cached = await getCachedCollection('practicalsData', false, 10 * 60 * 1000).catch(() => []);
            practicalDocs = cached || [];
          }
        }

        // Fallback to verified practicals seed dataset if live collection is empty/offline
        if (practicalDocs.length === 0) {
          try {
            const { CLEAN_PRACTICALS_SEED_DATA } = await import('../data/cleanPracticalsSeedData');
            if (Array.isArray(CLEAN_PRACTICALS_SEED_DATA)) {
              practicalDocs = CLEAN_PRACTICALS_SEED_DATA;
            }
          } catch (_) {}
        }

        // Identify and deduplicate matching teacher submission sections
        const matchingSections = filterAndDeduplicateSections(
          practicalDocs,
          selectedClass,
          selectedSession,
          selectedEvalType
        );

        // Multi-tier student record matcher against a teacher's section sheet
        const matchRecord = (rec) => {
          if (!rec) return false;
          const rName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const sName = String(matchedStudent.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const isNameMatch = Boolean(rName && sName && rName.length > 3 && (rName === sName || rName.includes(sName) || sName.includes(rName)));

          // 1. Board Registration Number (100% authoritative exact match)
          const rReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
          const sReg = identityKey(matchedStudent.boardRegNo || matchedStudent.regNo);
          if (rReg && sReg) {
            const isBothFull = rReg.length >= 8 && sReg.length >= 8;
            if (isBothFull) {
              if (rReg === sReg) {
                if (rName && sName && !isNameMatch) return false;
                return true;
              }
              return false; // Strict conflict rejection: differing registrations must NEVER match
            } else if (rReg === sReg) {
              if (rName && sName && !isNameMatch) return false;
              return true;
            }
          }

          // 2. Form Number
          const rForm = identityKey(rec.formNo || rec.fNo || rec.id);
          const sForm = identityKey(matchedStudent.fNo || matchedStudent.formNo);
          if (rForm && sForm && rForm === sForm) {
            if (rName && sName && !isNameMatch) {
              // Different student using same legacy form number; reject
            } else {
              return true;
            }
          }

          // 3. Class Roll Number or Exam Roll Number
          const rRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
          const sRoll = identityKey(matchedStudent.classRollNo);
          const sExamRoll = identityKey(matchedStudent.examRollNo);
          const isRollMatch = (rRoll && sRoll && rRoll === sRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a') ||
                              (rRoll && sExamRoll && rRoll === sExamRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a');

          // Prevent cross-stream / different student roll number collisions
          if (isRollMatch) {
            if (rName && sName && !isNameMatch) {
              return false;
            }
            return true;
          }

          if (isNameMatch) return true;

          return false;
        };

        // Compute normalized subject roster and overall performance descriptors
        const scorecardData = computeScorecardSubjects({
          matchedStudent,
          streamName,
          matchingSections,
          matchRecord,
          biologyDisplayMode,
          evalConfig: activeEvalConfig
        });

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
          verifiedFromCatalog: true,
          lookupContext: {
            matchedStudent,
            streamName,
            matchingSections,
            matchRecord
          },
          ...scorecardData
        });
        saveSearchToHistory({
          query: cleanQuery,
          className: matchedStudent.className || selectedClass,
          session: matchedStudent.session || selectedSession,
          evalType: selectedEvalType,
          candidateName: formatConsistentName(matchedStudent.name || '')
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

          <span className="hidden sm:flex text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 items-center gap-1">
            <ShieldCheck size={11} className="text-teal-600 dark:text-teal-400" />
            <span>Examination Results Portal • Session {selectedSession}</span>
          </span>
        </div>

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
                  onChange={(e) => {
                    const newEval = e.target.value;
                    setSelectedEvalType(newEval);
                    const matched = evalOptions.find(ev => (ev.evalType || ev.title) === newEval);
                    if (matched?.biologyDisplayMode) {
                      setBiologyDisplayMode(matched.biologyDisplayMode);
                    }
                  }}
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

          {/* Recent Searched Lookups Chips */}
          {recentSearches.length > 0 && !studentResult && (
            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap animate-fadeIn">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                <History size={10} />
                <span>Recent:</span>
              </span>
              {recentSearches.map((item, idx) => (
                <div
                  key={`${item.query}-${item.className || ''}-${idx}`}
                  className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 pl-2 pr-1 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-200 dark:hover:border-teal-800 transition-colors group cursor-pointer"
                  onClick={() => handleSelectRecent(item)}
                  title={`Class ${item.className || ''} - ${item.candidateName || item.query}`}
                >
                  <span className="truncate max-w-[110px] font-semibold text-slate-800 dark:text-slate-200">
                    {item.candidateName || item.query}
                  </span>
                  {item.candidateName && (
                    <span className="text-[9px] text-slate-400 ml-1 font-mono">
                      ({item.query})
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveRecent(item.query);
                    }}
                    className="ml-1 p-0.5 text-slate-400 hover:text-rose-500 rounded-full cursor-pointer"
                    title="Remove"
                    aria-label={`Remove ${item.query} from recent`}
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
              {recentSearches.length > 1 && (
                <button
                  type="button"
                  onClick={handleClearAllRecent}
                  className="text-[9.5px] font-semibold text-slate-400 hover:text-rose-500 ml-auto transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-start gap-1.5 animate-fadeIn">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Minimal, Clean and Modern Official Scorecard */}
        {/* Minimal, Clean and Modern Official Scorecard */}
        {activeResult && (
          <div
            id="official-scorecard-print"
            className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg sm:rounded-xl p-2.5 sm:p-5 print:p-2.5 shadow-xs space-y-2 sm:space-y-3 print:space-y-1.5 animate-fadeIn print:border-slate-300 print:bg-white print:rounded-md"
          >
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
              <div className="flex items-center justify-between sm:justify-center relative gap-1.5 mt-0.5 sm:mt-1 pb-1 sm:pb-0 border-b border-slate-100 dark:border-slate-800/80 sm:border-0">
                <div className="min-w-0 sm:text-center">
                  <h2 className="text-xs sm:text-base font-black uppercase tracking-tight text-slate-900 dark:text-white print:text-black m-0 leading-tight truncate">
                    <span className="sm:hidden">Student Scorecard</span>
                    <span className="hidden sm:inline">Student Evaluation Scorecard</span>
                  </h2>
                  <p className="text-[9.5px] sm:text-[10.5px] font-medium text-slate-500 dark:text-slate-400 print:text-slate-600 m-0 mt-0.5 truncate">
                    <strong className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{activeResult.evalTitle}</strong>
                    <span className="mx-1 opacity-40">•</span>
                    <span>Session {activeResult.session}</span>
                    <span className="mx-1 opacity-40">•</span>
                    <span>Class {activeResult.className}</span>
                  </p>
                </div>

                <div className="print:hidden sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSearchExpandedOnMobile(true)}
                    className="sm:hidden h-6 px-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                    title="Search for another candidate"
                  >
                    <RefreshCw size={9.5} />
                    <span>Search</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-6 px-2.5 rounded-md bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
                    title="Print / Save PDF Scorecard"
                  >
                    <Printer size={10.5} />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Candidate Identity Profile Box */}
            <div className="relative z-10 flex items-stretch gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 print:border-slate-300 print:bg-transparent print:p-2">
              {/* Photo Box: Compact on mobile screen, standard on desktop & print */}
              <div className="w-12 h-15 sm:w-16 sm:h-20 rounded-md sm:rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center print:border-slate-400 print:bg-transparent shadow-2xs">
                {activeResult.photoUrl && !activeResult.photoUrl.includes('drive.google.com') && !activeResult.photoUrl.includes('googleusercontent.com') ? (
                  <img
                    src={activeResult.photoUrl}
                    alt={activeResult.name}
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
                  <span className="text-[8px] sm:text-[8.5px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider block">
                    Candidate Name
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.2">
                    <span className="text-xs sm:text-base font-black text-slate-900 dark:text-white print:text-black leading-tight">
                      {activeResult.name}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 uppercase border border-teal-200/80 dark:border-teal-800/80 print:border-slate-400 print:text-slate-800 print:bg-transparent">
                      {activeResult.stream || 'General'}
                    </span>
                  </div>
                </div>

                {/* Mobile-Only Candidate Info: Distinct Parentage & Badges Row (Zero Overlap) */}
                <div className="sm:hidden space-y-1 pt-0.5">
                  <div className="text-[9.5px] text-slate-600 dark:text-slate-300 font-medium truncate">
                    <span className="text-slate-400 font-normal">S/o</span> <strong className="font-bold text-slate-800 dark:text-slate-200">{activeResult.fatherName || '—'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800/80 font-mono text-[9.5px] font-bold">
                      <span className="text-teal-600 dark:text-teal-400 font-sans text-[8.5px] uppercase font-semibold">Roll</span>
                      <span>{activeResult.classRollNo || '—'}</span>
                    </span>
                    {activeResult.boardRegNo && activeResult.boardRegNo !== '—' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">
                        <span className="text-slate-400 font-sans text-[8px] uppercase font-semibold">Reg</span>
                        <span className="font-bold">{activeResult.boardRegNo}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">
                        <span className="text-slate-400 font-sans text-[8px] uppercase font-semibold">Form</span>
                        <span className="font-bold">{activeResult.formNo || '—'}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Desktop & Print: Full 2-column info & 4 Attribute Cards */}
                <div className="hidden sm:block print:block space-y-2 mt-1">
                  <div className="sm:text-left">
                    <span className="text-[9px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider block">
                      Father's Name
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 print:text-black leading-tight mt-0.5">
                      {activeResult.fatherName || '—'}
                    </p>
                  </div>

                  {/* 4 Key Registration & Roll Attributes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Class</span>
                      <strong className="text-slate-800 dark:text-slate-200 print:text-black font-bold">{activeResult.className}</strong>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Class Roll No</span>
                      <strong className="text-teal-700 dark:text-teal-300 print:text-black font-bold">{activeResult.classRollNo || '—'}</strong>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Board Reg No</span>
                      <strong className="text-slate-800 dark:text-slate-200 print:text-black font-bold text-[11px] sm:text-xs">{activeResult.boardRegNo || '—'}</strong>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/50 print:bg-transparent p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 print:border-0 print:p-0 sm:text-right">
                      <span className="text-slate-400 print:text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Form No</span>
                      <strong className="text-slate-800 dark:text-slate-200 print:text-black font-bold">{activeResult.formNo || '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject-Wise Performance Table */}
            <div className="relative z-10 space-y-1 pt-0.5 sm:pt-1">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider pb-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>Academic Performance</span>
                  {activeResult.hasBiologySubjects && (
                    <div className="inline-flex items-center rounded-md p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 print:hidden">
                      <button
                        type="button"
                        onClick={() => setBiologyDisplayMode('combined')}
                        className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer ${
                          biologyDisplayMode === 'combined'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                        title="Combine Botany and Zoology into single 50M Biology"
                      >
                        Combined Bio (50M)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBiologyDisplayMode('separate')}
                        className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer ${
                          biologyDisplayMode === 'separate'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                        title="Display Botany and Zoology as separate 50M subjects"
                      >
                        Separate (BO & ZO)
                      </button>
                    </div>
                  )}
                </div>
                <span className="font-mono">
                  Tabulated: {activeResult.evaluatedCount || 0} / {activeResult.totalCount || 0}
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
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5 text-center w-16 sm:w-14 font-mono">
                        <span className="sm:hidden">Marks (50M)</span>
                        <span className="hidden sm:inline">Marks</span>
                      </th>
                      <th className="py-1 px-2 print:py-0.5 print:px-1.5 text-center w-28 sm:w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 print:divide-slate-200 text-[11px]">
                    {activeResult.subjects && activeResult.subjects.map((sub, idx) => (
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
                          <span className="font-semibold">{sub.subjectName === 'GE' || sub.subjectName === 'EN' ? 'General English' : sub.subjectName}</span>
                          <span className="text-[9px] text-slate-400 print:text-slate-500 font-mono ml-1">[{sub.subjectCode}]</span>
                          {sub.componentNote && (
                            <div className="text-[8.5px] sm:text-[9px] text-teal-700 dark:text-teal-400 font-mono font-medium print:text-slate-600 leading-tight">
                              {sub.componentNote}
                            </div>
                          )}
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
                        {activeResult.totalMax > 0 ? activeResult.totalMax : '—'}
                      </td>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono text-slate-400 print:text-slate-500 hidden sm:table-cell print:table-cell">—</td>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center font-mono font-black text-teal-800 dark:text-teal-300 print:text-black text-xs">
                        {activeResult.hasMarks ? activeResult.totalObtained : '—'}
                      </td>
                      <td className="py-1 px-2 print:py-0.5 print:px-1.5 text-center">
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold uppercase inline-block print:border print:border-slate-400 print:bg-transparent print:text-black ${
                          activeResult.resultStatus === 'EXCELLENT'
                            ? 'bg-emerald-700 text-white'
                            : activeResult.resultStatus === 'VERY GOOD'
                            ? 'bg-teal-700 text-white'
                            : activeResult.resultStatus === 'GOOD'
                            ? 'bg-sky-700 text-white'
                            : activeResult.resultStatus === 'SATISFACTORY' || activeResult.resultStatus === 'PASS'
                            ? 'bg-emerald-600 text-white'
                            : activeResult.resultStatus === 'IN PROGRESS' || activeResult.resultStatus === 'PROVISIONAL PASS'
                            ? 'bg-teal-700 text-white'
                            : activeResult.resultStatus === 'NEEDS IMPROVEMENT' || activeResult.resultStatus === 'RE-APPEAR' || activeResult.resultStatus === 'FAIL'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-600 text-white'
                        }`}>
                          {activeResult.resultStatus === 'RE-APPEAR' || activeResult.resultStatus === 'FAIL' ? 'NEEDS IMPROVEMENT' : activeResult.resultStatus}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Status Note under table */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 pt-1.5 sm:pt-0.5 text-[8.5px] sm:text-[9px] text-slate-500 dark:text-slate-400 print:text-slate-600 print:flex-row print:items-center print:justify-between print:pt-0.5">
                <div className="flex items-center gap-1 min-w-0">
                  <Clock size={10} className="text-teal-600 dark:text-teal-400 print:text-slate-500 shrink-0" />
                  <span className="font-semibold text-slate-600 dark:text-slate-300 print:text-slate-600">
                    {activeResult.evaluatedCount < activeResult.totalCount
                      ? 'Provisional Award Roll • Under Evaluation'
                      : 'Official Award Roll • Verified'
                    }
                  </span>
                </div>
                {activeResult.hasMarks && (
                  <div className="font-mono font-bold text-teal-700 dark:text-teal-300 print:text-black shrink-0 sm:text-right pl-3.5 sm:pl-0">
                    <span>
                      {activeResult.percentage} ({String(activeResult.division || 'In Progress').replace(/re-appear|fail/gi, 'Scope for Improvement')})
                    </span>
                  </div>
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
