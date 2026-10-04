/**
 * practicalsPdfGenerator.js — Official Practicals & Awards Print Generator
 * Govt. Higher Secondary School Shangus, Anantnag
 *
 * 1. Individual Award Roll (Screenshot 2 format): 2-column 50-student/page layout with centre numbers & figures-to-words.
 * 2. Consolidated Cover Letter & Award Matrix (Screenshots 3 & 4 format): Page 1 forwarding letter + Page 2+ hash total matrix.
 * 3. Individual Work Sheet (Screenshot 5 format): Practical/Viva/Overall subject record.
 */

import { getSubjectMarksConfig, isTeacherSubjectMatch, getSubjectDisplayName, normalizePracticalSession, isMatchingSubjectCode } from './practicalsSettingsManager';
import { toTitleCase } from './textFormatting';
import { isStudentExamDropped, checkStudentApprovalState, isStudentApprovedForPracticals } from './studentApprovalStatus';

export { checkStudentApprovalState, isStudentApprovedForPracticals };

export function numberToWordsInr(num) {
  if (!num || num === 'AB' || num === 'A' || String(num).toUpperCase() === 'ABSENT') return '-';
  const n = parseInt(num, 10);
  if (isNaN(n)) return String(num);
  const words = [
    'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
    'Twenty One', 'Twenty Two', 'Twenty Three', 'Twenty Four', 'Twenty Five', 'Twenty Six', 'Twenty Seven', 'Twenty Eight', 'Twenty Nine', 'Thirty',
    'Thirty One', 'Thirty Two', 'Thirty Three', 'Thirty Four', 'Thirty Five', 'Thirty Six', 'Thirty Seven', 'Thirty Eight', 'Thirty Nine', 'Forty'
  ];
  return (words[n] || String(n)) + ' Only';
}

/**
 * Resolves official award roll header title, examination label, and short type
 * from evaluationType / practicalType string or fallback isExternal flag.
 */
export function resolveAwardRollTitles(evaluationType = '', isExternal = false) {
  const typeStr = String(evaluationType || '').trim();
  const typeLower = typeStr.toLowerCase();

  // 1. Pre-Board Test / Examination
  if (typeLower.includes('pre-board') || typeLower.includes('preboard')) {
    return {
      heading: 'PRE-BOARD TEST AWARD ROLL',
      examLabel: 'Pre-Board Test',
      shortType: 'Pre-Board',
      badgeClass: 'preboard'
    };
  }

  // 2. Term End Examination / Evaluation
  if (typeLower.includes('term end') || typeLower.includes('term-end') || typeLower.includes('termend')) {
    return {
      heading: 'TERM END EXAMINATION AWARD ROLL',
      examLabel: 'Term End Examination',
      shortType: 'Term End',
      badgeClass: 'termend'
    };
  }

  // 3. Golden Test
  if (typeLower.includes('golden')) {
    return {
      heading: 'GOLDEN TEST AWARD ROLL',
      examLabel: 'Golden Test',
      shortType: 'Golden Test',
      badgeClass: 'golden'
    };
  }

  // 4. Unit Test (e.g. Unit Test - 1, Unit Test 2)
  if (typeLower.includes('unit test') || typeLower.includes('unit-test')) {
    return {
      heading: `${typeStr.toUpperCase()} AWARD ROLL`,
      examLabel: typeStr,
      shortType: typeStr,
      badgeClass: 'unittest'
    };
  }

  // 5. External Practical
  if (typeLower.includes('external') || (!typeStr && isExternal)) {
    return {
      heading: 'EXTERNAL PRACTICAL AWARD ROLL',
      examLabel: 'External Practical',
      shortType: 'External',
      badgeClass: 'external'
    };
  }

  // 6. Internal Assessment / Practical
  if (typeLower.includes('internal') || typeLower.includes('assessment')) {
    return {
      heading: 'INTERNAL PRACTICAL AWARD ROLL',
      examLabel: 'Internal Practical',
      shortType: 'Internal',
      badgeClass: 'internal'
    };
  }

  // 7. Custom / other specific examination
  if (typeStr && !/^(all|na|n\/a|undefined|null)$/i.test(typeStr)) {
    const cleanUpper = typeStr.toUpperCase().replace(/\s+AWARD\s+ROLL$/i, '');
    return {
      heading: `${cleanUpper} AWARD ROLL`,
      examLabel: typeStr,
      shortType: typeStr,
      badgeClass: 'custom'
    };
  }

  // 8. Fallback based on isExternal
  return {
    heading: isExternal ? 'EXTERNAL PRACTICAL AWARD ROLL' : 'INTERNAL PRACTICAL AWARD ROLL',
    examLabel: isExternal ? 'External Practical' : 'Internal Practical',
    shortType: isExternal ? 'External' : 'Internal',
    badgeClass: isExternal ? 'external' : 'internal'
  };
}

export const PRACTICAL_SUBJECT_DEFS = [
  { code: 'EN', name: 'General English', keywords: ['english', 'gen eng', 'en'] },
  { code: 'PH', name: 'Physics', keywords: ['physics', 'ph'] },
  { code: 'CH', name: 'Chemistry', keywords: ['chemistry', 'ch'] },
  { code: 'BO', name: 'Botany', keywords: ['botany', 'bo', 'biology'] },
  { code: 'ZO', name: 'Zoology', keywords: ['zoology', 'zo', 'biology'] },
  { code: 'BI', name: 'Biology (Botany & Zoology)', keywords: ['biology', 'bi', 'botany', 'zoology'] },
  { code: 'SC', name: 'Science', keywords: ['science', 'sc', 'sci'] },
  { code: 'SS', name: 'Social Studies', keywords: ['social studies', 'social science', 'social', 'ss', 'sst'] },
  { code: 'AD', name: 'Art and Drawing', keywords: ['art and drawing', 'art & drawing', 'ad', 'drawing'] },
  { code: 'BT', name: 'Biotechnology', keywords: ['biotechnology', 'biotech', 'bt'] },
  { code: 'MB', name: 'Microbiology', keywords: ['microbiology', 'micro', 'mb'] },
  { code: 'BC', name: 'Biochemistry', keywords: ['biochemistry', 'biochem', 'bc'] },
  { code: 'ES', name: 'Environmental Science', keywords: ['environmental science', 'evs', 'es'] },
  { code: 'GL', name: 'Geology', keywords: ['geology', 'gl'] },
  { code: 'EL', name: 'Electronics', keywords: ['electronics', 'el'] },
  { code: 'CS', name: 'Computer Science', keywords: ['computer science', 'comp sc', 'cs'] },
  { code: 'IP', name: 'Information Practices', keywords: ['information practices', 'ip'] },
  { code: 'ST', name: 'Statistics', keywords: ['statistics', 'stats', 'st'] },
  { code: 'FT', name: 'Food Technology', keywords: ['food technology', 'food tech', 'ft'] },
  { code: 'GG', name: 'Geography', keywords: ['geography', 'geo', 'gg'] },
  { code: 'PY', name: 'Psychology', keywords: ['psychology', 'psych', 'py'] },
  { code: 'PD', name: 'Physical Education', keywords: ['physical education', 'phy edu', 'pd', 'p.e.', 'pe'] },
  { code: 'HTC', name: 'Healthcare', keywords: ['healthcare', 'health care', 'htc'] },
  { code: 'ITE', name: 'IT and ITES', keywords: ['it and ites', 'it&ites', 'ite', 'information technology'] },
  { code: 'MA', name: 'Mathematics', keywords: ['mathematics', 'math', 'maths', 'ma'] },
  { code: 'AM', name: 'Applied Mathematics', keywords: ['applied mathematics', 'app math', 'am'] },
  { code: 'UR', name: 'Urdu', keywords: ['urdu', 'ur'] },
  { code: 'HN', name: 'Hindi', keywords: ['hindi', 'hn'] },
  { code: 'KS', name: 'Kashmiri', keywords: ['kashmiri', 'ks'] },
  { code: 'AR', name: 'Arabic', keywords: ['arabic', 'ar'] },
  { code: 'PE', name: 'Persian', keywords: ['persian', 'pe', 'pr'] },
  { code: 'SK', name: 'Sanskrit', keywords: ['sanskrit', 'sk'] },
  { code: 'PB', name: 'Punjabi', keywords: ['punjabi', 'pb'] },
  { code: 'DG', name: 'Dogri', keywords: ['dogri', 'dg'] },
  { code: 'BH', name: 'Bhoti', keywords: ['bhoti', 'bh'] },
  { code: 'ED', name: 'Education', keywords: ['education', 'ed'] },
  { code: 'HT', name: 'History', keywords: ['history', 'ht'] },
  { code: 'PS', name: 'Political Science', keywords: ['political science', 'pol sc', 'ps'] },
  { code: 'EC', name: 'Economics', keywords: ['economics', 'eco', 'ec'] },
  { code: 'SO', name: 'Sociology', keywords: ['sociology', 'soc', 'so'] },
  { code: 'PA', name: 'Public Administration', keywords: ['public administration', 'pub ad', 'pa'] },
  { code: 'PL', name: 'Philosophy', keywords: ['philosophy', 'phil', 'pl'] },
  { code: 'IS', name: 'Islamic Studies', keywords: ['islamic studies', 'isl', 'is'] },
  { code: 'VS', name: 'Vedic Studies', keywords: ['vedic studies', 'vs'] },
  { code: 'BST', name: 'Buddhist Studies', keywords: ['buddhist studies', 'bst'] },
  { code: 'MU', name: 'Music', keywords: ['music', 'mu'] },
  { code: 'HSC', name: 'Home Science', keywords: ['home science', 'home sci', 'hsc'] },
  { code: 'AY', name: 'Accountancy', keywords: ['accountancy', 'accounts', 'acc', 'ay'] },
  { code: 'BS', name: 'Business Studies', keywords: ['business studies', 'bus std', 'bs'] },
  { code: 'EP', name: 'Entrepreneurship', keywords: ['entrepreneurship', 'ent', 'ep'] },
  { code: 'BM', name: 'Business Mathematics', keywords: ['business mathematics', 'bm'] },
  { code: 'TS', name: 'Typewriting & Shorthand', keywords: ['typewriting', 'shorthand', 'ts'] },
  { code: 'TT', name: 'Travel & Tourism', keywords: ['travel', 'tourism', 'tt'] }
];

export function getStudentExamRoll(st) {
  if (!st) return '';
  const rollKeys = [
    'Exam R.No. (Current)', 'Exam R. No. (Current)', 'currExamRollNo', 'currExamRoll',
    'boardRollNo', 'boardRoll', 'Board Roll', 'Board Roll No', 'Board Roll No.',
    'Board Roll Number', 'examRollNo', 'Exam Roll No.', 'Exam Roll No', 'Exam Roll',
    'Exam Roll Number', 'examRoll', 'currentExamRoll', 'Exam R.No.', 'Exam R. No.'
  ];
  for (const k of rollKeys) {
    if (st[k] !== undefined && st[k] !== null) {
      const v = String(st[k]).trim();
      if (v && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(v)) return v;
    }
  }
  return '';
}

export function getStudentRegNo(st) {
  if (!st) return '';
  const regKeys = [
    'Board Registration Number', 'Registration No.', 'Registration No',
    'Registration Number', 'Reg. No.', 'Reg. No', 'regNo', 'registrationNo',
    'reg_no', 'RegNo', 'Registration'
  ];
  for (const k of regKeys) {
    if (st[k] !== undefined && st[k] !== null) {
      const v = String(st[k]).trim();
      if (v && !/^(N\/A|—|-|null|undefined)$/i.test(v)) return v;
    }
  }
  return '';
}

/**
 * Checks whether an exam roll number matches the official JKBOSE series for a given class:
 * - Class 10th: starts with '1' (typically 7-9 digits; 2025-26 centre 101061)
 * - Class 11th: starts with '2' (typically 7-9 digits; 2025-26 centres 201003, 201004)
 * - Class 12th: starts with '3' (typically 7-9 digits; 2025-26 centres 301003, 301004)
 */
export function isValidExamRollForClass(roll, targetClass = '') {
  if (!roll) return false;
  const digits = String(roll).replace(/\D/g, '');
  if (digits.length < 6) return false;
  if (!targetClass) return true;

  const c = String(targetClass).toLowerCase();
  if (c.includes('12')) {
    return digits.startsWith('3');
  }
  if (c.includes('11')) {
    return digits.startsWith('2');
  }
  if (c.includes('10')) {
    return digits.startsWith('1');
  }
  return true;
}

/**
 * Extracts the current official exam roll number for a student or record,
 * rigorously prioritizing current official board rolls (currExamRollNo / boardRollNo / Exam R.No. (Current))
 * and filtering out old redundant or previous-class exam rolls.
 */
export function getCurrentOfficialExamRoll(st, targetClass = '') {
  if (!st) return '';

  const cls = String(targetClass || st.Class || st.class || st.className || st['Admission sought for class'] || '').trim();

  const getClean = (val) => {
    if (val === undefined || val === null) return '';
    const str = String(val).trim();
    if (!str || /^(undefined|null|—|-|#N\/A|N\/A|NA|none|nil)$/i.test(str)) return '';
    return str;
  };

  const is12 = cls.includes('12');
  const is11 = cls.includes('11');
  const is10 = cls.includes('10');

  // 1. Explicit class-prefixed keys (e.g. from admissions)
  let classSpecificRoll = '';
  if (is12) {
    classSpecificRoll = getClean(
      st['12th Exam Roll'] ||
      st['Exam Roll Number of Class 12th'] ||
      st['12th Board Roll'] ||
      st['Class 12th Exam Roll'] ||
      st['12th Roll']
    );
  } else if (is11) {
    classSpecificRoll = getClean(
      st['11th Exam Roll'] ||
      st['Exam Roll Number of Class 11th'] ||
      st['11th Board Roll'] ||
      st['Class 11th Exam Roll'] ||
      st['11th Roll']
    );
  } else if (is10) {
    classSpecificRoll = getClean(
      st['10th Exam Roll'] ||
      st['Exam Roll Number of Class 10th'] ||
      st['10th Board Roll'] ||
      st['Class 10th Exam Roll'] ||
      st['10th Roll']
    );
  }

  if (classSpecificRoll && isValidExamRollForClass(classSpecificRoll, cls)) {
    return classSpecificRoll;
  }

  // 2. Priority check: currExamRollNo / boardRollNo / Exam R.No. (Current)
  const candidateKeys = [
    'currExamRollNo',
    'currExamRoll',
    'boardRollNo',
    'boardRoll',
    'Board Roll No',
    'Board Roll No.',
    'Board Roll',
    'Board Roll Number',
    'Exam R.No. (Current)',
    'Exam R. No. (Current)',
    'Current Exam Roll',
    'currentExamRoll',
    'examRollNo',
    'Exam Roll No.',
    'Exam Roll No',
    'Exam Roll',
    'Exam Roll Number',
    'examRoll'
  ];

  for (const k of candidateKeys) {
    const val = getClean(st[k]);
    if (val && isValidExamRollForClass(val, cls)) {
      return val;
    }
  }

  // 3. Fallback: check rollNo if it is a multi-digit number matching class prefix
  const rollNo = getClean(st.rollNo);
  if (rollNo && /^\d{6,}$/.test(rollNo) && isValidExamRollForClass(rollNo, cls)) {
    return rollNo;
  }

  // 4. If class wasn't specified, return the first candidate matching multi-digit
  if (!cls) {
    for (const k of candidateKeys) {
      const val = getClean(st[k]);
      if (val && /^\d{6,}$/.test(val)) return val;
    }
  }

  return '';
}

export function getStudentCentreNo(st, fallbackCentre = '', targetClass = '') {
  if (!st) return fallbackCentre;

  // 1. Derive from Exam Roll No: In JKBOSE, the first 6 digits represent the official Centre Code
  const examRoll = getCurrentOfficialExamRoll(st, targetClass) || getRecordExamRoll(st, targetClass);
  const digits = examRoll.replace(/\D/g, '');
  if (digits.length >= 6) {
    return digits.slice(0, 6);
  }

  // 2. Direct explicit centre number if set on student record
  const explicit = st.centreNo || st['Centre No.'] || st['Centre No'] || st['Centre'] || '';
  if (explicit && !/^(N\/A|—|-|null|undefined)$/i.test(String(explicit).trim())) {
    return String(explicit).trim();
  }

  return fallbackCentre;
}

/**
 * Extracts a clean, non-placeholder Exam Roll Number from a record or student object.
 */
export function getRecordExamRoll(r, targetClass = '') {
  if (!r) return '';
  const cls = String(targetClass || r.Class || r.class || r.className || r['Admission sought for class'] || '').trim();
  const official = getCurrentOfficialExamRoll(r, cls);
  if (official) return official;

  const general = getStudentExamRoll(r);
  if (general) {
    if (cls && isValidExamRollForClass(general, cls)) return general;
    if (!cls && /^\d{6,}$/.test(general)) return general;
    if (!/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(general)) return general;
  }
  return '';
}

/**
 * Extracts a clean Class Roll Number from a record or student object.
 */
export function getRecordClassRoll(r) {
  if (!r) return '';
  const candidates = [
    r.classRollNo,
    r.classRoll,
    r['Class Roll No'],
    r['Class Roll No.'],
    r['Class Roll'],
    r.rollNo,
    r.roll
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const s = String(c).trim();
      if (s && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(s) && !/^\d{7,}$/.test(s)) {
        return s;
      }
    }
  }
  return '';
}

/**
 * Sorts student records for Individual Award Rolls.
 * When Exam Roll Numbers are given, arranges them as per Exam Roll No in dictionary / natural ascending order
 * so that Centre Numbers (which correspond to the prefix) are grouped together consecutively and do not repeat again and again.
 * If Exam Roll Numbers are not given, falls back to Class Roll Number, then Student Name.
 */
export function sortRecordsForAwardRoll(recordsList) {
  if (!Array.isArray(recordsList) || recordsList.length === 0) return [];

  return [...recordsList].sort((a, b) => {
    const examA = getRecordExamRoll(a);
    const examB = getRecordExamRoll(b);

    // 1. Both have Exam Roll No -> sort in dictionary order (natural numeric/alphanumeric order)
    if (examA && examB) {
      const cmp = examA.localeCompare(examB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }

    // 2. Prioritize students with Exam Roll No over those without
    if (examA && !examB) return -1;
    if (!examA && examB) return 1;

    // 3. Fallback to Class Roll Number
    const classA = getRecordClassRoll(a);
    const classB = getRecordClassRoll(b);
    if (classA && classB) {
      const numA = parseInt(classA, 10);
      const numB = parseInt(classB, 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      const cmpClass = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmpClass !== 0) return cmpClass;
    }
    if (classA && !classB) return -1;
    if (!classA && classB) return 1;

    // 4. Fallback to student name
    const nameA = String(a.name || a.studentName || '').trim();
    const nameB = String(b.name || b.studentName || '').trim();
    return nameA.localeCompare(nameB);
  });
}

export function cleanRegistrationNumber(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^(N\/A|—|-|null|undefined)$/i.test(s)) return '';
  return s.replace(/[\s\-_/]/g, '').toUpperCase();
}

export function findStudentMarkRecord(subDoc, student) {
  if (!subDoc || !subDoc.records || !Array.isArray(subDoc.records) || !student) return null;

  // Session sanity check: only reject if both have explicit, conflicting non-compatible historical sessions
  const subSess = normalizePracticalSession(subDoc.sessionText || subDoc.SessionText || subDoc.session || subDoc.Session || subDoc.yearSuffix || '');
  const stSess = normalizePracticalSession(student.Session || student.session || '');
  if (subSess && stSess && subSess !== 'all' && stSess !== 'all') {
    if (subSess === '2023-24' && stSess === '2025-26') return null;
    if (subSess === '2025-26' && stSess === '2023-24') return null;
  }

  const stBoardReg = cleanRegistrationNumber(
    student['Board Reg. No.'] || student['Board Registration Number'] || student.boardRegNo ||
    student['Board Registration No. (Class 11th)'] || student['Board Registration No. (Class 10th)'] || student.regNo || ''
  );
  const stExam = String(
    student['Exam R.No. (Current)'] || student.examRollNo || student['Exam Roll No'] ||
    student['Exam Roll No.'] || student['Exam Roll Number'] || student['Board Roll'] || ''
  ).trim().toUpperCase();
  const stClassRoll = String(
    student['Class R.No.'] || student['Class Roll No'] || student['Class Roll No.'] ||
    student.classRollNo || student.rollNo || student.RollNo || student.roll || ''
  ).trim();
  const stForm = String(student.admissionNo || student.formNo || student['Admission Form No.'] || student['Form No.'] || '').trim();
  const stName = toTitleCase(
    student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || student.name || ''
  ).trim().toLowerCase();
  const stFather = toTitleCase(
    student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || student.fatherName || student.parentage || ''
  ).trim().toLowerCase();

  return subDoc.records.find(r => {
    const rBoardReg = cleanRegistrationNumber(r.boardRegNo || r['Board Reg. No.'] || r.regNo || r['Registration No.'] || '');
    const rExam = String(r.examRollNo || (/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || '').trim().toUpperCase();
    const rClassRoll = String(r.classRollNo || r.classRoll || r['Class Roll No'] || r.rollNo || r.roll || r.sNo || '').trim();
    const rForm = String(r.formNo || r.admissionNo || r['Form No.'] || '').trim();
    const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();
    const rFather = toTitleCase(r.parentName || r.parentage || r.fatherName || '').trim().toLowerCase();

    // 1. Board Registration No (Global unique key)
    if (stBoardReg && rBoardReg && stBoardReg === rBoardReg && stBoardReg.length >= 5) return true;

    // 2. Exam Roll No (Session-unique key)
    if (stExam && rExam && stExam !== '—' && stExam !== 'NA' && stExam !== 'N/A' && stExam === rExam) return true;

    // 3. Admission Form No
    if (stForm && rForm && stForm === rForm) return true;

    // 4. Class Roll No + Name verification
    if (stClassRoll && rClassRoll && stClassRoll !== '—' && stClassRoll !== '-' && !/^\d{8,}$/.test(stClassRoll) && !/^\d{8,}$/.test(rClassRoll) && stClassRoll === rClassRoll) {
      if (!stName || !rName || stName === rName || stName.includes(rName) || rName.includes(stName)) {
        return true;
      }
    }

    // 5. Exact full name + father match
    if (stName && rName && stName.length > 3 && (stName === rName || stName.replace(/\s+/g, '') === rName.replace(/\s+/g, ''))) {
      if (!stFather || !rFather || stFather === rFather || stFather.includes(rFather) || rFather.includes(stFather)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Checks whether active, approved practical mark submissions exist for a given subject code,
 * class, and evaluation type.
 */
export function hasSubjectPracticalSubmission(subCode, submissions, className = '', evaluationType = '', isExternal = false, session = '') {
  if (!submissions || !Array.isArray(submissions) || submissions.length === 0) return false;
  const clsTarget = String(className || '').replace(/[^0-9]/g, '');
  const targetNorm = String(evaluationType || (isExternal ? 'external' : 'internal')).toLowerCase().includes('ext') ? 'external' : 'internal';
  const targetSess = session && session !== 'all' ? normalizePracticalSession(session) : '';

  return submissions.some(s => {
    if (!s || s.isDeleted || s.status === 'deleted') return false;
    const sCls = String(s.className || s.Class || s.class || '').replace(/[^0-9]/g, '');
    if (clsTarget && sCls && sCls !== clsTarget) return false;

    if (targetSess) {
      const subSess = normalizePracticalSession(s.sessionText || s.session || s.Session || s.yearSuffix || '');
      if (subSess && subSess !== 'all' && subSess !== targetSess) return false;
    }

    const sType = String(s.practicalType || s.PracticalType || s.evaluationType || s.evalType || 'internal').toLowerCase();
    const sNorm = sType.includes('ext') ? 'external' : 'internal';
    if (sNorm !== targetNorm) return false;

    const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
    const isCode = isMatchingSubjectCode(codeStr, subCode);
    if (!isCode) return false;

    return Array.isArray(s.records) && s.records.some(r => {
      const mark = String(r.totalMarks ?? r.practicalMarks ?? '').trim();
      return mark !== '' && mark !== '—' && mark !== '-';
    });
  });
}


const PRINT_ENGINE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Cinzel:wght@700;800;900&display=swap');

  @media print {
    @page { size: A4 portrait; margin: 6mm 6mm 6mm 6mm; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-after: always; break-after: page; }
    .no-print { display: none !important; }
    thead { display: table-header-group !important; }
    tfoot { display: table-footer-group !important; }
    tbody { display: table-row-group !important; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
    .student-name-block { page-break-inside: avoid !important; break-inside: avoid !important; }
  }
  body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; }
  .award-page { width: 100%; max-width: 210mm; margin: 0 auto; box-sizing: border-box; padding: 4px; background: #fff; }
  
  /* 2-Column Award Roll Layout */
  .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; align-items: start; }
  .award-col-box { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
  .award-header-block { font-size: 9.5pt; text-align: center; margin-bottom: 6px; line-height: 1.35; border-bottom: 1.5px solid #0f172a; padding-bottom: 5px; }
  .award-header-block h2 { font-family: 'Cinzel', 'Plus Jakarta Sans', serif; font-size: 11pt; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
  .award-info-line { display: flex; justify-content: space-between; font-size: 8.8pt; font-weight: 700; margin-bottom: 3px; color: #334155; }
  
  table.award-table { width: 100%; margin-bottom: 8px; font-size: 9pt; text-align: center; }
  table.award-table th, table.award-table td { border: 1px solid #475569; padding: 4.5px 3px; height: 21px; box-sizing: border-box; }
  table.award-table th { background: #1e293b !important; font-weight: 800; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px; color: #ffffff !important; padding: 5px 3px; border: 1px solid #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .centre-num-row { background: #fef2f2 !important; color: #991b1b; font-weight: 800; font-size: 9pt; text-align: center; border-top: 1.5px solid #dc2626; border-bottom: 1.5px solid #dc2626; padding: 3px 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .absent-text { color: #dc2626; font-weight: 800; }
  
  /* Generous, well-spaced footer layout filling vertical page space */
  .award-footer { 
    font-size: 8.8pt; 
    font-weight: 700; 
    line-height: 1.8; 
    margin-top: 8px; 
    border-top: 1.5px solid #0f172a; 
    padding-top: 10px; 
    color: #1e293b; 
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .award-footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8.8pt;
    font-weight: 700;
  }
  .award-footer-field {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .award-footer-sig-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
  }
  .award-footer-sig-line {
    font-size: 8.8pt;
    font-weight: 800;
    color: #0f172a;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .award-footer-date-line {
    font-size: 8.8pt;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .award-footer-head-line {
    font-size: 8.8pt;
    font-weight: 800;
    text-align: right;
    color: #0f172a;
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 6px;
  }
  .fill-blank {
    border-bottom: 1.2px solid #334155;
    display: inline-block;
    min-width: 48px;
    height: 14px;
  }
  .fill-blank-md {
    border-bottom: 1.2px solid #334155;
    display: inline-block;
    min-width: 95px;
    height: 14px;
  }
  .fill-blank-lg {
    border-bottom: 1.2px solid #334155;
    display: inline-block;
    min-width: 125px;
    height: 14px;
  }

  /* Consolidated Cover Letter & Table Matrix Layout */
  .letter-container { font-size: 10.5pt; line-height: 1.65; padding: 25px 30px; font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; }
  .letter-header { font-weight: 800; margin-bottom: 20px; font-size: 11.5pt; line-height: 1.4; color: #0f172a; }
  .letter-subj { font-weight: 800; text-decoration: underline; margin: 18px 0; font-size: 11pt; color: #0f172a; }
  .letter-body { text-align: justify; margin-bottom: 14px; text-indent: 25px; color: #1e293b; font-weight: 500; }
  .gist-table { width: 85%; margin: 18px auto; border-collapse: collapse; font-size: 9pt; }
  .gist-table th, .gist-table td { border: 1px solid #475569; padding: 5px 12px; text-align: left; }
  .gist-table th { background: #1e293b !important; text-align: center; font-weight: 800; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 0.3px; color: #ffffff !important; border: 1px solid #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .gist-table td.num { text-align: center; font-weight: 800; font-family: 'Plus Jakarta Sans', monospace; color: #0f172a; }
  
  /* Matrix Table */
  .matrix-title-block { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 6px; }
  .matrix-title-block h1 { font-family: 'Cinzel', 'Plus Jakarta Sans', serif; font-size: 13pt; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.6px; color: #0f172a; }
  .matrix-title-block h2 { font-size: 10.5pt; font-weight: 800; margin: 4px 0; color: #1e293b; }
  .matrix-title-block p { font-size: 9pt; margin: 2px 0; font-weight: 700; color: #475569; }
  
  table.matrix-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; text-align: center; }
  table.matrix-table th, table.matrix-table td { border: 1px solid #64748b; padding: 3px 2px; }
  table.matrix-table th { background: #1e293b !important; font-weight: 800; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.2px; color: #ffffff !important; border: 1px solid #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.matrix-table thead tr:nth-child(2) th { background: #334155 !important; color: #f8fafc !important; font-size: 7.8pt; }
  table.matrix-table td.mark-val { font-weight: 800; color: #1e40af; }
  table.matrix-table td.no-sub { color: #94a3b8; font-weight: 600; }
  table.matrix-table td.hash-tot { font-weight: 900; background: #e2e8f0 !important; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  
  /* Attendance Table with standard signature row height */
  table.attendance-table { width: 100%; margin-top: 8px; }
  table.attendance-table tr { height: 46px; }
  table.attendance-table td { vertical-align: middle; box-sizing: border-box; }

  /* ─────────────────────────────────────────────────────────────
     CRITICAL PRINT PAGE-BREAK PROTECTION ACROSS CHROMIUM / WEBKIT
     In Blink/Chromium, 'border-collapse: collapse' causes the layout
     engine to IGNORE 'break-inside: avoid' on table rows (Issue 278327).
     Using 'border-collapse: separate' with 'border-spacing: 0' ensures
     Chromium strictly honors row & cell break boundaries.
     ───────────────────────────────────────────────────────────── */
  table.award-table,
  table.attendance-table,
  table.matrix-table,
  table.gist-table {
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border-top: 1px solid #475569 !important;
    border-left: 1px solid #475569 !important;
    page-break-inside: auto;
    break-inside: auto;
  }
  table.award-table th, table.award-table td,
  table.attendance-table th, table.attendance-table td,
  table.matrix-table th, table.matrix-table td,
  table.gist-table th, table.gist-table td {
    border-top: none !important;
    border-left: none !important;
    border-right: 1px solid #475569 !important;
    border-bottom: 1px solid #475569 !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    -webkit-column-break-inside: avoid;
  }
  thead {
    display: table-header-group !important;
  }
  tfoot {
    display: table-footer-group !important;
  }
  tbody {
    display: table-row-group !important;
  }
  tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    -webkit-column-break-inside: avoid;
    page-break-after: auto;
    break-after: auto;
  }
  .student-name-block {
    display: block !important;
    width: 100% !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    -webkit-column-break-inside: avoid !important;
    overflow: hidden !important;
  }
  .student-name-block * {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* ─────────────────────────────────────────────────────────────
     ALTERNATE ROW ZEBRA SHADING ACROSS ALL PRINTED TABLES
     ───────────────────────────────────────────────────────────── */
  table.matrix-table tbody tr:nth-child(even),
  table.award-table tbody tr:nth-child(even),
  table.attendance-table tbody tr:nth-child(even),
  table.gist-table tbody tr:nth-child(even) {
    background-color: #f1f5f9 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  table.matrix-table tbody tr:nth-child(even) td.hash-tot {
    background-color: #cbd5e1 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  table.matrix-table tbody tr:nth-child(odd),
  table.award-table tbody tr:nth-child(odd),
  table.attendance-table tbody tr:nth-child(odd),
  table.gist-table tbody tr:nth-child(odd) {
    background-color: #ffffff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

function triggerPrintWindow(htmlContent, pageTitle = 'Official Practical Award Roll — Govt HSS Shangus') {
  // Clean up any existing print iframe
  const existingFrame = document.getElementById('practicals-print-frame');
  if (existingFrame && existingFrame.parentNode) {
    try {
      existingFrame.parentNode.removeChild(existingFrame);
    } catch (_) {}
  }

  // Create isolated, hidden printing iframe directly on the current document
  const iframe = document.createElement('iframe');
  iframe.id = 'practicals-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const prevTitle = document.title;
  let isCleanedUp = false;
  const cleanupIframe = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    try {
      document.title = prevTitle;
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    } catch (_) {}
  };

  try {
    iframe.contentWindow.onafterprint = cleanupIframe;
  } catch (_) {}
  setTimeout(cleanupIframe, 120000);

  // Write content directly into the iframe document
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${pageTitle}</title>
        <style>${PRINT_ENGINE_CSS}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  // Temporarily adjust main page title so browser's "Save as PDF" dialog suggests the exact award roll filename
  try {
    document.title = pageTitle;
  } catch (_) {}

  // Trigger print dialog directly with 0 extra clicks and no lingering blank tabs
  const executePrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Iframe print error, falling back to window print:', err);
      try {
        window.print();
      } catch (_) {}
    }
  };

  // Wait for all resources (images and custom typography) to be ready before spooling
  const images = Array.from(doc.images || []);
  const waitForResources = (attempts = 40) => {
    const allImagesLoaded = images.length === 0 || images.every(img => img.complete && (img.naturalWidth > 0 || img.style.display === 'none'));
    if (allImagesLoaded || attempts <= 0) {
      if (iframe.contentWindow.document.fonts && iframe.contentWindow.document.fonts.ready) {
        iframe.contentWindow.document.fonts.ready
          .then(() => setTimeout(executePrint, 50))
          .catch(() => setTimeout(executePrint, 50));
      } else {
        setTimeout(executePrint, 50);
      }
    } else {
      setTimeout(() => waitForResources(attempts - 1), 50);
    }
  };

  waitForResources();
}

/**
 * 1. Print Individual Subject Award Roll (Screenshot 2 Format)
 * 2-column side-by-side layout (50 students per page) with centre numbers & figures-to-words.
 */
export function printIndividualAwardRoll({
  subjectCode = 'BO',
  subjectName = 'Botany',
  className = '11th',
  session = 'Annual Regular 2025',
  records = [],
  isExternal = false,
  evaluationType = '',
  practicalType = '',
  examTitle = '',
  maxMarks = 10,
  minMarks = 4,
  centreNo = ''
}) {
  if (!records || records.length === 0) return false;
  records = records.filter(r => !isStudentExamDropped(r));
  if (records.length === 0) return false;

  // Arrange records in dictionary order by exam roll number so centre numbers do not repeat
  records = sortRecordsForAwardRoll(records);

  const titles = resolveAwardRollTitles(evaluationType || practicalType || examTitle, isExternal);
  const heading = titles.heading;
  const examType = titles.examLabel;
  const totalRecs = records.length;
  const pageSize = 50; // 25 left + 25 right per A4 page
  const totalPages = Math.ceil(totalRecs / pageSize);
  const hasAnyExamRoll = records.some(r => Boolean(getRecordExamRoll(r)));

  let fullHtml = '';

  for (let p = 0; p < totalPages; p++) {
    const pageRecords = records.slice(p * pageSize, (p + 1) * pageSize);
    const leftChunk = pageRecords.slice(0, 25);
    const rightChunk = pageRecords.slice(25, 50);

    const leftPageNo = p * 2 + 1;
    const rightPageNo = p * 2 + 2;

    const renderColumn = (colChunk, startSno, pageNo) => {
      // Dynamic footer counts: calculate if any marks have been entered in this column
      let presentCount = 0;
      let absentCount = 0;
      let passCount = 0;
      let failCount = 0;
      let hasMarksEntered = false;

      colChunk.forEach(r => {
        const rawMark = String(r.totalMarks ?? r.practicalMarks ?? r.marks ?? '').trim();
        if (rawMark && !/^(N\/A|—|-|null|undefined)$/i.test(rawMark)) {
          hasMarksEntered = true;
          const upper = rawMark.toUpperCase();
          if (upper === 'AB' || upper === 'A' || upper === 'ABSENT') {
            absentCount++;
            failCount++;
          } else {
            const num = Number(rawMark);
            if (!isNaN(num)) {
              presentCount++;
              if (num >= minMarks) {
                passCount++;
              } else {
                failCount++;
              }
            }
          }
        }
      });

      let colHtml = `
        <div class="award-col-box">
          <div class="award-header-block">
            <h2>${heading}</h2>
            <div class="award-info-line">
              <span>Examination: <strong>${examType}</strong></span>
              <span>Page No.: <strong>${pageNo}</strong></span>
            </div>
            <div class="award-info-line">
              <span>Subject: <strong>${getSubjectDisplayName(subjectCode || subjectName, className)} (${subjectCode})</strong></span>
              <span>Max.: <strong>${maxMarks}</strong>; Min.: <strong>${minMarks}</strong></span>
            </div>
            <div class="award-info-line">
              <span>Session: <strong>${session}</strong></span>
              <span>Class: <strong>${className?.toLowerCase().includes('class') ? className : `Class ${className}`}</strong></span>
            </div>
          </div>

          <table class="award-table">
            <thead>
              <tr>
                <th style="width: 12%;">S.No.</th>
                <th style="width: 28%;">${hasAnyExamRoll ? 'Exam R.No.' : 'Class R.No. / Name'}</th>
                <th style="width: 28%;">Marks<br>(Figures)</th>
                <th style="width: 32%;">Marks<br>(Words)</th>
              </tr>
            </thead>
            <tbody>
      `;

      let currentCentre = '';

      colChunk.forEach((r, idx) => {
        const sno = startSno + idx;
        const cleanExamRoll = getRecordExamRoll(r);
        const cleanClassRoll = getRecordClassRoll(r);

        const rawName = r.name || r.studentName || r['Candidate Name'] || r['Student Name'] || '';
        const cleanName = (rawName && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(String(rawName).trim())) ? toTitleCase(String(rawName).trim()) : '';

        let rollCellHtml = '';
        if (cleanExamRoll) {
          rollCellHtml = `<strong>${cleanExamRoll}</strong>`;
        } else if (cleanClassRoll && cleanName) {
          rollCellHtml = `
            <div style="line-height: 1.15; padding: 1px 0;">
              <strong style="font-size: 8.5pt; color: #0f172a;">${cleanClassRoll}</strong>
              <div style="font-size: 6.8pt; font-weight: 600; color: #334155; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 105px; margin: 0 auto;" title="${cleanName}">${cleanName}</div>
            </div>
          `;
        } else if (cleanClassRoll) {
          rollCellHtml = `<strong>${cleanClassRoll}</strong>`;
        } else if (cleanName) {
          rollCellHtml = `<span style="font-size: 7.5pt; font-weight: bold; text-transform: uppercase;">${cleanName}</span>`;
        } else {
          rollCellHtml = '—';
        }

        const rawMark = String(r.totalMarks ?? r.practicalMarks ?? r.marks ?? '').trim();
        const isAbs = rawMark.toUpperCase() === 'AB' || rawMark.toUpperCase() === 'A' || rawMark.toUpperCase() === 'ABSENT';

        // Derive centre number from exam roll (first 6 digits in JKBOSE) or explicit field
        const rCentre = getStudentCentreNo(r, centreNo);
        if (rCentre && rCentre !== currentCentre) {
          currentCentre = rCentre;
          colHtml += `
            <tr>
              <td colspan="4" class="centre-num-row">centre no. ${currentCentre}</td>
            </tr>
          `;
        } else if (!rCentre && !currentCentre && idx === 0) {
          currentCentre = '—';
          colHtml += `
            <tr>
              <td colspan="4" class="centre-num-row">centre no. &nbsp;____________________</td>
            </tr>
          `;
        }

        colHtml += `
          <tr>
            <td>${sno}</td>
            <td>${rollCellHtml}</td>
            <td>${isAbs ? '<span class="absent-text">Absent</span>' : `<strong>${rawMark || '—'}</strong>`}</td>
            <td>${isAbs ? '-' : numberToWordsInr(rawMark)}</td>
          </tr>
        `;
      });

      // Pad remaining empty rows to maintain 25 rows per column layout
      for (let pad = colChunk.length; pad < 25; pad++) {
        colHtml += `
          <tr>
            <td>${startSno + pad}</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        `;
      }

      colHtml += `
            </tbody>
          </table>

          <div class="award-footer">
            <div class="award-footer-row">
              <div class="award-footer-field">
                <span>No. of Candidates Present:</span>
                ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace;">${presentCount}</strong>` : `<span class="fill-blank"></span>`}
              </div>
              <div class="award-footer-field">
                <span>Absent:</span>
                ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace; ${absentCount > 0 ? 'color: #dc2626;' : ''}">${absentCount}</strong>` : `<span class="fill-blank"></span>`}
              </div>
            </div>

            <div class="award-footer-row">
              <div class="award-footer-field">
                <span>No. of Candidates Passed:</span>
                ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace; color: #16a34a;">${passCount}</strong>` : `<span class="fill-blank"></span>`}
              </div>
              <div class="award-footer-field">
                <span>Failed:</span>
                ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace; ${failCount > 0 ? 'color: #dc2626;' : ''}">${failCount}</strong>` : `<span class="fill-blank"></span>`}
              </div>
            </div>

            <div class="award-footer-sig-block">
              <div class="award-footer-sig-line">
                <span>Signature of Examiner:</span>
                <span class="fill-blank-lg"></span>
              </div>

              <div class="award-footer-date-line">
                <span>Date of Submission of Awards:</span>
                <span class="fill-blank-md"></span>
              </div>

              <div class="award-footer-head-line">
                <span>Signature of Head of Institution:</span>
                <span class="fill-blank-lg"></span>
              </div>
            </div>
          </div>
        </div>
      `;
      return colHtml;
    };

    fullHtml += `
      <div class="award-page ${p < totalPages - 1 ? 'page-break' : ''}">
        <div class="two-col-grid">
          ${renderColumn(leftChunk, p * pageSize + 1, leftPageNo)}
          ${renderColumn(rightChunk, p * pageSize + 26, rightPageNo)}
        </div>
      </div>
    `;
  }

  triggerPrintWindow(fullHtml, `${heading} — ${subjectName} (${subjectCode}) — Class ${className}`);
  return true;
}

/**
 * 2. Print Individual Work Sheet / Subject Marks Record (Screenshot 5 Format)
 */
export function printIndividualWorkSheet({
  subjectCode = 'BO',
  subjectName = 'Botany',
  className = '11th',
  session = 'Annual Regular 2025',
  records = [],
  evaluationType = '',
  practicalType = ''
}) {
  if (!records || records.length === 0) return false;

  const titles = resolveAwardRollTitles(evaluationType || practicalType, false);
  const examLabel = titles.examLabel;

  let html = `
    <div class="award-page">
      <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <h1 style="font-size: 14pt; font-weight: bold; margin: 0;">Govt. Higher Secondary School Shangus</h1>
        <h2 style="font-size: 11pt; font-weight: bold; margin: 4px 0;">Marks Record (${examLabel}) - ${String(className).toLowerCase().includes('10') ? 'Secondary School (Class 10th)' : className === '11th' ? 'HSE-I (Class 11th)' : 'HSE-II (Class 12th)'} - ${getSubjectDisplayName(subjectCode || subjectName, className)}</h2>
        <p style="font-size: 9.5pt; font-weight: bold; margin: 2px 0;">Session & Year: <strong>${session}</strong></p>
        <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; margin-top: 8px;">
          <span>No.: ____________________</span>
          <span>Date: ____________________</span>
        </div>
      </div>

      <table class="award-table" style="font-size: 9.5pt;">
        <thead>
          <tr>
            <th style="width: 8%;">S.No.</th>
            <th style="width: 12%;">Class R.No.</th>
            <th style="width: 18%;">Exam Roll No.</th>
            <th style="width: 32%; text-align: left; padding-left: 8px;">Student Name</th>
            <th style="width: 10%;">Prac./Assn.</th>
            <th style="width: 10%;">Viva-voce</th>
            <th style="width: 10%;">Overall</th>
          </tr>
        </thead>
        <tbody>
  `;

  records.forEach((r, idx) => {
    const isAbs = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase() === 'AB';
    const rawExamRoll = r.examRollNo || r['Exam Roll No.'] || r['Exam Roll No'] || r['Exam Roll'] || r['Board Roll'] || '';
    const displayExamRoll = (rawExamRoll && !/^(N\/A|—|-|null|undefined)$/i.test(String(rawExamRoll).trim())) ? String(rawExamRoll).trim() : '—';
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${r.classRollNo || r.rollNo || '—'}</td>
        <td><strong>${displayExamRoll}</strong></td>
        <td style="text-align: left; padding-left: 8px;"><strong>${toTitleCase(r.name || r.studentName || '—')}</strong></td>
        <td>${r.pracMarks ?? r.practicalMarks ?? '—'}</td>
        <td>${r.vivaMarks ?? '—'}</td>
        <td style="background: #f8fafc;">${isAbs ? '<span class="absent-text">AB</span>' : `<strong>${r.totalMarks ?? r.practicalMarks ?? '—'}</strong>`}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <div class="sig-row" style="margin-top: 30px; font-size: 10pt;">
        <div>Subject Teacher Signature: __________________</div>
        <div>Principal Signature: __________________</div>
      </div>
    </div>
  `;

  triggerPrintWindow(html, `Marks Record (${examLabel}) — ${subjectName} — Class ${className}`);
  return true;
}

/**
 * 3. Print Consolidated Practical Award Roll (Screenshots 3 & 4 Format)
 * Page 1: Official Forwarding Cover Letter addressed to Assistant Secretary, Sub Office Anantnag.
 * Page 2+: Subject-wise Hash Total Matrix Table.
 */
export function printConsolidatedAwardRoll({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  submissions = [],
  isExternal = false,
  evaluationType = '',
  practicalType = '',
  selectedSubjectCodes = null,
  printDetails = null
}) {
  if (!students || students.length === 0) return false;
  students = students.filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
  if (students.length === 0) return false;

  const titles = resolveAwardRollTitles(evaluationType || practicalType || printDetails?.practicalType, isExternal);
  const isClass10 = String(className).toLowerCase().includes('10');
  const isClass12 = String(className).toLowerCase().includes('12');
  const clsTarget = isClass10 ? '10' : isClass12 ? '12' : '11';
  const hseText = isClass10
    ? 'Secondary School Examination (Class 10th)'
    : className === '11th'
      ? 'HSE-I (Class 11th)'
      : 'HSE-II (Class 12th)';
  
  // Filter subjects based on admin's subject checklist selection
  const candidateSubs = PRACTICAL_SUBJECT_DEFS.filter(s => {
    if (!selectedSubjectCodes || !Array.isArray(selectedSubjectCodes) || selectedSubjectCodes.length === 0) return true;
    return selectedSubjectCodes.includes(s.code);
  });

  // Only include subjects that actually have active submitted marks in submissions (unless explicitly a single subject target)
  const isSingleSub = selectedSubjectCodes && Array.isArray(selectedSubjectCodes) && selectedSubjectCodes.length === 1;
  const subsWithMarks = candidateSubs.filter(sub => {
    return hasSubjectPracticalSubmission(sub.code, submissions, className, evaluationType, isExternal, session);
  });
  const activeSubs = isSingleSub
    ? candidateSubs
    : (subsWithMarks.length > 0 ? subsWithMarks : candidateSubs);

  // Helper to check submission evaluation type & session match strictly
  const isSubDocMatch = (s) => {
    if (!s || s.isDeleted || s.status === 'deleted') return false;
    const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
    if (!matchClass) return false;

    // Session check (only enforce if session filter provided and not 'all')
    if (session && session !== 'all') {
      const subSess = normalizePracticalSession(s.sessionText || s.session || s.Session || s.yearSuffix || '');
      const targetSess = normalizePracticalSession(session);
      if (subSess && targetSess && subSess !== 'all' && targetSess !== 'all' && subSess !== targetSess) return false;
    }

    const sType = String(s.practicalType || s.PracticalType || s.evaluationType || s.evalType || 'internal').toLowerCase();
    const targetNorm = (String(evaluationType || practicalType || (isExternal ? 'external' : 'internal'))).toLowerCase().includes('ext') ? 'external' : 'internal';
    const sNorm = sType.includes('ext') ? 'external' : 'internal';
    if (sNorm !== targetNorm) return false;
    return true;
  };

  // Build subject gist count for Page 1 Forwarding Cover Letter
  const gistList = activeSubs.map((sub, idx) => {
    let count = 0;

    students.forEach(st => {
      let hasSub = isStudentEnrolledInPracticalSubject(st, sub.code, className);

      // Also check if this student has an actual submitted mark for this subject!
      if (!hasSub && submissions && submissions.length > 0) {
        const rNo = String(st['Class Roll No'] || st['Class R.No.'] || st.classRollNo || st.rollNo || st.roll || '').trim();
        const subDoc = submissions.find(s => {
          if (!isSubDocMatch(s)) return false;
          const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
          return isMatchingSubjectCode(codeStr, sub.code);
        });
        if (subDoc && subDoc.records && rNo) {
          const hasRec = subDoc.records.some(r => String(r.classRollNo || r.classRoll || r.rollNo || r.roll || '').trim() === rNo);
          if (hasRec) hasSub = true;
        }
      }

      if (hasSub) count++;
    });

    // Fallback count from submissions strictly FOR THIS CLASS and SESSION if student subject string is empty
    if (count === 0 && submissions && submissions.length > 0) {
      const subDoc = submissions.find(s => {
        if (!isSubDocMatch(s)) return false;
        const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
        return isMatchingSubjectCode(codeStr, sub.code);
      });
      if (subDoc && subDoc.records) {
        count = subDoc.records.length;
      }
    }


    return {
      sno: idx + 1,
      code: sub.code,
      name: getSubjectDisplayName(sub.code, className) || sub.name,
      count
    };
  }).filter(g => g.count > 0);

  // ──────── PAGE 1: FORWARDING COVER LETTER (Screenshot 4) ────────
  let letterHtml = `
    <div class="award-page page-break">
      <div class="letter-container">
        <div class="letter-header">
          <strong>The Assistant Secretary,</strong><br>
          Sub Office Anantnag.
        </div>

        <div class="letter-subj">
          Subject: Submission of ${titles.shortType} Awards of ${hseText} Session ${session}.
        </div>

        <div class="letter-body">
          Sir,
        </div>

        <div class="letter-body">
          Apropos to the subject captioned above kindly find enclosed herewith the ${titles.shortType.toLowerCase()} awards (in triplicate) pertaining to <strong>${hseText} Examination, session ${session}</strong>, for the favour of further necessary action at your end please.
        </div>

        <div class="letter-body">
          Furthermore, this is <strong>certified</strong> that the ${titles.shortType.toLowerCase()} tests/examinations for all the examinees of the institution, who are going to appear in the said examination, had been conducted by the institution and <strong>none among the on-roll candidates have been skipped</strong> during the preparation of award rolls. The summary of the examinees with subject wise gist is as follows:
        </div>

        <table class="gist-table">
          <thead>
            <tr>
              <th style="width: 15%;">S.No.</th>
              <th style="width: 55%; text-align: left; padding-left: 10px;">Subject</th>
              <th style="width: 30%;">No. of Students</th>
            </tr>
          </thead>
          <tbody>
  `;

  gistList.forEach(g => {
    letterHtml += `
      <tr>
        <td style="text-align: center;">${g.sno}</td>
        <td style="padding-left: 10px;">${g.name} (${g.code})</td>
        <td class="num">${g.count}</td>
      </tr>
    `;
  });

  letterHtml += `
          </tbody>
        </table>

        <div style="margin-top: 40px; text-align: right; font-weight: bold; font-size: 11pt; padding-right: 20px;">
          Principal
        </div>
      </div>
    </div>
  `;

  // ──────── PAGE 2+: CONSOLIDATED MARKS GRID MATRIX (Screenshot 3) ────────
  let matrixHtml = `
    <div class="award-page">
      <div class="matrix-title-block">
        <h1>Govt. Higher Secondary School Shangus, Anantnag</h1>
        <h2>Record of ${titles.examLabel} Awards Roll for the ${hseText} Examination</h2>
        <p>Session & Year: <strong>${session}</strong> &nbsp;|&nbsp; Institution Contact: <strong>9682641216</strong></p>
        <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; margin-top: 6px;">
          <span>No.: ____________________</span>
          <span>Date: ____________________</span>
        </div>
      </div>

      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width: 4%;">S.No.</th>
            <th style="width: 14%;">Exam Roll No.</th>
            <th colspan="${activeSubs.length}">SUBJECTS</th>
            <th style="width: 10%;">Hash Total</th>
          </tr>
          <tr>
            <th></th>
            <th></th>
            ${activeSubs.map(s => `<th>${s.code}</th>`).join('')}
            <th></th>
          </tr>
        </thead>
        <tbody>
  `;

  // Build rows for each student
  students.forEach((st, idx) => {
    const rawExamRoll = String(getRecordExamRoll(st, className) || getStudentExamRoll(st) || st['Exam R.No. (Current)'] || st.examRollNo || '').trim();
    const displayExamRoll = (rawExamRoll && rawExamRoll !== '—' && rawExamRoll !== 'N/A' && rawExamRoll !== 'NA') ? rawExamRoll : '—';
    let rowHashTotal = 0;

    const cellHtmls = activeSubs.map(sub => {
      const isEnrolled = isStudentEnrolledInPracticalSubject(st, sub.code, className);

      // Find mark from teacher submission strictly matching this class, subject & evaluation type
      if (sub.code === 'BI') {
        const boDoc = submissions.find(s => {
          if (!isSubDocMatch(s)) return false;
          const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
          return isMatchingSubjectCode(codeStr, 'BO');
        });
        const zoDoc = submissions.find(s => {
          if (!isSubDocMatch(s)) return false;
          const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
          return isMatchingSubjectCode(codeStr, 'ZO');
        });
        const boRec = findStudentMarkRecord(boDoc, st);
        const zoRec = findStudentMarkRecord(zoDoc, st);
        const boVal = parseInt(boRec?.totalMarks ?? boRec?.practicalMarks ?? '', 10);
        const zoVal = parseInt(zoRec?.totalMarks ?? zoRec?.practicalMarks ?? '', 10);
        if (!isNaN(boVal) || !isNaN(zoVal)) {
          const biTot = (isNaN(boVal) ? 0 : boVal) + (isNaN(zoVal) ? 0 : zoVal);
          rowHashTotal += biTot;
          return `<td class="mark-val">${biTot}</td>`;
        }
      }

      const subDoc = submissions.find(s => {
        if (!isSubDocMatch(s)) return false;
        const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
        return isMatchingSubjectCode(codeStr, sub.code);
      });

      const rec = findStudentMarkRecord(subDoc, st);

      if (rec) {
        const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
        const numVal = parseInt(rawMark, 10);
        if (!isNaN(numVal)) {
          rowHashTotal += numVal;
          return `<td class="mark-val">${numVal}</td>`;
        } else if (rawMark.toUpperCase() === 'AB') {
          return `<td style="color: #cc0000; font-weight: bold;">AB</td>`;
        }
      }

      if (isEnrolled) {
        return `<td class="mark-val">—</td>`;
      }

      return `<td class="no-sub">x</td>`;
    }).join('');

    matrixHtml += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${displayExamRoll}</strong></td>
        ${cellHtmls}
        <td class="hash-tot">${rowHashTotal > 0 ? rowHashTotal : '—'}</td>
      </tr>
    `;
  });

  const inchargeName = printDetails?.inchargeName || (className === '12th' ? 'Mr. Bilal Ahmad Khandy' : 'Mr. Majid Hassan Najar');
  const inchargeCpis = printDetails?.inchargeCpis || (className === '12th' ? 'KGLEDU00120015' : 'SHGEDU00220017');
  const inchargeMobile = printDetails?.inchargeMobile || (className === '12th' ? '9596165142' : '7006537425');

  const partText = isClass10 ? 'Class 10th' : className === '11th' ? 'Part-I (class 11th)' : 'Part-II (class 12th)';
  const examLevelText = isClass10 ? 'Secondary School Examination' : 'Higher Secondary Examination';
  const testType = titles.examLabel;

  const numSubjects = activeSubs && activeSubs.length > 0 ? activeSubs.length : 1;
  const examinerHeading = numSubjects === 1 ? 'Signature of Examiner' : 'Signature of Examiner/s';
  const gridCols = numSubjects === 1 ? 1 : (numSubjects === 2 ? 2 : (numSubjects === 3 ? 3 : (numSubjects === 4 ? 2 : (numSubjects <= 6 ? 3 : 4))));
  const containerStyle = numSubjects === 1 ? 'max-width: 420px;' : 'width: 100%;';

  const examinerSignaturesHtml = (activeSubs && activeSubs.length > 0)
    ? activeSubs.map((sub, idx) => {
        const subDisplayName = getSubjectDisplayName(sub.code || sub.name, className);
        const subDoc = submissions && submissions.find(s => {
          if (!isSubDocMatch(s)) return false;
          const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
          return isMatchingSubjectCode(codeStr, sub.code);
        });
        const examinerName = subDoc ? (subDoc.teacherName || subDoc['Teacher Name'] || subDoc.submittedByName || subDoc.submittedBy || '') : '';

        return `
          <div style="min-width: 0; padding-right: 12px; margin-bottom: 6px;">
            <div style="font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.3;">
              <strong>${idx + 1}. ${subDisplayName} (${sub.code}):</strong> ....................................
            </div>
            ${examinerName && examinerName !== '—' && examinerName !== 'Faculty Member' ? `
              <div style="font-size: 8.5pt; color: #334155; margin-top: 3px; padding-left: 18px;">
                Name: <strong>${examinerName}</strong>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')
    : `
      <div style="min-width: 0;">
        <div style="font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; color: #000;">
          <strong>1. Examiner:</strong> ....................................
        </div>
      </div>
    `;

  matrixHtml += `
        </tbody>
      </table>

      <div class="matrix-footer" style="margin-top: 24px; font-size: 10pt; font-family: 'Times New Roman', Times, serif; line-height: 1.4;">
        <div style="text-align: center; font-weight: bold; font-size: 11.5pt; margin-bottom: 6px;">Certificate</div>
        <p style="text-align: justify; margin: 0 0 16px 0; font-size: 10pt;">
          "Certified that the relevant data of ${testType} in respect of the above candidates who are appearing in ${examLevelText} ${partText} from this Institution is correct in all respects to the best of my knowledge and no further amendment or modifications in the above data shall be indicated or requested by the undersigned affecting the declared result of any candidate whatsoever"
        </p>

        <div style="margin-bottom: 20px; font-size: 10pt; font-weight: bold;">
          <div>Signature of Incharge ____________________</div>
          <div style="margin-top: 4px; font-weight: normal;">Name: <strong>${inchargeName}</strong></div>
          <div style="font-weight: normal;">CPIS: <strong>${inchargeCpis}</strong></div>
          <div style="font-weight: normal;">Mobile: <strong>${inchargeMobile}</strong></div>
        </div>

        <div style="font-weight: bold; margin-bottom: 10px; font-size: 10pt;">${examinerHeading}</div>
        <div style="display: grid; grid-template-columns: repeat(${gridCols}, 1fr); row-gap: 14px; column-gap: 12px; font-size: 9.5pt; margin-bottom: 35px; ${containerStyle}">
          ${examinerSignaturesHtml}
        </div>

        <div style="text-align: right; font-weight: bold; font-size: 11.5pt; padding-right: 30px; margin-top: 20px;">
          Principal
        </div>
      </div>
    </div>
  `;

  triggerPrintWindow(letterHtml + matrixHtml, `Consolidated Awards Roll (${titles.examLabel}) — Class ${className}`);
  return true;
}

/**
 * Resolves the canonical raw subject string for a student record.
 * Handles "Same as in Class 11th" placeholder text by falling back to the
 * actual 11th-class subject fields or deriving from stream when nothing is found.
 */
export function resolveStudentStream(st, className = '') {
  if (!st) return '';
  const clsName = String(
    className ||
    st?.Class ||
    st?.class ||
    st?.className ||
    st?.['Admission sought for class'] ||
    st?.['Class for Admission'] ||
    st?.['Class for which Admission Sought'] ||
    st?.['Class Enrolled'] ||
    st?.admittedClass ||
    ''
  ).toLowerCase();
  if (clsName.includes('9') || clsName.includes('10') || clsName.includes('ix') || clsName.includes('x')) return 'General';

  const rawStream = String(
    st['Stream for Class 12th'] ||
    st['Stream (Class 12th)'] ||
    st['Stream in Class 12th'] ||
    st['Stream for Class 11th'] ||
    st['Stream (Class 11th)'] ||
    st['Stream in Class 11th'] ||
    st['Stream Studied in Class 11th'] ||
    st['Stream opted in Class 11th'] ||
    st['Stream'] ||
    st['stream'] ||
    st['Selected Stream'] ||
    st['Stream (Applied)'] ||
    st['Stream for Admission'] ||
    ''
  ).trim();

  if (rawStream && !/^(N\/A|#N\/A|—|-|null|undefined|general)$/i.test(rawStream)) {
    const lower = rawStream.toLowerCase();
    if (lower.includes('non-med') || lower.includes('nonmed')) return 'Non-Medical';
    if (lower.includes('med')) return 'Medical';
    if (lower.includes('sci')) return 'Science';
    if (lower.includes('art') || lower.includes('hum')) return 'Humanities';
    if (lower.includes('com')) return 'Commerce';
    return rawStream;
  }

  // Infer from subjects
  const subStr = String(
    st.subjects || st['Subjects'] || st.Subs || st['Subs'] || st.subject_combination || st.Subject || st.subs || ''
  ).toLowerCase();

  if (/\b(physics|chemistry|biology|botany|zoology|ph|ch|bi|bo|zo)\b/i.test(subStr)) {
    if (/\b(biology|botany|zoology|bio|bot|zoo|bi|bo|zo)\b/i.test(subStr)) return 'Medical';
    return 'Science';
  }
  if (/\b(commerce|accountancy|business studies|accounts|ay|bs)\b/i.test(subStr)) return 'Commerce';
  if (/\b(political|history|education|sociology|urdu|arabic|persian|psychology|ps|ht|ed|so|ur|ar|pr)\b/i.test(subStr)) return 'Humanities';

  return '';
}

function resolveStudentSubjectsRaw(st, className = '') {
  if (!st) return '';
  const clsName = String(className || st.Class || st.class || '').toLowerCase();
  const is12 = clsName.includes('12');
  const is10 = clsName.includes('10');
  const is9 = clsName.includes('9');

  const SAME_AS_11_RE = /same\s+as\s+(in\s+)?class\s*(11|eleventh)/i;

  const multiSubCols = [
    st['Subjects1'], st['Subjects2'], st['Subjects3'], st['Subjects4'], st['Subjects5'], st['Subject6'],
    st['Subject1'], st['Subject2'], st['Subject3'], st['Subject4'], st['Subject5'],
    st['subject1'], st['subject2'], st['subject3'], st['subject4'], st['subject5'], st['subject6']
  ].filter(val => val && !SAME_AS_11_RE.test(String(val))).join(', ');

  // Ordered candidate fields — most authoritative first
  const candidates = [
    st['Subs'],
    st['subs'],
    is12 ? st['Subjects to be taken in Class 12th'] : null,
    is12 ? st['Subjects in Class 12th'] : null,
    is12 ? st['Stream & Subjects for Class 12th'] : null,
    is10 ? (st['Subjects to be taken in Class 10th'] || st['Subjects in Class 10th']) : null,
    is9 ? (st['Subjects to be taken in Class 9th'] || st['Subjects in Class 9th']) : null,
    multiSubCols || null,
    st['Subjects to be taken in Class 11th'],
    st['Subjects Studied in Class 11th'],
    st['Subjects in Class 11th'],
    st['Subjects to be taken in Class 10th'],
    st['Subjects in Class 10th'],
    st['Subjects Studied in Class 9th'],
    st['Subjects to be taken in Class 9th'],
    st['Subjects in Class 9th'],
    st['Subjects'],
    st['Subject Combination'],
    st['streamSubjects'],
    st.subjects,
  ];

  let bestCandidate = '';
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    if (!s || s === '—' || s === 'N/A') continue;
    if (SAME_AS_11_RE.test(s)) continue;

    // If candidate has 3+ distinct subjects, use it immediately
    const count = s.split(/[,;/]/).filter(x => x.trim().length > 0).length;
    if (count >= 3) {
      return s;
    }
    if (!bestCandidate || count > bestCandidate.split(/[,;/]/).filter(x => x.trim().length > 0).length) {
      bestCandidate = s;
    }
  }

  if (bestCandidate && !/^(general\s*english|science|medical|non-medical|arts|humanities|commerce)$/i.test(bestCandidate.trim())) {
    return bestCandidate;
  }

  // Secondary Fallback
  if (is10 || is9) return 'English, Mathematics, Science, Social Studies, Urdu';

  // Stream-based fallback
  const stStream = resolveStudentStream(st, className).toLowerCase();
  if (stStream.includes('non-med') || stStream.includes('nonmed')) return 'General English, Physics, Chemistry, Mathematics';
  if (stStream.includes('med') || stStream.includes('science') || stStream.includes('sci')) return 'General English, Physics, Chemistry, Biology';
  if (stStream.includes('arts') || stStream.includes('humanities')) return 'General English, Urdu, Education, Political Science, Economics';
  if (stStream.includes('commerce')) return 'General English, Accountancy, Business Studies, Economics, Mathematics';
  return bestCandidate || '';
}

export function getAbbreviatedSubjects(st, className = '') {
  if (!st) return '';
  const clsName = String(className || st.Class || st.class || '').toLowerCase();
  const isSecondary = clsName.includes('9') || clsName.includes('10');

  const raw = resolveStudentSubjectsRaw(st, className);

  if (!raw) {
    if (isSecondary) return 'EN, MA, SC, SS, UR';
    const stStream = String(st.stream || st.Stream || '').toLowerCase();
    if (stStream.includes('non-med') || stStream.includes('nonmed')) return 'EN, PH, CH, MA';
    if (stStream.includes('med') || stStream.includes('science')) return 'EN, PH, CH, BI';
    if (stStream.includes('arts') || stStream.includes('humanities')) return 'EN, UR, ED, PS, EC';
    if (stStream.includes('commerce')) return 'EN, AY, BS, EC, MA';
    return stStream ? stStream.toUpperCase() : 'GENERAL';
  }

  let cleanRaw = ' ' + raw.trim() + ' ';

  // 1. Pre-tokenize multi-word and compound subjects FIRST to prevent partial overlaps
  cleanRaw = cleanRaw
    .replace(/\b(physical\s+education|phy\s+edu|phy\.\s+edu\.|p\.ed|ped|p\.e\.|p\.e|pd)\b/gi, ' __SUB_PD__ ')
    .replace(/\b(environmental\s+science|envir\s+sci|evs|es)\b/gi, ' __SUB_ES__ ')
    .replace(/\b(political\s+science|pol\s+sc|pol\.\s+sc\.|pol\s+science|ps)\b/gi, ' __SUB_PS__ ')
    .replace(/\b(computer\s+science|comp\s+sci|cs)\b/gi, ' __SUB_CS__ ')
    .replace(/\b(social\s+science|social\s+studies|sst|ss)\b/gi, ' __SUB_SS__ ')
    .replace(/\b(general\s+english|gen\s+eng|ge)\b/gi, ' __SUB_EN__ ')
    .replace(/\b(it\s*&\s*ites|it\s+and\s+ites|it&ites|information\s+technology)\b/gi, ' __SUB_ITE__ ')
    .replace(/\b(health\s*care|healthcare|htc)\b/gi, ' __SUB_HTC__ ')
    .replace(/\b(business\s+studies|bs)\b/gi, ' __SUB_BS__ ')
    .replace(/\b(entrepreneurship|ep)\b/gi, ' __SUB_EP__ ')
    .replace(/\b(applied\s+mathematics|app\s+math|am)\b/gi, ' __SUB_AM__ ')
    .replace(/\b(public\s+administration|pub\s+ad|pa)\b/gi, ' __SUB_PA__ ')
    .replace(/\b(home\s+science|home\s+sci|hsc)\b/gi, ' __SUB_HSC__ ')
    .replace(/\b(islamic\s+studies|isl\s+stud|is)\b/gi, ' __SUB_IS__ ')
    .replace(/\b(non-med|non\s*med|non-medical|medical|med|studied|applied)\b/gi, ' ');

  // Map known keywords / tokens to standard uppercase abbreviations
  const subMap = [
    { regex: /__SUB_EN__|\b(english|eng|en)\b/i, code: 'EN' },
    { regex: /\b(physics|ph)\b/i, code: 'PH' },
    { regex: /\b(chemistry|chem|ch)\b/i, code: 'CH' },
    { regex: /\b(biology|botany|zoology|bio|bot|zoo|bi|bo|zo)\b/i, code: 'BI' },
    { regex: /__SUB_AM__|\b(mathematics|maths|math|ma)\b/i, code: 'MA' },
    { regex: /__SUB_SS__\b/i, code: 'SS' },
    { regex: /\b(urdu|ur)\b/i, code: 'UR' },
    { regex: /\b(hindi|hn)\b/i, code: 'HN' },
    { regex: /\b(education|edu|ed)\b/i, code: 'ED' },
    { regex: /\b(history|hist|ht)\b/i, code: 'HT' },
    { regex: /__SUB_PS__\b/i, code: 'PS' },
    { regex: /\b(economics|eco|ec)\b/i, code: 'EC' },
    { regex: /__SUB_ES__\b/i, code: 'ES' },
    { regex: /__SUB_PD__\b/i, code: 'PD' },
    { regex: /__SUB_HTC__\b/i, code: 'HTC' },
    { regex: /__SUB_ITE__|\b(ite|it)\b/i, code: 'ITE' },
    { regex: /\b(sociology|soc|so)\b/i, code: 'SO' },
    { regex: /\b(arabic|ar)\b/i, code: 'AR' },
    { regex: /\b(persian|pr|pe)\b/i, code: 'PR' },
    { regex: /\b(kashmiri|ks)\b/i, code: 'KS' },
    { regex: /\b(geography|geo|gg)\b/i, code: 'GG' },
    { regex: /\b(geology|gl)\b/i, code: 'GL' },
    { regex: /__SUB_CS__\b/i, code: 'CS' },
    { regex: /__SUB_BS__\b/i, code: 'BS' },
    { regex: /__SUB_EP__\b/i, code: 'EP' },
    { regex: /__SUB_PA__\b/i, code: 'PA' },
    { regex: /__SUB_HSC__\b/i, code: 'HSC' },
    { regex: /__SUB_IS__\b/i, code: 'IS' },
    { regex: /\b(accountancy|accounts|acc|ay)\b/i, code: 'AY' },
    ...(isSecondary ? [{ regex: /\b(science|sci|sc)\b/i, code: 'SC' }] : [])
  ];

  const foundCodes = [];
  subMap.forEach(item => {
    if (item.regex.test(cleanRaw)) {
      if (!foundCodes.includes(item.code)) {
        foundCodes.push(item.code);
      }
    }
  });

  // Strict Stream Guard & Science Foundation for Higher Secondary (11th & 12th)
  if (!isSecondary) {
    const stStream = resolveStudentStream(st, className).toLowerCase();
    const hasMedical = foundCodes.includes('BI') || foundCodes.includes('BO') || foundCodes.includes('ZO') || (stStream.includes('med') && !stStream.includes('non'));
    const isScience = stStream.includes('science') || stStream.includes('med') || stStream.includes('sci') || hasMedical || foundCodes.includes('PH') || foundCodes.includes('CH');

    if (isScience) {
      const artsOnly = new Set(['ED', 'HT', 'PS', 'SO', 'AR', 'PR', 'SC']);
      for (let i = foundCodes.length - 1; i >= 0; i--) {
        if (artsOnly.has(foundCodes[i])) {
          foundCodes.splice(i, 1);
        }
      }

      // Mandatory foundation subjects for all Higher Secondary Science students
      if (!foundCodes.includes('EN')) foundCodes.unshift('EN');
      if (!foundCodes.includes('PH')) {
        const enIdx = foundCodes.indexOf('EN');
        foundCodes.splice(enIdx + 1, 0, 'PH');
      }
      if (!foundCodes.includes('CH')) {
        const phIdx = foundCodes.indexOf('PH');
        foundCodes.splice(phIdx + 1, 0, 'CH');
      }
      if (hasMedical && !foundCodes.includes('BI') && !foundCodes.includes('BO') && !foundCodes.includes('ZO')) {
        foundCodes.push('BI');
      }
    }
  }

  if (isSecondary) {
    if (!foundCodes.includes('UR') && !foundCodes.includes('HN')) {
      foundCodes.push('UR');
    }
    const secondaryOrder = ['EN', 'MA', 'SC', 'SS', 'UR', 'HTC', 'ITE', 'HN'];
    const ordered = [];
    secondaryOrder.forEach(code => {
      if (foundCodes.includes(code)) {
        ordered.push(code);
      }
    });
    foundCodes.forEach(code => {
      if (!ordered.includes(code)) ordered.push(code);
    });
    return ordered.length > 0 ? ordered.join(', ') : 'EN, MA, SC, SS, UR';
  }

  if (foundCodes.length > 0) {
    return foundCodes.join(', ');
  }

  // Clean raw string fallback (normalize Botany/Zoology to BI)
  if (isSecondary) return 'EN, MA, SC, SS, UR';
  return raw
    .replace(/botany|zoology/gi, 'BI')
    .replace(/biology/gi, 'BI')
    .replace(/,/g, ', ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Canonical enrollment validation for a student in a specific practical / assessment subject.
 * Guaranteed to respect stream boundaries (e.g. Science students never enrolled in Arts subjects like ED).
 */
export function isStudentEnrolledInPracticalSubject(st, subCode, className = '') {
  if (!st || !subCode) return false;
  const code = subCode.toUpperCase().trim();
  const clsName = String(
    className ||
    st?.Class ||
    st?.class ||
    st?.className ||
    st?.['Admission sought for class'] ||
    st?.['Class for Admission'] ||
    st?.['Class for which Admission Sought'] ||
    st?.['Class Enrolled'] ||
    st?.admittedClass ||
    ''
  ).toLowerCase();
  const isSecondary = clsName.includes('9') || clsName.includes('10') || clsName.includes('ix') || clsName.includes('x');

  // Secondary School (Class 9th & 10th) Authoritative Enrollment:
  if (isSecondary) {
    if (['EN', 'MA', 'SC', 'SS', 'UR'].includes(code)) return true;
    const rawSub = resolveStudentSubjectsRaw(st, className).toUpperCase();
    if (code === 'HTC') return /\b(HTC|HC|HEALTH|HEALTHCARE)\b/i.test(rawSub) || (st.vocationalSubject && /health/i.test(st.vocationalSubject));
    if (code === 'ITE') return /\b(ITE|IT|ITES|INFORMATION\s*TECHNOLOGY)\b/i.test(rawSub) || (st.vocationalSubject && /it|ites/i.test(st.vocationalSubject));
    return false;
  }

  const stStream = resolveStudentStream(st, className).toLowerCase();
  const abbrStr = getAbbreviatedSubjects(st, className);
  const abbrList = abbrStr.split(',').map(s => s.trim().toUpperCase());

  const hasMedicalSubs = abbrList.includes('BO') || abbrList.includes('ZO') || abbrList.includes('BI') || (stStream.includes('med') && !stStream.includes('non'));
  const isScience = stStream.includes('science') || stStream.includes('med') || stStream.includes('sci') || hasMedicalSubs || abbrList.includes('PH') || abbrList.includes('CH');

  // Science Stream Guard: Science students are NEVER enrolled in Arts-only electives or Secondary 'SC'
  if (isScience && ['ED', 'HT', 'PS', 'SO', 'AR', 'PR', 'SC'].includes(code)) {
    return false;
  }

  // General English is taken by all Higher Secondary students
  if (code === 'EN') return true;

  // Compulsory Science Foundation Subjects: All Science students take Physics and Chemistry
  if ((code === 'PH' || code === 'CH') && isScience) return true;

  // Biology equivalence: BI encompasses BO and ZO
  if (code === 'BI' && (abbrList.includes('BO') || abbrList.includes('ZO') || hasMedicalSubs)) return true;
  if ((code === 'BO' || code === 'ZO') && (abbrList.includes('BI') || hasMedicalSubs)) return true;

  // Direct subject code match
  if (abbrList.includes(code)) return true;

  // Physical Education alias: PD / PE
  if (code === 'PD' && (abbrList.includes('PE') || abbrList.includes('PED'))) return true;

  // Mathematics: Non-Medical students
  if (code === 'MA' && (stStream.includes('non-med') || stStream.includes('nonmed'))) return true;

  return false;
}

/**
 * 4. Print Attendance Sheet for Selected Students
 * Enhanced with separate Class Roll No & Exam Roll No columns, Board Reg No, compact abbreviated subjects, and standard 50px row height for signatures.
 */
export function printAttendanceSheet({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  isExternal = false,
  evaluationType = '',
  practicalType = '',
  subjectTitle = '',
  subjectCode = '',
  subjectName = '',
  selectedSubjectCodes = null
}) {
  if (!students || students.length === 0) return false;
  students = students.filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
  if (students.length === 0) return false;

  const titles = resolveAwardRollTitles(evaluationType || practicalType, isExternal);
  const isClass10 = String(className).toLowerCase().includes('10');
  const hseText = isClass10
    ? 'Secondary School Examination (Class 10th)'
    : className === '11th'
      ? 'HSE-I (Class 11th)'
      : 'HSE-II (Class 12th)';
  const examAttendanceTitle = titles.heading.replace(/\s+AWARD\s+ROLL$/i, '');

  const singleSubCode = (subjectCode || '').trim().toUpperCase();

  // 1. Multi-Subject Batch Attendance: Iterate through subjects and build separated pages
  if (!singleSubCode && selectedSubjectCodes && Array.isArray(selectedSubjectCodes) && selectedSubjectCodes.length > 0) {
    const targetSubs = PRACTICAL_SUBJECT_DEFS.filter(s => selectedSubjectCodes.includes(s.code));
    let combinedHtml = '';

    targetSubs.forEach((sub, subIdx) => {
      const subStudents = students.filter(st => isStudentEnrolledInPracticalSubject(st, sub.code, className));
      if (subStudents.length === 0) return;

      const isLast = subIdx === targetSubs.length - 1;
      combinedHtml += `
        <div class="award-page ${!isLast ? 'page-break' : ''}">
          <div style="text-align: center; margin-bottom: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 8px;">
            <h1 style="font-size: 14pt; font-weight: 800; margin: 0; text-transform: uppercase; color: #0f172a;">Govt. Higher Secondary School Shangus</h1>
            <h2 style="font-size: 11pt; font-weight: 800; margin: 4px 0; color: #1e293b;">${examAttendanceTitle} ATTENDANCE SHEET — ${hseText} — ${getSubjectDisplayName(sub.code, className)} (${sub.code})</h2>
            <p style="font-size: 9.5pt; font-weight: 700; margin: 2px 0; color: #475569;">Session & Year: <strong>${session}</strong></p>
            <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: 700; margin-top: 6px; color: #334155;">
              <span>No.: ____________________</span>
              <span>Date: ____________________</span>
            </div>
          </div>

          <table class="award-table attendance-table" style="font-size: 9.5pt; width: 100%;">
            <thead>
              <tr style="height: 32px;">
                <th style="width: 5%;">S.No.</th>
                <th style="width: 10%;">Class R.No.</th>
                <th style="width: 15%;">Exam Roll No.</th>
                <th style="width: 32%; text-align: left; padding-left: 8px;">Student Name</th>
                <th style="width: 38%;">Candidate Signature</th>
              </tr>
            </thead>
            <tbody>
      `;

      subStudents.forEach((st, idx) => {
        const classRoll = st['Class Roll No'] || st['Class R.No.'] || st.classRollNo || st.rollNo || (idx + 1);
        const rawExam = getRecordExamRoll(st, className) || getStudentExamRoll(st);
        const examRoll = (rawExam && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(String(rawExam).trim())) ? String(rawExam).trim() : '—';
        const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
        const rawReg = st['Board Registration Number'] || st['Board Reg. No.'] || st['Board Registration No. (Class 11th)'] || st['Board Registration No. (Class 10th)'] || st.boardRegNo || st.regNo || '';
        const regNo = String(rawReg).trim();

        combinedHtml += `
          <tr style="page-break-inside: avoid !important; break-inside: avoid !important;">
            <td style="text-align: center; font-size: 9pt; color: #475569;">${idx + 1}</td>
            <td style="text-align: center; font-weight: 800; font-size: 10pt; color: #0f172a;">${classRoll}</td>
            <td style="text-align: center; font-weight: 800; font-family: monospace; font-size: 10.5pt; color: #1e293b;">${examRoll}</td>
            <td style="text-align: left; padding: 4px 8px;">
              <div class="student-name-block">
                <div style="font-weight: 700; font-size: 10pt; color: #0f172a; line-height: 1.2;">${toTitleCase(name)}</div>
                ${regNo && regNo !== '—' ? `<div style="font-family: monospace; font-size: 8pt; color: #64748b; font-weight: 600; margin-top: 2px; white-space: nowrap;">Reg: ${regNo}</div>` : ''}
              </div>
            </td>
            <td>&nbsp;</td>
          </tr>
        `;
      });

      combinedHtml += `
            </tbody>
          </table>

          <div class="sig-row" style="margin-top: 35px; font-size: 10pt; font-weight: bold; display: flex; justify-content: space-between;">
            <div>Superintendent Signature: __________________</div>
            <div>Principal Signature: __________________</div>
          </div>
        </div>
      `;
    });

    if (!combinedHtml) return false;
    triggerPrintWindow(combinedHtml, `${titles.shortType} Attendance Sheet (All Subjects) — Class ${className}`);
    return true;
  }

  // 2. Single Subject or Combined Master Roster
  let printStudents = students;
  if (singleSubCode) {
    printStudents = students.filter(st => isStudentEnrolledInPracticalSubject(st, singleSubCode, className));
    if (printStudents.length === 0) return false;
  }

  const resolvedSubjectTitle = subjectTitle || (singleSubCode ? `${getSubjectDisplayName(singleSubCode, className) || subjectName} (${singleSubCode})` : '');

  let html = `
    <div class="award-page">
      <div style="text-align: center; margin-bottom: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 8px;">
        <h1 style="font-size: 14pt; font-weight: 800; margin: 0; text-transform: uppercase; color: #0f172a;">Govt. Higher Secondary School Shangus</h1>
        <h2 style="font-size: 11pt; font-weight: 800; margin: 4px 0; color: #1e293b;">${examAttendanceTitle} ATTENDANCE SHEET — ${hseText}${resolvedSubjectTitle ? ` — ${resolvedSubjectTitle}` : ''}</h2>
        <p style="font-size: 9.5pt; font-weight: 700; margin: 2px 0; color: #475569;">Session & Year: <strong>${session}</strong></p>
        <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: 700; margin-top: 6px; color: #334155;">
          <span>No.: ____________________</span>
          <span>Date: ____________________</span>
        </div>
      </div>

      <table class="award-table attendance-table" style="font-size: 9.5pt; width: 100%;">
        <thead>
          <tr style="height: 32px;">
            <th style="width: 5%;">S.No.</th>
            <th style="width: 9%;">Class R.No.</th>
            <th style="width: 14%;">Exam Roll No.</th>
            <th style="width: 26%; text-align: left; padding-left: 8px;">Student Name</th>
            ${singleSubCode ? '' : '<th style="width: 24%; text-align: left; padding-left: 8px;">Subject(s)</th>'}
            <th style="width: ${singleSubCode ? '46%' : '22%'};">Candidate Signature</th>
          </tr>
        </thead>
        <tbody>
  `;

  printStudents.forEach((st, idx) => {
    const classRoll = st['Class Roll No'] || st['Class R.No.'] || st.classRollNo || st.rollNo || (idx + 1);
    const rawExam = getRecordExamRoll(st, className) || getStudentExamRoll(st);
    const examRoll = (rawExam && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(String(rawExam).trim())) ? String(rawExam).trim() : '—';
    const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
    const rawReg = st['Board Registration Number'] || st['Board Reg. No.'] || st['Board Registration No. (Class 11th)'] || st['Board Registration No. (Class 10th)'] || st.boardRegNo || st.regNo || '';
    const regNo = String(rawReg).trim();
    const subs = getAbbreviatedSubjects(st, className);

    html += `
      <tr style="page-break-inside: avoid !important; break-inside: avoid !important;">
        <td style="text-align: center; font-size: 9pt; color: #475569;">${idx + 1}</td>
        <td style="text-align: center; font-weight: 800; font-size: 10pt; color: #0f172a;">${classRoll}</td>
        <td style="text-align: center; font-weight: 800; font-family: monospace; font-size: 10.5pt; color: #1e293b;">${examRoll}</td>
        <td style="text-align: left; padding: 4px 8px;">
          <div class="student-name-block">
            <div style="font-weight: 700; font-size: 10pt; color: #0f172a; line-height: 1.2;">${toTitleCase(name)}</div>
            ${regNo && regNo !== '—' ? `<div style="font-family: monospace; font-size: 8pt; color: #64748b; font-weight: 600; margin-top: 2px; white-space: nowrap;">Reg: ${regNo}</div>` : ''}
          </div>
        </td>
        ${singleSubCode ? '' : `<td style="text-align: left; padding: 4px 8px; font-size: 8.5pt; font-weight: 700; color: #334155; line-height: 1.3;">${subs}</td>`}
        <td>&nbsp;</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <div class="sig-row" style="margin-top: 35px; font-size: 10pt; font-weight: bold; display: flex; justify-content: space-between;">
        <div>Superintendent Signature: __________________</div>
        <div>Principal Signature: __________________</div>
      </div>
    </div>
  `;

  const attendanceTitle = resolvedSubjectTitle
    ? `${titles.shortType} Attendance Sheet — ${resolvedSubjectTitle} — Class ${className}`
    : `${titles.shortType} Attendance Sheet — Class ${className}`;
  triggerPrintWindow(html, attendanceTitle);
  return true;
}

/**
 * 4.4 Print Subject Marks Record / Award Roll (with Pract Copy/Assignment, Viva Voce, Total columns)
 * Matches requested institution format:
 * - Proper label matching Screenshot 3: "${className} - Marks Record (Practicals/Assignments) - ${subjectName}"
 * - Exactly 7 columns: S.No., Class R.No., Exam Roll No., Student Name (with Reg No), Pract Copy / Assignment, Viva Voce, Total
 * - No Subject column, No Candidate Signature column
 * - Supports single subject or multi-subject batch with page breaks
 */
export function printMarksRecordAwardRoll({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  submissions = [],
  isExternal = false,
  evaluationType = '',
  practicalType = '',
  subjectCode = '',
  subjectName = '',
  selectedSubjectCodes = null,
  printDetails = null
}) {
  if (!students || students.length === 0) return false;
  students = students.filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
  if (students.length === 0) return false;

  const titles = resolveAwardRollTitles(evaluationType || practicalType || printDetails?.practicalType, isExternal);
  const isClass10 = String(className).toLowerCase().includes('10');
  const isClass12 = String(className).toLowerCase().includes('12');
  const clsTarget = isClass10 ? '10' : isClass12 ? '12' : '11';
  const hseText = isClass10
    ? 'Secondary School Examination (Class 10th)'
    : className === '11th'
      ? 'HSE-I (Class 11th)'
      : 'HSE-II (Class 12th)';
  const examLabel = titles.examLabel || (isExternal ? 'External Practical' : 'Internal Practical');

  // Determine target subjects to print
  let targetSubs = [];
  const singleSubCode = (subjectCode || '').trim().toUpperCase();
  if (singleSubCode) {
    const foundDef = PRACTICAL_SUBJECT_DEFS.find(s => s.code === singleSubCode);
    targetSubs = [{
      code: singleSubCode,
      name: getSubjectDisplayName(singleSubCode, className) || subjectName || foundDef?.name || singleSubCode
    }];
  } else if (selectedSubjectCodes && Array.isArray(selectedSubjectCodes) && selectedSubjectCodes.length > 0) {
    targetSubs = PRACTICAL_SUBJECT_DEFS.filter(s => selectedSubjectCodes.includes(s.code));
  } else {
    targetSubs = PRACTICAL_SUBJECT_DEFS.filter(s => {
      return students.some(st => isStudentEnrolledInPracticalSubject(st, s.code, className));
    });
  }

  if (targetSubs.length === 0) return false;

  let combinedHtml = '';

  targetSubs.forEach((sub, subIdx) => {
    // Subject-specific enrolled students
    const subStudents = students.filter(st => isStudentEnrolledInPracticalSubject(st, sub.code, className));
    if (subStudents.length === 0) return;

    // Find corresponding teacher submission if exists
    const subDoc = submissions.find(s => {
      const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
      if (!matchClass) return false;
      const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
      if (evaluationType || practicalType) {
        const target = String(evaluationType || practicalType).toLowerCase();
        if (sType !== target && !sType.includes(target) && !target.includes(sType)) {
          const targetNorm = target.includes('ext') ? 'external' : 'internal';
          if (sType !== targetNorm && !sType.includes(targetNorm)) return false;
        }
      } else {
        const targetType = isExternal ? 'external' : 'internal';
        if (sType !== targetType && !sType.includes(targetType)) return false;
      }
      const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
      return isMatchingSubjectCode(codeStr, sub.code);
    });

    const isLastSub = subIdx === targetSubs.length - 1;

    combinedHtml += `
      <div class="award-page ${!isLastSub ? 'page-break' : ''}">
        <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 8px;">
          <h1 style="font-size: 14pt; font-weight: 800; margin: 0; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">Govt. Higher Secondary School Shangus</h1>
          <h2 style="font-size: 11pt; font-weight: 800; margin: 4px 0; color: #1e293b;">${className} - Marks Record (Practicals/Assignments) - ${getSubjectDisplayName(sub.code, className)}</h2>
          <p style="font-size: 9pt; font-weight: 700; margin: 2px 0; color: #475569;">
            Session & Year: <strong>${session}</strong> &nbsp;|&nbsp; 
            Class: <strong>${hseText}</strong> &nbsp;|&nbsp; 
            Evaluation: <strong>${examLabel}</strong>
          </p>
          <div style="display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 700; margin-top: 6px; color: #334155;">
            <span>No.: ____________________</span>
            <span>Max Marks: _______</span>
            <span>Date of Exam: ____________________</span>
          </div>
        </div>

        <table class="award-table" style="font-size: 9pt; width: 100%; margin-top: 6px;">
          <thead>
            <tr style="height: 32px; background: #1e293b; color: #ffffff;">
              <th style="width: 5%; text-align: center;">S.No.</th>
              <th style="width: 10%; text-align: center;">Class R.No.</th>
              <th style="width: 15%; text-align: center;">Exam Roll No.</th>
              <th style="width: 34%; text-align: left; padding-left: 8px;">Student Name</th>
              <th style="width: 12%; text-align: center;">Pract Copy / Assignment</th>
              <th style="width: 12%; text-align: center;">Viva Voce</th>
              <th style="width: 12%; text-align: center;">Total</th>
            </tr>
          </thead>
          <tbody>
    `;

    subStudents.forEach((st, idx) => {
      const classRoll = st['Class Roll No'] || st['Class R.No.'] || st.classRollNo || st.rollNo || (idx + 1);
      const rawExam = getRecordExamRoll(st, className) || getStudentExamRoll(st);
      const examRoll = (rawExam && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(String(rawExam).trim())) ? String(rawExam).trim() : '—';
      const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
      const rawReg = st['Board Registration Number'] || st['Board Reg. No.'] || st['Board Registration No. (Class 11th)'] || st['Board Registration No. (Class 10th)'] || st.boardRegNo || st.regNo || '';
      const regNo = String(rawReg).trim();

      const markRec = findStudentMarkRecord(subDoc, st);
      const isAbs = markRec && String(markRec.totalMarks ?? markRec.practicalMarks ?? '').toUpperCase() === 'AB';
      const pMark = markRec ? (markRec.pracMarks ?? markRec.practicalMarks ?? '') : '';
      const vMark = markRec ? (markRec.vivaMarks ?? '') : '';
      const tMark = markRec ? (markRec.totalMarks ?? markRec.practicalMarks ?? '') : '';

      combinedHtml += `
        <tr style="height: 38px; page-break-inside: avoid !important; break-inside: avoid !important;">
          <td style="text-align: center; color: #475569; font-size: 8.5pt;">${idx + 1}</td>
          <td style="text-align: center; font-weight: 800; font-size: 9.5pt; color: #0f172a;">${classRoll}</td>
          <td style="text-align: center; font-weight: 800; font-family: monospace; font-size: 10pt; color: #1e293b;">${examRoll}</td>
          <td style="text-align: left; padding: 3px 8px;">
            <div class="student-name-block">
              <div style="font-weight: 700; font-size: 9.5pt; color: #0f172a; line-height: 1.2;">${toTitleCase(name)}</div>
              ${regNo && regNo !== '—' ? `<div style="font-family: monospace; font-size: 7.5pt; color: #64748b; font-weight: 600; margin-top: 2px; white-space: nowrap;">Reg: ${regNo}</div>` : ''}
            </div>
          </td>
          <td style="text-align: center; font-weight: 700; font-size: 9.5pt; color: #0f172a;">${isAbs ? 'AB' : (pMark !== '' ? pMark : '&nbsp;')}</td>
          <td style="text-align: center; font-weight: 700; font-size: 9.5pt; color: #0f172a;">${isAbs ? 'AB' : (vMark !== '' ? vMark : '&nbsp;')}</td>
          <td style="text-align: center; font-weight: 800; font-size: 10pt; background: #f8fafc; color: #0f172a;">${isAbs ? '<span class="absent-text">AB</span>' : (tMark !== '' ? `<strong>${tMark}</strong>` : '&nbsp;')}</td>
        </tr>
      `;
    });

    combinedHtml += `
          </tbody>
        </table>

        <div class="sig-row" style="margin-top: 30px; font-size: 9.5pt; font-weight: 700; display: flex; justify-content: space-between;">
          <div>Subject Teacher Signature: __________________</div>
          <div>Internal Examiner: __________________</div>
          <div>Principal Signature: __________________</div>
        </div>
      </div>
    `;
  });

  if (!combinedHtml) return false;

  const docTitle = targetSubs.length === 1
    ? `${className} - Marks Record (Practicals/Assignments) - ${targetSubs[0].name}`
    : `${className} - Marks Record (Practicals/Assignments) - All Subjects`;

  triggerPrintWindow(combinedHtml, docTitle);
  return true;
}

/**
 * 4.5 Print All Individual Subject Award Rolls (for Admin Panel)
 * Iterates through all chosen subjects and prints official 2-column 50-student/page award rolls.
 */
export function printAllIndividualAwardRolls({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  submissions = [],
  isExternal = false,
  evaluationType = '',
  practicalType = '',
  examTitle = '',
  selectedSubjectCodes = null,
  printDetails = null,
  centreNo = ''
}) {
  if (!students || students.length === 0) return false;
  students = students.filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
  if (students.length === 0) return false;

  const titles = resolveAwardRollTitles(evaluationType || practicalType || examTitle || printDetails?.practicalType, isExternal);
  const heading = titles.heading;
  const examType = titles.examLabel;

  const activeSubs = PRACTICAL_SUBJECT_DEFS.filter(s => {
    if (!selectedSubjectCodes || !Array.isArray(selectedSubjectCodes) || selectedSubjectCodes.length === 0) return true;
    return selectedSubjectCodes.includes(s.code);
  });

  const isClass10 = String(className).toLowerCase().includes('10');
  const isClass12 = String(className).toLowerCase().includes('12');
  const clsTarget = isClass10 ? '10' : isClass12 ? '12' : '11';
  const pageSize = 50;

  let combinedHtml = '';

  activeSubs.forEach(sub => {
    const subDoc = submissions.find(s => {
      const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
      if (!matchClass) return false;
      const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
      if (evaluationType || practicalType) {
        const target = String(evaluationType || practicalType).toLowerCase();
        if (sType !== target && !sType.includes(target) && !target.includes(sType)) {
          const targetNorm = target.includes('ext') ? 'external' : 'internal';
          if (sType !== targetNorm && !sType.includes(targetNorm)) return false;
        }
      } else {
        const targetType = isExternal ? 'external' : 'internal';
        if (sType !== targetType && !sType.includes(targetType)) return false;
      }
      const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
      return isMatchingSubjectCode(codeStr, sub.code);
    });

    const markCfg = getSubjectMarksConfig(printDetails?.settings || printDetails, className, isExternal ? 'external' : 'internal', sub.code);
    const maxMarks = subDoc?.maxMarks || markCfg.max;
    const minMarks = markCfg.min || Math.ceil(maxMarks * 0.36);

    const subjectStudents = [];

    students.forEach((st, idx) => {
      const isEnrolled = isStudentEnrolledInPracticalSubject(st, sub.code, className);
      const markRec = findStudentMarkRecord(subDoc, st);
      if (isEnrolled || markRec) {
        const rawMark = markRec ? String(markRec.totalMarks ?? markRec.practicalMarks ?? '').trim() : '';
        const rawExamRoll = getRecordExamRoll(st, className) || getStudentExamRoll(st);
        const displayExamRoll = rawExamRoll || '—';
        const cNo = getStudentCentreNo(st, centreNo, className);

        subjectStudents.push({
          sno: subjectStudents.length + 1,
          rollNo: displayExamRoll,
          examRollNo: rawExamRoll,
          classRollNo: getRecordClassRoll(st),
          name: st.name || st.studentName || '',
          marks: rawMark,
          totalMarks: rawMark,
          centreNo: cNo
        });
      }
    });

    if (subjectStudents.length === 0) return;

    // Arrange records in dictionary order by exam roll number so centre numbers do not repeat
    const sortedSubjectStudents = sortRecordsForAwardRoll(subjectStudents).map((rec, i) => ({
      ...rec,
      sno: i + 1
    }));
    const totalPages = Math.ceil(sortedSubjectStudents.length / pageSize);

    for (let p = 0; p < totalPages; p++) {
      const pageRecords = sortedSubjectStudents.slice(p * pageSize, (p + 1) * pageSize);
      const leftChunk = pageRecords.slice(0, 25);
      const rightChunk = pageRecords.slice(25, 50);

      const leftPageNo = p * 2 + 1;
      const rightPageNo = p * 2 + 2;

      const renderColumn = (colChunk, startSno, pageNo) => {
        // Calculate dynamic counts if any marks have been entered
        let presentCount = 0;
        let absentCount = 0;
        let passCount = 0;
        let failCount = 0;
        let hasMarksEntered = false;

        colChunk.forEach(r => {
          const rawMark = String(r.totalMarks ?? r.practicalMarks ?? r.marks ?? '').trim();
          if (rawMark && !/^(N\/A|—|-|null|undefined)$/i.test(rawMark)) {
            hasMarksEntered = true;
            const upper = rawMark.toUpperCase();
            if (upper === 'AB' || upper === 'A' || upper === 'ABSENT') {
              absentCount++;
              failCount++;
            } else {
              const num = Number(rawMark);
              if (!isNaN(num)) {
                presentCount++;
                if (num >= minMarks) {
                  passCount++;
                } else {
                  failCount++;
                }
              }
            }
          }
        });

        let colHtml = `
          <div class="award-col-box">
            <div class="award-header-block">
              <h2>${heading}</h2>
              <div class="award-info-line">
                <span>Examination: <strong>${examType}</strong></span>
                <span>Page No.: <strong>${pageNo}</strong></span>
              </div>
              <div class="award-info-line">
                <span>Subject: <strong>${getSubjectDisplayName(sub.code, className)} (${sub.code})</strong></span>
                <span>Max.: <strong>${maxMarks}</strong>; Min.: <strong>${minMarks}</strong></span>
              </div>
              <div class="award-info-line">
                <span>Session: <strong>${session}</strong></span>
                <span>Class: <strong>${className?.toLowerCase().includes('class') ? className : `Class ${className}`}</strong></span>
              </div>
            </div>

            <table class="award-table">
              <thead>
                <tr>
                  <th style="width: 12%;">S.No.</th>
                  <th style="width: 28%;">Exam R.No.</th>
                  <th style="width: 28%;">Marks<br>(Figures)</th>
                  <th style="width: 32%;">Marks<br>(Words)</th>
                </tr>
              </thead>
              <tbody>
        `;

        let currentCentre = '';

        colChunk.forEach((r, idx) => {
          const sno = startSno + idx;
          const rollNo = r.rollNo || '—';
          const rawMark = String(r.totalMarks ?? r.practicalMarks ?? r.marks ?? '').trim();
          const isAbs = rawMark.toUpperCase() === 'AB' || rawMark.toUpperCase() === 'A' || rawMark.toUpperCase() === 'ABSENT';

          const rCentre = r.centreNo || getStudentCentreNo(r, centreNo);
          if (rCentre && rCentre !== currentCentre) {
            currentCentre = rCentre;
            colHtml += `
              <tr>
                <td colspan="4" class="centre-num-row">centre no. ${currentCentre}</td>
              </tr>
            `;
          } else if (!rCentre && !currentCentre && idx === 0) {
            currentCentre = '—';
            colHtml += `
              <tr>
                <td colspan="4" class="centre-num-row">centre no. &nbsp;____________________</td>
              </tr>
            `;
          }

          colHtml += `
            <tr>
              <td>${sno}</td>
              <td><strong>${rollNo}</strong></td>
              <td>${isAbs ? '<span class="absent-text">Absent</span>' : `<strong>${rawMark || '—'}</strong>`}</td>
              <td>${isAbs ? '-' : numberToWordsInr(rawMark)}</td>
            </tr>
          `;
        });

        for (let pad = colChunk.length; pad < 25; pad++) {
          colHtml += `
            <tr>
              <td>${startSno + pad}</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          `;
        }

        colHtml += `
              </tbody>
            </table>

            <div class="award-footer">
              <div class="award-footer-row">
                <div class="award-footer-field">
                  <span>No. of Candidates Present:</span>
                  ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace;">${presentCount}</strong>` : `<span class="fill-blank"></span>`}
                </div>
                <div class="award-footer-field">
                  <span>Absent:</span>
                  ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace; ${absentCount > 0 ? 'color: #dc2626;' : ''}">${absentCount}</strong>` : `<span class="fill-blank"></span>`}
                </div>
              </div>

              <div class="award-footer-row">
                <div class="award-footer-field">
                  <span>No. of Candidates Passed:</span>
                  ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace; color: #16a34a;">${passCount}</strong>` : `<span class="fill-blank"></span>`}
                </div>
                <div class="award-footer-field">
                  <span>Failed:</span>
                  ${hasMarksEntered ? `<strong style="font-size: 9.5pt; font-family: monospace; ${failCount > 0 ? 'color: #dc2626;' : ''}">${failCount}</strong>` : `<span class="fill-blank"></span>`}
                </div>
              </div>

              <div class="award-footer-sig-block">
                <div class="award-footer-sig-line">
                  <span>Signature of Examiner:</span>
                  <span class="fill-blank-lg"></span>
                </div>

                <div class="award-footer-date-line">
                  <span>Date of Submission of Awards:</span>
                  <span class="fill-blank-md"></span>
                </div>

                <div class="award-footer-head-line">
                  <span>Signature of Head of Institution:</span>
                  <span class="fill-blank-lg"></span>
                </div>
              </div>
            </div>
          </div>
        `;
        return colHtml;
      };

      combinedHtml += `
        <div class="award-page page-break">
          <div class="two-col-grid">
            ${renderColumn(leftChunk, p * pageSize + 1, leftPageNo)}
            ${renderColumn(rightChunk, p * pageSize + 26, rightPageNo)}
          </div>
        </div>
      `;
    }
  });

  if (!combinedHtml) return false;

  triggerPrintWindow(combinedHtml, `${heading} (All Subjects) — Class ${className}`);
  return true;
}

/**
 * 5. Print Fail / Absent Student List
 * Enhanced with accurate student subject enrollment verification, session isolation,
 * pending submission integration, and a comprehensive Institutional Pending Awards Status Overview.
 */
export function printFailList({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  submissions = [],
  pendingSubmissions = [],
  selectedSubjectCodes = null,
  isExternal = false,
  evaluationType = '',
  practicalType = '',
  printDetails = null
}) {
  if (!students || students.length === 0) return false;
  students = students.filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
  if (students.length === 0) return false;

  const titles = resolveAwardRollTitles(evaluationType || practicalType || printDetails?.practicalType, isExternal);
  const isClass10 = String(className).toLowerCase().includes('10');
  const hseText = isClass10
    ? 'Secondary School Examination (Class 10th)'
    : className === '11th'
      ? 'HSE-I (Class 11th)'
      : 'HSE-II (Class 12th)';
  const examType = titles.examLabel;

  const targetSess = session && session !== 'all' ? normalizePracticalSession(session) : '';
  const clsTarget = className.toLowerCase().replace(/[^0-9]/g, '');

  const isSubDocMatch = (s) => {
    if (!s) return false;
    const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
    if (!matchClass) return false;

    // Strict session check to avoid mixing old/prior-year submissions
    if (targetSess && targetSess !== 'all') {
      const subSess = normalizePracticalSession(s.sessionText || s.session || s.Session || s.yearSuffix || '');
      if (subSess && subSess !== 'all' && subSess !== targetSess) return false;
    }

    const sType = String(s.practicalType || s.PracticalType || s.evaluationType || s.evalType || 'internal').toLowerCase();
    const targetNorm = (String(evaluationType || practicalType || (isExternal ? 'external' : 'internal'))).toLowerCase().includes('ext') ? 'external' : 'internal';
    const sNorm = sType.includes('ext') ? 'external' : 'internal';
    if (sNorm !== targetNorm) return false;

    return true;
  };

  const approvedSubs = (submissions || []).filter(isSubDocMatch);
  const pendingSubs = (pendingSubmissions || []).filter(isSubDocMatch);

  const activeSubs = PRACTICAL_SUBJECT_DEFS.filter(s => {
    if (!selectedSubjectCodes || !Array.isArray(selectedSubjectCodes) || selectedSubjectCodes.length === 0) return true;
    return selectedSubjectCodes.includes(s.code);
  });

  // Build subject-level status list (Approved, Pending Approval, or Awaiting Teacher Submission)
  const subjectStatusOverview = [];
  let pendingCount = 0;
  let unsubmittedCount = 0;
  let approvedCount = 0;

  activeSubs.forEach(sub => {
    const enrolledStudents = students.filter(st => isStudentEnrolledInPracticalSubject(st, sub.code, className));
    if (enrolledStudents.length === 0) return; // Only track subjects offered by this student cohort

    let doc = approvedSubs.find(s => {
      const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
      return isMatchingSubjectCode(codeStr, sub.code);
    });
    let isPendingDoc = false;

    if (!doc) {
      doc = pendingSubs.find(s => {
        const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
        return isMatchingSubjectCode(codeStr, sub.code);
      });
      if (doc) isPendingDoc = true;
    }

    let statusKey = 'unsubmitted';
    let statusLabel = 'Awaiting Teacher Submission';
    let teacherName = '—';
    let submittedDate = '—';
    let evaluatedCount = 0;

    if (doc) {
      teacherName = doc.submittedByName || doc.teacherName || doc.submittedBy || 'Faculty Member';
      const rawDate = doc.submittedAt || doc.updatedAt || doc.createdAt;
      submittedDate = rawDate
        ? (typeof rawDate.toDate === 'function' ? rawDate.toDate().toLocaleDateString('en-GB') : String(rawDate).substring(0, 10))
        : 'Submitted';
      evaluatedCount = Array.isArray(doc.records) ? doc.records.length : 0;

      if (isPendingDoc) {
        statusKey = 'pending';
        statusLabel = 'Pending Admin Approval';
        pendingCount++;
      } else {
        statusKey = 'approved';
        statusLabel = 'Approved / Finalized';
        approvedCount++;
      }
    } else {
      unsubmittedCount++;
    }

    subjectStatusOverview.push({
      code: sub.code,
      name: getSubjectDisplayName(sub.code, className),
      enrolledCount: enrolledStudents.length,
      evaluatedCount,
      teacherName,
      submittedDate,
      statusKey,
      statusLabel,
      isPendingDoc
    });
  });

  let failRecords = [];

  students.forEach((st) => {
    const rawExamRoll = getRecordExamRoll(st, className) || getStudentExamRoll(st);
    const examRoll = (rawExamRoll && !/^(N\/A|—|-|null|undefined)$/i.test(String(rawExamRoll).trim())) ? String(rawExamRoll).trim() : '—';
    const classRoll = String(st['Class R.No.'] || st['Class Roll No'] || st['Class Roll No.'] || st.classRollNo || st.rollNo || st.roll || '—').trim();
    const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
    const fatherName = st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || st.parentage || '—';

    activeSubs.forEach(sub => {
      // 1. CRITICAL: Strictly verify that student is actually enrolled in this practical subject!
      if (!isStudentEnrolledInPracticalSubject(st, sub.code, className)) {
        return; // Skip: Student does not take this subject (e.g. Science students never take Arts subjects; Non-Medical never takes Botany/Zoology)
      }

      // 2. Find matching submission doc for this session and subject
      let subDoc = approvedSubs.find(s => {
        const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
        return isMatchingSubjectCode(codeStr, sub.code);
      });
      let isPending = false;

      if (!subDoc) {
        subDoc = pendingSubs.find(s => {
          const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
          return isMatchingSubjectCode(codeStr, sub.code);
        });
        if (subDoc) isPending = true;
      }

      // If no submission exists at all for this subject in the target session:
      // Do NOT falsely mark the student absent! The award has not been submitted by the teacher yet.
      if (!subDoc) {
        return;
      }

      const markCfg = getSubjectMarksConfig(printDetails?.settings || printDetails, className, isExternal ? 'external' : 'internal', sub.code);
      const minMarks = markCfg.min || Math.ceil(markCfg.max * 0.36);

      const rec = findStudentMarkRecord(subDoc, st);
      if (rec) {
        const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim().toUpperCase();
        const subjectLabel = `${getSubjectDisplayName(sub.code, className)} (${sub.code})`;

        if (rawMark === 'AB' || rawMark === 'A' || rawMark === 'ABSENT') {
          failRecords.push({
            rollNo: examRoll,
            classRoll,
            name,
            fatherName,
            subject: subjectLabel,
            status: isPending ? 'ABSENT (Award Pending Admin Approval)' : 'ABSENT',
            isPending,
            isAbsent: true
          });
        } else if (!isNaN(Number(rawMark)) && Number(rawMark) < minMarks) {
          failRecords.push({
            rollNo: examRoll,
            classRoll,
            name,
            fatherName,
            subject: subjectLabel,
            status: isPending
              ? `FAIL (${rawMark}/${markCfg.max}M, Min: ${minMarks}M — Pending Approval)`
              : `FAIL (${rawMark}/${markCfg.max}M, Min: ${minMarks}M)`,
            isPending,
            isAbsent: false
          });
        }
      }
    });
  });

  // Sort fail records by exam roll number (or class roll)
  failRecords.sort((a, b) => {
    const rA = parseInt(String(a.rollNo).replace(/\D/g, '') || '0', 10);
    const rB = parseInt(String(b.rollNo).replace(/\D/g, '') || '0', 10);
    if (rA && rB && rA !== rB) return rA - rB;
    return a.name.localeCompare(b.name);
  });

  let html = `
    <div class="award-page">
      <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #b91c1c; padding-bottom: 8px;">
        <h1 style="font-size: 13.5pt; font-weight: 800; margin: 0; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Govt. Higher Secondary School Shangus</h1>
        <h2 style="font-size: 10.5pt; font-weight: 700; margin: 3px 0; color: #1e293b;">FAIL / ABSENT LIST (${examType}) — ${hseText}</h2>
        <div style="font-size: 9pt; font-weight: 600; margin: 2px 0; color: #475569;">
          <span>Session: <strong style="color: #0f172a;">${session}</strong></span>
          <span style="margin: 0 8px;">•</span>
          <span>Target Class: <strong style="color: #0f172a;">${className}</strong></span>
          <span style="margin: 0 8px;">•</span>
          <span>Generated On: <strong>${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
        </div>
      </div>

      <!-- Institutional Practical Awards & Pending Status Overview -->
      <div style="margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; font-size: 8.5pt;">
        <div style="background: #f1f5f9; padding: 4px 8px; font-weight: bold; color: #334155; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
          <span style="text-transform: uppercase; letter-spacing: 0.5px;">Institutional Award Submissions & Pending Status Overview</span>
          <span style="font-size: 8pt; font-weight: 600; color: #64748b;">
            Approved: <strong style="color: #15803d;">${approvedCount}</strong> | 
            Pending Approval: <strong style="color: #b45309;">${pendingCount}</strong> | 
            Awaiting Submission: <strong style="color: #b91c1c;">${unsubmittedCount}</strong>
          </span>
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 8pt; color: #475569;">
              <th style="padding: 4px 6px; width: 6%;">Code</th>
              <th style="padding: 4px 6px; width: 24%;">Subject Name</th>
              <th style="padding: 4px 6px; width: 9%; text-align: center;">Enrolled</th>
              <th style="padding: 4px 6px; width: 13%; text-align: center;">Evaluated</th>
              <th style="padding: 4px 6px; width: 18%;">Teacher / Evaluator</th>
              <th style="padding: 4px 6px; width: 12%;">Submission Date</th>
              <th style="padding: 4px 6px; width: 18%;">Current Status</th>
            </tr>
          </thead>
          <tbody>
  `;

  subjectStatusOverview.forEach((sObj, sIdx) => {
    const isOdd = sIdx % 2 === 1;
    let badgeBg = '#f1f5f9';
    let badgeColor = '#475569';
    let badgeBorder = '#cbd5e1';

    if (sObj.statusKey === 'approved') {
      badgeBg = '#dcfce7';
      badgeColor = '#166534';
      badgeBorder = '#86efac';
    } else if (sObj.statusKey === 'pending') {
      badgeBg = '#fef3c7';
      badgeColor = '#92400e';
      badgeBorder = '#fcd34d';
    } else {
      badgeBg = '#fee2e2';
      badgeColor = '#991b1b';
      badgeBorder = '#fca5a5';
    }

    html += `
      <tr style="background: ${isOdd ? '#fbfcfe' : '#ffffff'}; border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 3px 6px; font-weight: bold; font-family: monospace;">${sObj.code}</td>
        <td style="padding: 3px 6px; font-weight: 600;">${sObj.name}</td>
        <td style="padding: 3px 6px; text-align: center; font-weight: bold; color: #1e293b;">
          ${sObj.enrolledCount}
        </td>
        <td style="padding: 3px 6px; text-align: center; font-weight: bold;">
          ${sObj.evaluatedCount > 0
            ? `<span style="color: #1e3a8a;">${sObj.evaluatedCount}</span> <span style="font-size: 7.5pt; font-weight: normal; color: #64748b;">(${Math.round((sObj.evaluatedCount / (sObj.enrolledCount || 1)) * 100)}%)</span>`
            : `<span style="color: #94a3b8; font-size: 7.5pt; font-weight: normal; font-style: italic;">0 (Awaiting)</span>`
          }
        </td>
        <td style="padding: 3px 6px; color: #334155;">${sObj.teacherName}</td>
        <td style="padding: 3px 6px; color: #64748b;">${sObj.submittedDate}</td>
        <td style="padding: 3px 6px;">
          <span style="display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 7.5pt; font-weight: bold; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
            ${sObj.statusLabel}
          </span>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
  `;

  // Informative alert banners for pending awards or unsubmitted subjects
  if (pendingCount > 0) {
    const pendingSubjects = subjectStatusOverview.filter(s => s.statusKey === 'pending').map(s => `${s.name} (${s.code})`).join(', ');
    html += `
      <div style="margin-bottom: 10px; padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 8pt; color: #92400e; line-height: 1.4;">
        <strong>⚠️ PENDING AWARDS NOTICE:</strong> Practical awards for <strong>${pendingSubjects}</strong> have been submitted by the respective subject teachers and are currently <strong>Awaiting Administrative Verification & Approval</strong>. Any failing marks or absentees shown below for these subjects are provisional until officially approved.
      </div>
    `;
  }

  if (unsubmittedCount > 0) {
    const unsubmittedSubjects = subjectStatusOverview.filter(s => s.statusKey === 'unsubmitted').map(s => `${s.name} (${s.code})`).join(', ');
    html += `
      <div style="margin-bottom: 10px; padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #64748b; border-radius: 4px; font-size: 8pt; color: #334155; line-height: 1.4;">
        <strong>ℹ️ AWAITING TEACHER SUBMISSIONS:</strong> Awards for <strong>${unsubmittedSubjects}</strong> have not yet been submitted by subject teachers for session ${session}. Enrolled candidates for these subjects are not flagged as absent until official award sheets are finalized.
      </div>
    `;
  }

  // Fail & Absent Student Table
  html += `
      <div style="margin-top: 10px;">
        <h3 style="font-size: 9.5pt; font-weight: bold; color: #991b1b; margin: 0 0 6px 0; text-transform: uppercase;">
          Defaulters List (Candidates Marked Absent or Below Passing Minimum)
        </h3>
        <table class="award-table" style="font-size: 8.5pt;">
          <thead>
            <tr style="background: #fee2e2;">
              <th style="width: 5%;">S.No.</th>
              <th style="width: 12%;">Class Roll</th>
              <th style="width: 15%;">Exam Roll No.</th>
              <th style="width: 25%; text-align: left; padding-left: 8px;">Student Name</th>
              <th style="width: 20%; text-align: left; padding-left: 8px;">Parentage</th>
              <th style="width: 18%;">Subject</th>
              <th style="width: 15%;">Remarks / Status</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (failRecords.length === 0) {
    html += `
      <tr>
        <td colspan="7" style="padding: 24px; text-align: center; font-weight: bold; color: #166534; background: #f0fdf4;">
          <div style="font-size: 11pt; margin-bottom: 4px;">✓ Zero Absentees / Failures Recorded</div>
          <div style="font-size: 8.5pt; font-weight: normal; color: #15803d;">
            All evaluated examinees across submitted practical award rolls for Class ${className} have passed the practical examination.
          </div>
        </td>
      </tr>
    `;
  } else {
    failRecords.forEach((f, idx) => {
      const isOdd = idx % 2 === 1;
      const statusColor = f.isPending ? '#b45309' : '#b91c1c';
      html += `
        <tr style="background: ${isOdd ? '#fff5f5' : '#ffffff'};">
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;"><strong>${f.classRoll}</strong></td>
          <td style="text-align: center;"><strong style="font-family: monospace;">${f.rollNo}</strong></td>
          <td style="text-align: left; padding-left: 8px;"><strong>${f.name}</strong></td>
          <td style="text-align: left; padding-left: 8px; color: #475569;">${f.fatherName}</td>
          <td style="text-align: center;">${f.subject}</td>
          <td style="text-align: center; color: ${statusColor}; font-weight: bold;">${f.status}</td>
        </tr>
      `;
    });
  }

  html += `
          </tbody>
        </table>
      </div>

      <!-- Institutional Sign-Off Certification -->
      <div style="margin-top: 36px; display: flex; justify-content: space-between; text-align: center; font-size: 8.5pt; color: #334155;">
        <div style="width: 28%; border-top: 1px dashed #64748b; padding-top: 6px;">
          <strong>Subject Teacher / Evaluator</strong><br>
          <span style="font-size: 7.5pt; color: #64748b;">Signature & Date</span>
        </div>
        <div style="width: 28%; border-top: 1px dashed #64748b; padding-top: 6px;">
          <strong>Practical Exam Superintendent</strong><br>
          <span style="font-size: 7.5pt; color: #64748b;">Signature & Date</span>
        </div>
        <div style="width: 28%; border-top: 1px dashed #64748b; padding-top: 6px;">
          <strong>Principal / Head of Institution</strong><br>
          <span style="font-size: 7.5pt; color: #64748b;">Official Seal & Signature</span>
        </div>
      </div>
    </div>
  `;

  triggerPrintWindow(html, `Fail & Absent List (${examType}) — Class ${className}`);
  return true;
}

/**
 * Directly triggers the official JKBOSE award roll print dialogue / PDF generator
 * for any historical practical/evaluation record object loaded from Firestore.
 */
export function printHistoricalSubmission(item) {
  if (!item) return false;
  const records = Array.isArray(item.records) ? item.records : (Array.isArray(item.students) ? item.students : []);
  if (records.length === 0) return false;

  const pType = item.practicalType || item.evaluationType || item.examTitle || 'Assessment';
  const isExternal = String(pType).toLowerCase().includes('external');
  const ySuffix = String(item.yearSuffix || item.sessionCanonical || item.session || '');
  const isBiAnnual = /\b(oct|nov|bian|private|bi-annual|mar-apr)\b/i.test(ySuffix);
  const sessionStr = isBiAnnual
    ? `Annual Private / Bi-Annual (${ySuffix})`
    : (ySuffix.toLowerCase().includes('annual') ? ySuffix : (ySuffix ? `Annual Regular ${ySuffix}` : 'Annual Regular 2025-26'));

  const histClass = item.className || item.class || '11th';
  const formattedRecords = records.map(st => {
    const rawP = st.practicalMarks !== undefined && st.practicalMarks !== null ? String(st.practicalMarks).trim() : '';
    const rawV = st.vivaMarks !== undefined && st.vivaMarks !== null ? String(st.vivaMarks).trim() : '';
    const rawTot = st.totalMarks !== undefined && st.totalMarks !== null ? String(st.totalMarks).trim() : '';
    const isAbsent = rawP.toUpperCase() === 'AB' || rawTot.toUpperCase() === 'AB' || rawP.toUpperCase() === 'A';

    return {
      rollNo: String(st.rollNo || st.classRollNo || st.roll || '').trim(),
      name: String(st.name || st.studentName || '').trim(),
      formNo: String(st.formNo || st.form || '').trim(),
      regNo: String(st.regNo || st.boardRegNo || '').trim(),
      examRollNo: String(getRecordExamRoll(st, histClass) || getStudentExamRoll(st) || st.examRollNo || st.rollNo || '').trim(),
      practicalMarks: isAbsent ? 'AB' : (rawP || '—'),
      vivaMarks: isAbsent ? '—' : (rawV || '—'),
      totalMarks: isAbsent ? 'AB' : (rawTot || rawP || '—'),
    };
  });

  return printIndividualAwardRoll({
    subjectCode: item.subjectCode || (item.subject && item.subject.length <= 4 ? item.subject.toUpperCase() : item.subject?.substring(0, 3).toUpperCase()) || 'GEN',
    subjectName: item.subject || 'Subject',
    className: item.className || item.class || '11th',
    session: sessionStr,
    records: formattedRecords,
    isExternal,
    evaluationType: pType,
    practicalType: pType,
    examTitle: pType,
    maxMarks: Number(item.maxMarks) || 50,
    minMarks: Number(item.minMarks) || 18,
  });
}

/**
 * Checks whether an evaluation submission document was created by the currently authenticated teacher.
 * Strictly prevents non-admin teachers from viewing or claiming awards belonging to other faculty.
 */
export function isSubmissionOwnedByTeacher(item, user, authUser) {
  if (!item) return false;

  const currentEmail = String(user?.email || authUser?.email || '').toLowerCase().trim();
  const currentName = String(user?.name || user?.displayName || authUser?.displayName || '').toLowerCase().trim();
  const currentUid = String(user?.uid || authUser?.uid || '').trim();
  const currentSubject = String(user?.subject || user?.assignedSubject || user?.teachingSubject || '').toLowerCase().trim();

  // If no auth identity at all, return false
  if (!currentEmail && !currentName && !currentUid) return false;

  const itemEmail = String(item.submittedByEmail || item.teacherEmail || item.createdByEmail || item.userEmail || '').toLowerCase().trim();
  const itemName = String(item.submittedByName || item.teacherName || item.createdByName || item.authorName || '').toLowerCase().trim();
  const itemBy = String(item.submittedBy || '').toLowerCase().trim();
  const itemUid = String(item.submittedByUid || item.teacherId || item.userId || item.uid || '').trim();

  // Normalization for merged admin -> teacher account alias:
  // Sheikh Gulfam's submissions created under institutional admin account (e.educational.24@gmail.com)
  // are canonically owned by teacher email socialshiftz@gmail.com
  let resolvedItemEmail = itemEmail || (itemBy.includes('@') ? itemBy : '');
  if (resolvedItemEmail.includes('e.educational')) {
    resolvedItemEmail = 'socialshiftz@gmail.com';
  }
  let normalizedCurrentEmail = currentEmail;
  if (normalizedCurrentEmail.includes('e.educational')) {
    normalizedCurrentEmail = 'socialshiftz@gmail.com';
  }

  // 1. UID match takes highest precedence if both present
  if (currentUid && itemUid) {
    if (itemUid === currentUid) return true;
    // If this item was created under e.educational and current teacher is socialshiftz, allow email alias matching even if UIDs differ
    const isGulfamAlias = (itemEmail.includes('e.educational') || resolvedItemEmail === 'socialshiftz@gmail.com') && normalizedCurrentEmail === 'socialshiftz@gmail.com';
    if (!isGulfamAlias) {
      return false; // Explicitly different UID
    }
  }

  // 2. Email match (exact / normalized alias)
  if (resolvedItemEmail) {
    if (normalizedCurrentEmail && resolvedItemEmail === normalizedCurrentEmail) {
      return true;
    }
    // Item carries an explicit email of a different teacher — strictly reject!
    return false;
  }

  // 3. Name match (only if no explicit email recorded on the item)
  const resolvedItemName = itemName || (!itemBy.includes('@') ? itemBy : '');
  if (resolvedItemName && currentName) {
    const normalize = (n) => n.replace(/^(dr\.|mr\.|mrs\.|ms\.|prof\.|sh\.|sheikh|master)\s+/i, '').trim();
    const cleanCur = normalize(currentName);
    const cleanItem = normalize(resolvedItemName);
    if (cleanCur && cleanItem && cleanCur === cleanItem) {
      return true;
    }
    // Name is explicitly recorded and does not match
    return false;
  }

  // 4. Fallback: Only if item has NO submitter identity recorded at all (legacy system imports)
  if (!resolvedItemEmail && !resolvedItemName && !itemUid && currentSubject) {
    const itemSubj = String(item.teacherRegisteredSubject || item.subject || item.subjectName || '').toLowerCase().trim();
    if (itemSubj && isTeacherSubjectMatch(currentSubject, itemSubj)) {
      return true;
    }
  }

  return false;
}


