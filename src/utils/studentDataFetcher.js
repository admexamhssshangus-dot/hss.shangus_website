/**
 * Unified Student Data Fetcher & Canonical Field Normalizer
 * 
 * Guarantees accurate on-demand retrieval of student records across
 * active admissions, master registers, and Firestore queries, while
 * normalizing all student field variations (Name, Father, Class, Stream, Session).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getCachedCollectionSync,
  getMasterRegistersScoped
} from '../services/dbCache';
import {
  getAssignedClassRollNumber,
  resolveStudentAdmissionStatus,
  isStudentExamDropped
} from './studentApprovalStatus';

// Name resolution keys in priority order
const STUDENT_NAME_KEYS = Object.freeze([
  'studentName',
  "Student's Name (as per school records)",
  "Student's Name",
  'Candidate Name',
  'Candidate Name.',
  'Name of Candidate',
  'name',
  'Name',
  'Full Name',
  'fullName',
  'Student Name',
  'student_name',
  'Name of Student',
  'NAME',
  'CANDIDATE NAME'
]);

// Father's name resolution keys
const FATHER_NAME_KEYS = Object.freeze([
  'fatherName',
  "Father's Name (as per school records)",
  "Father's Name",
  'Father Name',
  'Father Name.',
  'Father Name (as per school records)',
  'father',
  'Father',
  'parentage',
  'Parentage',
  'father_name',
  'FATHER NAME',
  'FATHER',
  'Father / Guardian Name',
  'Guardian Name'
]);

// Class resolution keys
const CLASS_KEYS = Object.freeze([
  'class',
  'Class',
  'className',
  'Admission sought for class',
  'appliedClass',
  'enrolledClass',
  'class_name',
  'std',
  'Standard'
]);

// Stream resolution keys
const STREAM_KEYS = Object.freeze([
  'stream',
  'Stream',
  'STREAM',
  'selectedStream',
  'Stream for Class 12th',
  'Stream for Class 11th',
  'Stream opted in Class 11th',
  'Stream Studied in Class 11th',
  'Stream & Subjects for Class 12th',
  'subject_stream',
  'Stream / Faculty',
  'Faculty',
  'faculty',
  'stream_name'
]);

// Session resolution keys
const SESSION_KEYS = Object.freeze([
  'session',
  'Session',
  'SESSION',
  'academicSession',
  'academic_session',
  'Academic Session',
  'session_name'
]);

/**
 * Resolves the display name of a student across all schema variations.
 */
export function getStudentDisplayName(s) {
  if (!s || typeof s !== 'object') return 'Student';
  const raw = s.raw || s._rawStudent || s;

  for (const k of STUDENT_NAME_KEYS) {
    const val = s[k] !== undefined && s[k] !== null ? s[k] : raw[k];
    if (val && typeof val === 'string' && val.trim() && !/^(n\/?a|—|-|null|undefined)$/i.test(val.trim())) {
      return val.trim();
    }
  }

  // Fallback: Check if formNo or ID exists
  const fNo = s.formNo || raw.formNo || s['Form No.'] || raw['Form No.'];
  if (fNo) return `Student (Form #${fNo})`;

  return 'Student';
}

/**
 * Resolves the father/parent name of a student.
 */
export function getStudentFatherName(s) {
  if (!s || typeof s !== 'object') return '—';
  const raw = s.raw || s._rawStudent || s;

  for (const k of FATHER_NAME_KEYS) {
    const val = s[k] !== undefined && s[k] !== null ? s[k] : raw[k];
    if (val && typeof val === 'string' && val.trim() && !/^(n\/?a|—|-|null|undefined)$/i.test(val.trim())) {
      return val.trim();
    }
  }

  return '—';
}

/**
 * Resolves the enrolled or applied class string (e.g. "12th", "11th", "10th", "9th").
 */
export function getStudentClass(s) {
  if (!s || typeof s !== 'object') return '';
  const raw = s.raw || s._rawStudent || s;

  for (const k of CLASS_KEYS) {
    const val = s[k] !== undefined && s[k] !== null ? s[k] : raw[k];
    if (val && String(val).trim()) {
      const clean = String(val).trim();
      const m = clean.match(/\b(12|11|10|9)\b/);
      if (m) return `${m[1]}th`;
      return clean;
    }
  }

  return '';
}

/**
 * Resolves the stream of a student (Science, Humanities, Commerce, etc.).
 */
export function getStudentStream(s) {
  if (!s || typeof s !== 'object') return 'General';
  const raw = s.raw || s._rawStudent || s;

  for (const k of STREAM_KEYS) {
    const val = s[k] !== undefined && s[k] !== null ? s[k] : raw[k];
    if (val && typeof val === 'string' && val.trim() && !/^(n\/?a|—|-|null|undefined)$/i.test(val.trim())) {
      const clean = val.trim();
      if (/same as/i.test(clean)) continue;
      if (/sci|med/i.test(clean)) return 'Science';
      if (/art|hum|soc/i.test(clean)) return 'Humanities';
      if (/com/i.test(clean)) return 'Commerce';
      if (/general/i.test(clean)) continue;
      return clean;
    }
  }

  // Infer from enrolled / studied subjects
  const subStr = String(
    s['Subjects to be taken in Class 11th'] ||
    s['Subjects Studied in Class 11th'] ||
    s['Subjects to be taken in Class 12th'] ||
    s['Subjects Studied in Class 12th'] ||
    s.subjects ||
    s.selectedSubjects ||
    s.subjectCombination ||
    raw['Subjects to be taken in Class 11th'] ||
    raw['Subjects Studied in Class 11th'] ||
    raw['Subjects to be taken in Class 12th'] ||
    raw['Subjects Studied in Class 12th'] ||
    raw.subjects ||
    raw.selectedSubjects ||
    raw.subjectCombination ||
    ''
  ).toLowerCase();

  if (
    subStr.includes('physic') || subStr.includes('chemist') || subStr.includes('biolog') ||
    subStr.includes('botany') || subStr.includes('zoology') || subStr.includes('mathematics') ||
    subStr.includes('math')
  ) {
    return 'Science';
  }
  if (
    subStr.includes('history') || subStr.includes('political') || subStr.includes('education') ||
    subStr.includes('urdu') || subStr.includes('econom') || subStr.includes('sociolog') ||
    subStr.includes('arabic') || subStr.includes('kashmiri')
  ) {
    return 'Humanities';
  }
  if (subStr.includes('account') || subStr.includes('business') || subStr.includes('commerce')) {
    return 'Commerce';
  }

  const cls = String(s.Class || s.class || s['Admission sought for class'] || raw.Class || raw.class || '').toLowerCase();
  if (cls.includes('9') || cls.includes('10')) return 'General';

  return 'General';
}

/**
 * Resolves the raw or normalized academic session of a student.
 */
export function getStudentSession(s) {
  if (!s || typeof s !== 'object') return '';
  const raw = s.raw || s._rawStudent || s;

  for (const k of SESSION_KEYS) {
    const val = s[k] !== undefined && s[k] !== null ? s[k] : raw[k];
    if (val && String(val).trim()) {
      return String(val).trim();
    }
  }

  return '';
}

/**
 * Flexible check whether a student record belongs to the target academic session.
 */
export function isStudentInSession(student, targetSession) {
  if (!targetSession || targetSession === 'ALL' || targetSession === 'all' || targetSession === 'All Sessions') {
    return true;
  }

  const studentSes = getStudentSession(student);
  if (!studentSes) {
    // If student has no session, assume live current session if looking for 2025-26
    const cleanTarget = String(targetSession).toLowerCase().replace(/session\s*/i, '').trim();
    return cleanTarget.includes('2025-26') || cleanTarget.includes('2026');
  }

  const sNorm = studentSes.toLowerCase().replace(/session\s*/i, '').replace(/[\u2013\u2014]/g, '-').trim();
  const tNorm = String(targetSession).toLowerCase().replace(/session\s*/i, '').replace(/[\u2013\u2014]/g, '-').trim();

  if (sNorm === tNorm) return true;

  // Year range match (e.g. "2025-26")
  const sYears = sNorm.match(/\d{4}-\d{2,4}/);
  const tYears = tNorm.match(/\d{4}-\d{2,4}/);
  if (sYears && tYears && sYears[0] === tYears[0]) return true;

  return sNorm.includes(tNorm) || tNorm.includes(sNorm);
}

/**
 * Normalizes a student record into a clean unified shape, preserving all original fields.
 */
export function normalizeStudentRecord(s) {
  if (!s || typeof s !== 'object') return null;

  const displayName = getStudentDisplayName(s);
  const fatherName = getStudentFatherName(s);
  const studentClass = getStudentClass(s);
  const stream = getStudentStream(s);
  const session = getStudentSession(s);
  const classRoll = getAssignedClassRollNumber(s);
  const status = resolveStudentAdmissionStatus(s);
  const isDropped = isStudentExamDropped(s);

  return {
    ...s,
    id: s.id || s._id || s.docId || s._docId || s.formNo || Math.random().toString(36).slice(2),
    studentName: displayName,
    name: displayName,
    fatherName: fatherName,
    father: fatherName,
    class: studentClass,
    className: studentClass,
    stream: stream,
    session: session,
    classRollNo: classRoll,
    rollNo: classRoll || s.rollNo || s.roll || '',
    admissionStatus: status,
    status: status,
    isExamDropped: isDropped,
  };
}

/**
 * Memory cache of session-specific on-demand student queries
 */
const sessionQueryCache = new Map();

/**
 * Fetches all student records for a specific session on demand from Firestore,
 * checking in-memory cache, active admissions, master registers, and Firestore queries.
 */
export async function fetchStudentsForSessionOnDemand(session, options = {}) {
  const cleanSession = String(session || '2025-26')
    .replace(/session\s*/i, '')
    .trim();

  // 1. Check local sessionQueryCache
  if (!options.forceRefresh && sessionQueryCache.has(cleanSession)) {
    return sessionQueryCache.get(cleanSession);
  }

  const results = [];
  const seenIds = new Set();

  const addUnique = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((st) => {
      if (!st) return;
      const norm = normalizeStudentRecord(st);
      if (!norm) return;
      const key = String(norm.id || norm.docId || norm.formNo || `${norm.name}_${norm.fatherName}_${norm.classRollNo}`).toLowerCase();
      if (!seenIds.has(key)) {
        seenIds.add(key);
        results.push(norm);
      }
    });
  };

  // 2. Search currently cached admissions
  const cachedAdmissions = getCachedCollectionSync('admissions') || [];
  const sessionMatches = cachedAdmissions.filter((s) => isStudentInSession(s, cleanSession));
  addUnique(sessionMatches);

  // 3. Search cached masterRegisters
  const cachedMaster = getCachedCollectionSync('masterRegisters') || [];
  const masterMatches = cachedMaster.filter((s) => isStudentInSession(s, cleanSession));
  addUnique(masterMatches);

  // 4. If window cache has master records, check them
  if (typeof window !== 'undefined' && Array.isArray(window._hssMasterRegistersCache)) {
    const winMatches = window._hssMasterRegistersCache.filter((s) => isStudentInSession(s, cleanSession));
    addUnique(winMatches);
  }

  // 5. If we still have few or zero records for a historical session, query Firestore
  if (results.length === 0 || options.forceRefresh) {
    try {
      // Query admissions collection for session
      const q = query(collection(db, 'admissions'), where('session', '==', cleanSession));
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ ...d.data(), id: d.id, _docId: d.id }));
      addUnique(fetched);

      // If still empty, try capitalized 'Session'
      if (results.length === 0) {
        const qCap = query(collection(db, 'admissions'), where('Session', '==', cleanSession));
        const snapCap = await getDocs(qCap);
        const fetchedCap = snapCap.docs.map((d) => ({ ...d.data(), id: d.id, _docId: d.id }));
        addUnique(fetchedCap);
      }

      // If still empty and it's a past session, query masterRegistersScoped
      if (results.length === 0) {
        const masterList = await getMasterRegistersScoped({ forceAll: true });
        const filteredMaster = (masterList || []).filter((s) => isStudentInSession(s, cleanSession));
        addUnique(filteredMaster);
      }
    } catch (err) {
      console.warn('[studentDataFetcher] Firestore query note:', err);
    }
  }

  // 6. Offline / Fallback Seed Data: Ensure the user always has genuine records
  if (results.length === 0) {
    try {
      const verifiedModule = await import('../data/verifiedStudentsCatalog.json');
      const verifiedList = verifiedModule.default || verifiedModule;
      if (Array.isArray(verifiedList)) {
        const verifiedMatches = verifiedList.filter((s) => isStudentInSession(s, cleanSession));
        addUnique(verifiedMatches);
      }
    } catch (_) {}
  }

  sessionQueryCache.set(cleanSession, results);
  return results;
}
