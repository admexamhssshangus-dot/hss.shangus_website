/**
 * JKBOSE Subject Roll Return Series Formatter & Examinee Aggregator
 * 
 * Formats examinee roll numbers into standard JKBOSE circular notation:
 * "separate continuous series by 'TO' & single Roll No's by 'Comma'"
 * Example: "31601201 TO 31601245, 31601250, 31601255 TO 31601270"
 */

import { isStudentAdmissionApproved, isStudentExamDropped, getAssignedClassRollNumber } from './studentApprovalStatus';
import { checkIsStudentDropped } from '../services/examineeDropService';

// Board exam roll number keys in priority order
export const BOARD_ROLL_KEYS = Object.freeze([
  'currExamRollNo',
  'currExamRoll',
  'Exam R.No. (Current)',
  'Exam R. No. (Current)',
  'Exam Roll No. (Board)',
  'Exam Roll No.(Board)',
  'Exam Roll No (Board)',
  'Exam Roll (Board)',
  'boardRollNo',
  'boardRoll',
  'Board Roll No',
  'Board Roll No.',
  'Board Roll Number',
  'Board Roll',
  'examRollNo',
  'Exam Roll No',
  'Exam Roll No.',
  'Exam Roll Number',
  'Exam R.No.',
  'Exam R.No',
  'Exam R. No.',
  'Exam R. No',
  'jkboseRollNo',
  'jkboseRoll',
  'jkbose_roll_no',
  'board_roll_no',
  'exam_roll_no',
]);

// Canonical subject sort order for Higher Secondary and Secondary
export const CANONICAL_SUBJECT_ORDER = Object.freeze([
  'General English',
  'English',
  'Physics',
  'Chemistry',
  'Biology',
  'Botany',
  'Zoology',
  'Mathematics',
  'Computer Science',
  'Information Practices',
  'Environmental Science',
  'Political Science',
  'History',
  'Economics',
  'Education',
  'Sociology',
  'Geography',
  'Physical Education',
  'Physical Education (PD)',
  'Urdu',
  'Kashmiri',
  'Hindi',
  'Arabic',
  'Persian',
  'Healthcare',
  'IT and ITES',
  'General Science',
  'Science',
  'Social Science',
]);

/**
 * Extracts the appropriate examinee roll number based on chosen source preference.
 * 'auto': prefer board exam roll no, fallback to assigned class roll no.
 * 'board': strictly board exam roll no.
 * 'class': strictly assigned class roll no.
 */
export function extractExamineeRollNumber(student, rollType = 'auto') {
  if (!student || typeof student !== 'object') return '';
  const raw = student.raw || student._rawStudent || student;

  if (rollType === 'class') {
    return getAssignedClassRollNumber(student);
  }

  // Check board exam roll keys
  for (const key of BOARD_ROLL_KEYS) {
    const val = student[key] !== undefined && student[key] !== null ? student[key] : raw[key];
    if (val !== undefined && val !== null) {
      const clean = String(val).trim();
      if (clean && !/^(?:0|n\/?a|na|none|nil|null|undefined|pending|-|—)$/i.test(clean)) {
        return clean;
      }
    }
  }

  if (rollType === 'board') return '';

  // Fallback to assigned class roll number in 'auto' mode
  return getAssignedClassRollNumber(student);
}

/**
 * Parses and splits raw student subjects into a clean list of trimmed subject strings.
 */
export function extractStudentSubjects(student) {
  if (!student || typeof student !== 'object') return [];
  const raw = student.raw || student._rawStudent || student;

  const collected = [];

  // Check array or string subjects
  const subjectSources = [
    student.subjects,
    raw.subjects,
    student.assignedSubjects,
    raw.assignedSubjects,
    student.Subjects,
    raw.Subjects,
    student.subjectList,
    raw.subjectList,
  ];

  subjectSources.forEach((src) => {
    if (Array.isArray(src)) {
      src.forEach((item) => {
        if (typeof item === 'string' && item.trim()) collected.push(item.trim());
        else if (item && typeof item === 'object' && item.name) collected.push(String(item.name).trim());
      });
    } else if (typeof src === 'string' && src.trim()) {
      src.split(/[,;\n\r/|]+/).forEach((sub) => {
        const c = sub.trim();
        if (c) collected.push(c);
      });
    }
  });

  // Individual subject columns fallback (Subject 1, Subject 2, etc.)
  for (let i = 1; i <= 6; i++) {
    const val = student[`subject${i}`] || raw[`subject${i}`] || student[`Subject ${i}`] || raw[`Subject ${i}`] || student[`Subjects${i}`] || raw[`Subjects${i}`];
    if (typeof val === 'string' && val.trim()) {
      const trimmed = val.trim();
      if (!/^(?:-|—|–|none|nil|na|n\/a|null|undefined)$/i.test(trimmed)) {
        collected.push(trimmed);
      }
    }
  }

  // Compulsory subject defaults if empty
  if (collected.length === 0) {
    const stream = String(student.stream || raw.stream || student.Stream || raw.Stream || '').trim().toLowerCase();
    const cls = normalizeExamineeClass(student.appliedClass || student.class || raw.class || '');
    if (cls === '11th' || cls === '12th') {
      collected.push('General English', 'Environmental Science');
      if (stream.includes('med') || stream.includes('bio')) collected.push('Physics', 'Chemistry', 'Biology');
      else if (stream.includes('non-med') || stream.includes('math')) collected.push('Physics', 'Chemistry', 'Mathematics');
      else if (stream.includes('art') || stream.includes('human')) collected.push('Political Science', 'History', 'Urdu');
    } else if (cls === '9th' || cls === '10th') {
      collected.push('English', 'Mathematics', 'Science', 'Social Science', 'Urdu');
    }
  }

  // Deduplicate and normalize case
  const seen = new Set();
  const result = [];
  collected.forEach((sub) => {
    const normalized = normalizeSubjectName(sub);
    if (normalized && !/^(?:-|—|–|none|nil|na|n\/a|null|undefined)$/i.test(normalized) && !seen.has(normalized.toLowerCase())) {
      seen.add(normalized.toLowerCase());
      result.push(normalized);
    }
  });

  return result;
}

/**
 * Canonicalizes common subject spelling and abbreviations.
 */
export function normalizeSubjectName(name) {
  if (!name || typeof name !== 'string') return '';
  const clean = name.trim();
  if (!clean || /^(?:-|—|–|none|nil|na|n\/a|null|undefined)$/i.test(clean)) return '';
  const lower = clean.toLowerCase();

  if (/^(?:gen(?:eral)?\.?\s*eng(?:lish)?|eng\b)/i.test(lower)) {
    if (lower.includes('10th') || lower.includes('9th') || lower === 'english') return 'English';
    return 'General English';
  }
  // Environmental Science & ES Consolidation
  if (/^(?:e(?:nv(?:ironmental)?)?\.?\s*sc(?:i(?:ence)?)?|es|e\.s|e\.s\.|evs|e\.v\.s)$/i.test(lower) || lower.includes('environmental')) {
    return 'Environmental Science';
  }
  // Healthcare & HTC Consolidation
  if (/^(?:htc|h\.t\.c|h\.t\.c\.|hc|healthcare|health\s*care)/i.test(lower) || lower.includes('healthcare') || lower.includes('health care')) {
    return 'Healthcare';
  }
  // IT & ITES Consolidation
  if (/^(?:it\s*(?:&|and|\/|\+)?\s*ites?|information\s*technology)/i.test(lower) || lower.includes('ites') || lower.includes('it & ites')) {
    return 'IT and ITES';
  }
  if (/^phy(?:sics)?\b/i.test(lower)) return 'Physics';
  if (/^chem(?:istry)?\b/i.test(lower)) return 'Chemistry';
  if (/^bio(?:logy)?\b/i.test(lower)) return 'Biology';
  if (/^bot(?:any)?\b/i.test(lower)) return 'Botany';
  if (/^zoo(?:logy)?\b/i.test(lower)) return 'Zoology';
  if (/^math(?:ematics)?\b/i.test(lower)) return 'Mathematics';
  if (/^comp(?:uter)?\.?\s*sc(?:i(?:ence)?)?/i.test(lower)) return 'Computer Science';
  if (/^pol(?:itical)?\.?\s*sc(?:i(?:ence)?)?/i.test(lower)) return 'Political Science';
  if (/^hist(?:ory)?\b/i.test(lower)) return 'History';
  if (/^eco(?:nomics)?\b/i.test(lower)) return 'Economics';
  if (/^edu(?:cation)?\b/i.test(lower)) return 'Education';
  if (/^soc(?:iology)?\b/i.test(lower)) return 'Sociology';
  if (/^phy(?:sical)?\.?\s*edu(?:cation)?/i.test(lower)) return 'Physical Education';
  if (/^urdu\b/i.test(lower)) return 'Urdu';
  if (/^kash(?:miri)?\b/i.test(lower)) return 'Kashmiri';
  if (/^hindi\b/i.test(lower)) return 'Hindi';
  if (/^arabic\b/i.test(lower)) return 'Arabic';

  return clean;
}

/**
 * Normalizes class strings to '10th', '11th', '12th', '9th'.
 */
export function normalizeExamineeClass(rawClass) {
  if (!rawClass) return '12th';
  const str = String(rawClass).trim().toLowerCase();
  if (str.includes('12') || str.includes('xii') || str.includes('hse-ii') || str.includes('hse 2')) return '12th';
  if (str.includes('11') || str.includes('xi') || str.includes('hse-i') || str.includes('hse 1')) return '11th';
  if (str.includes('10') || str.includes('x') || str.includes('matric') || str.includes('sse')) return '10th';
  if (str.includes('9') || str.includes('ix')) return '9th';
  return '12th';
}

/**
 * Formats a list of roll numbers into continuous series with "TO" and single numbers with ",".
 * 
 * Examples:
 *   [2101, 2102, 2103, 2105, 2108, 2109, 2110, 2115]
 *   => "2101 TO 2103, 2105, 2108 TO 2110, 2115"
 * 
 * Handles pure numbers, large board numbers (e.g. 31601201), and prefixed numbers (e.g. AR-101).
 * 
 * @param {Array<string|number>} rollNumbers - Array of roll numbers
 * @param {Object} options - Configuration options
 * @param {number} options.minSeriesLength - Minimum consecutive items to collapse with "TO" (default: 2)
 * @returns {string} Formatted series string
 */
export function formatRollNumberSeries(rollNumbers = [], options = {}) {
  const { minSeriesLength = 2 } = options;
  if (!Array.isArray(rollNumbers) || rollNumbers.length === 0) return 'NIL';

  // 1. Clean & tokenize roll numbers
  const cleaned = rollNumbers
    .map((r) => String(r || '').trim())
    .filter((r) => r.length > 0 && !/^(?:0|n\/?a|nil|null|none|-|—)$/i.test(r));

  if (cleaned.length === 0) return 'NIL';

  // 2. Separate into items with numeric parsing and natural sort
  const parsedItems = cleaned.map((orig) => {
    // Check if ends with digits (e.g. "31601201" or "R-101")
    const match = orig.match(/^(.*?)(\d+)$/);
    if (match) {
      return {
        original: orig,
        prefix: match[1],
        num: parseInt(match[2], 10),
        digits: match[2].length,
      };
    }
    return {
      original: orig,
      prefix: orig,
      num: null,
      digits: 0,
    };
  });

  // Sort natural: prefix first, then numeric value, then original string
  parsedItems.sort((a, b) => {
    if (a.prefix !== b.prefix) return a.prefix.localeCompare(b.prefix, undefined, { numeric: true });
    if (a.num !== null && b.num !== null) {
      if (a.num < b.num) return -1;
      if (a.num > b.num) return 1;
      return 0;
    }
    return a.original.localeCompare(b.original, undefined, { numeric: true });
  });

  // 3. Deduplicate
  const uniqueItems = [];
  for (const item of parsedItems) {
    if (uniqueItems.length === 0 || uniqueItems[uniqueItems.length - 1].original !== item.original) {
      uniqueItems.push(item);
    }
  }

  // 4. Group consecutive runs per prefix
  const groups = [];
  let currentRun = [];

  for (let i = 0; i < uniqueItems.length; i++) {
    const item = uniqueItems[i];

    if (currentRun.length === 0) {
      currentRun.push(item);
      continue;
    }

    const prev = currentRun[currentRun.length - 1];
    const isConsecutive =
      item.prefix === prev.prefix &&
      item.num !== null &&
      prev.num !== null &&
      item.num === prev.num + 1 &&
      item.digits === prev.digits;

    if (isConsecutive) {
      currentRun.push(item);
    } else {
      groups.push(currentRun);
      currentRun = [item];
    }
  }
  if (currentRun.length > 0) groups.push(currentRun);

  // 5. Build output tokens
  const tokens = groups.map((run) => {
    if (run.length >= minSeriesLength) {
      return `${run[0].original} TO ${run[run.length - 1].original}`;
    }
    return run.map((it) => it.original).join(', ');
  });

  return tokens.join(', ');
}

/**
 * Aggregates approved, non-dropped examinees by class and subject.
 * 
 * @param {Array<Object>} students - Array of student records
 * @param {Object} options - Configuration options
 * @param {string} options.selectedClass - Class filter ('12th', '11th', '10th', or 'all')
 * @param {string} options.rollType - 'auto' | 'board' | 'class'
 * @returns {Object} { classWiseData: { [cls]: { subjects: [...], kpis: {...} } }, allSubjects: [...] }
 */
export function buildJkboseSubjectRollData(students = [], options = {}) {
  const { selectedClass = '12th', rollType = 'auto' } = options;

  const validClasses = selectedClass === 'all'
    ? ['12th', '11th', '10th', '9th']
    : [normalizeExamineeClass(selectedClass)];

  const classWiseData = {};

  validClasses.forEach((cls) => {
    classWiseData[cls] = {
      className: cls,
      label: cls === '12th'
        ? 'Higher Secondary Part-II (Class 12th)'
        : cls === '11th'
        ? 'Higher Secondary Part-I (Class 11th)'
        : cls === '10th'
        ? 'Secondary School Examination (Class 10th)'
        : `Class ${cls}`,
      examinationName: cls === '12th'
        ? 'ANNUAL REGULAR 2026 (HSE-II)'
        : cls === '11th'
        ? 'ANNUAL REGULAR 2026 (HSE-I)'
        : 'ANNUAL REGULAR 2026',
      subjects: [],
      examinees: [],
      droppedExaminees: [],
      kpis: {
        totalEnrolled: 0,
        totalApproved: 0,
        totalDropped: 0,
        activeExaminees: 0,
        totalSubjects: 0,
      },
    };
  });

  // Filter & group students
  (students || []).forEach((student) => {
    const rawClass = student.appliedClass || student.class || student.enrolledClass || '';
    const normClass = normalizeExamineeClass(rawClass);

    if (!classWiseData[normClass]) return;

    const isApproved = isStudentAdmissionApproved(student);
    const isDropped = checkIsStudentDropped(student, options.dropOverrides) || isStudentExamDropped(student);

    classWiseData[normClass].kpis.totalEnrolled += 1;

    if (!isApproved) return;

    classWiseData[normClass].kpis.totalApproved += 1;

    if (isDropped) {
      classWiseData[normClass].kpis.totalDropped += 1;
      classWiseData[normClass].droppedExaminees.push(student);
      return;
    }

    classWiseData[normClass].kpis.activeExaminees += 1;
    classWiseData[normClass].examinees.push(student);
  });

  // For each class, compile subject-wise roll returns
  Object.keys(classWiseData).forEach((cls) => {
    const data = classWiseData[cls];
    const subjectMap = new Map();

    data.examinees.forEach((student) => {
      const rollNo = extractExamineeRollNumber(student, rollType);
      if (!rollNo) return;

      const subjects = extractStudentSubjects(student);
      subjects.forEach((sub) => {
        if (!subjectMap.has(sub)) {
          subjectMap.set(sub, []);
        }
        subjectMap.get(sub).push(rollNo);
      });
    });

    // Sort subjects canonical
    const subjectNames = Array.from(subjectMap.keys()).sort((a, b) => {
      const idxA = CANONICAL_SUBJECT_ORDER.indexOf(a);
      const idxB = CANONICAL_SUBJECT_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    data.subjects = subjectNames.map((sub, index) => {
      const rolls = subjectMap.get(sub) || [];
      const formattedSeries = formatRollNumberSeries(rolls);
      return {
        sNo: index + 1,
        subject: sub,
        candidateCount: rolls.length,
        rollNumbersSeries: formattedSeries,
        rawRollNumbers: rolls,
      };
    });

    data.kpis.totalSubjects = data.subjects.length;
    data.centreNo = detectExamineeCentreNo(data.examinees, cleanCentreNoDisplay(options.centreNo || ''));
  });

  return {
    selectedClass,
    classWiseData,
    detectedCentreNo: detectExamineeCentreNo(students, cleanCentreNoDisplay(options.centreNo || '')),
    activeClasses: Object.keys(classWiseData).filter((k) => classWiseData[k].kpis.totalApproved > 0 || classWiseData[k].subjects.length > 0),
  };
}

/**
 * Strips duplicate prefixes like "Centre No:", "Centre No.", "Centre Code:" from a centre string.
 */
export function cleanCentreNoDisplay(val) {
  if (!val) return '';
  return String(val)
    .replace(/^centre\s*(?:no\.?|code|num)?[:\s-]*/i, '')
    .trim();
}

/**
 * Automatically detects the JKBOSE examination centre number(s) from student records
 * or derives it from 9-digit (first 6 digits) or 8-digit (first 5 digits) examinee roll numbers.
 */
export function detectExamineeCentreNo(students = [], fallback = '') {
  if (!Array.isArray(students) || students.length === 0) return cleanCentreNoDisplay(fallback);

  // 1. Check for explicit centre number in student records
  const explicitCentres = new Set();
  students.forEach((st) => {
    if (!st || typeof st !== 'object') return;
    const raw = st.raw || st._rawStudent || st;
    const explicit = st.centreNo || raw.centreNo ||
                     st['Centre No.'] || raw['Centre No.'] ||
                     st['Centre No'] || raw['Centre No'] ||
                     st['Centre'] || raw['Centre'] ||
                     st.examCentre || raw.examCentre ||
                     st['Exam Centre'] || raw['Exam Centre'] || '';
    if (explicit && !/^(?:n\/?a|nil|null|none|—|-)$/i.test(String(explicit).trim())) {
      const clean = cleanCentreNoDisplay(explicit);
      if (clean) explicitCentres.add(clean);
    }
  });

  if (explicitCentres.size > 0) {
    return Array.from(explicitCentres).sort().join(', ');
  }

  // 2. Automatically derive from Board Exam Roll Numbers
  const derivedCentres = new Set();
  students.forEach((st) => {
    const roll = extractExamineeRollNumber(st, 'auto');
    const digits = String(roll || '').replace(/\D/g, '');
    if (digits.length === 9) {
      // 9-digit roll (e.g. 301003001) -> First 6 digits indicate centre (301003)
      derivedCentres.add(digits.slice(0, 6));
    } else if (digits.length === 8) {
      // 8-digit roll (e.g. 31601201) -> First 5 digits indicate centre (31601)
      derivedCentres.add(digits.slice(0, 5));
    } else if (digits.length >= 7) {
      derivedCentres.add(digits.slice(0, 6));
    } else if (digits.length === 5 || digits.length === 6) {
      derivedCentres.add(digits);
    }
  });

  if (derivedCentres.size > 0) {
    return Array.from(derivedCentres).sort().join(', ');
  }

  return cleanCentreNoDisplay(fallback);
}
