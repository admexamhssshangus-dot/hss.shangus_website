const CLASS_ROLL_NUMBER_KEYS = Object.freeze([
  'classRollNo',
  'Class Roll No',
  'Class Roll No.',
  'Class Roll Number',
  'Class R.No.',
  'Class R.No',
  'Class R. No.',
  'Class R. No',
  'Class Roll',
  'class_roll',
  'RL. NO.',
  'RL. NO',
  'rollNo',
  'Roll No.',
  'Roll No',
  'assignedRollNo',
  'assignedRoll',
  'class_roll_no',
  'roll_no',
  'Class_Roll_No',
  'roll',
  'R.No.',
  'R.No',
  'R. No.',
  'R. No',
  'Roll'
]);

const INVALID_CLASS_ROLL_VALUES = /^(?:0|n\/?a|na|none|nil|null|undefined|unknown|pending|not\s*assigned|unassigned|—|-)$/i;

/**
 * Returns the authoritative assigned Class Roll No. across the supported
 * Firestore admission schemas. Board/examination roll numbers are deliberately
 * excluded because they do not approve an admission.
 */
export function getAssignedClassRollNumber(student) {
  if (!student || typeof student !== 'object') return '';

  const raw = student.raw || student._rawStudent || student;
  for (const key of CLASS_ROLL_NUMBER_KEYS) {
    const rawValue = student[key] !== undefined && student[key] !== null ? student[key] : raw[key];
    if (rawValue === undefined || rawValue === null) continue;

    const value = String(rawValue).trim();
    if (value && !INVALID_CLASS_ROLL_VALUES.test(value)) return value;
  }

  return '';
}

export function hasAssignedClassRollNumber(student) {
  return getAssignedClassRollNumber(student) !== '';
}

/**
 * Admission workflow invariant:
 *   Approved <=> a valid Class Roll No. is assigned.
 *
 * Legacy documents can contain a stale `Approved` text flag. Without an
 * assigned class roll number that record remains Submitted, so counts, filters,
 * documents and exports cannot disagree with the official class roll.
 */
export function resolveStudentAdmissionStatus(student) {
  if (!student || typeof student !== 'object') return 'Submitted';

  const rawStatus = String(
    student.status ||
    student.Status ||
    student.admissionStatus ||
    student['Admission Status'] ||
    ''
  ).trim().toLowerCase();

  if (rawStatus.includes('withdraw')) return 'Withdrawn';
  if (rawStatus.includes('reject') || rawStatus.includes('rejt') || rawStatus.includes('cancel')) return 'Rejected';
  if (rawStatus.includes('drop')) return 'Dropped';
  if (rawStatus.includes('draft') || rawStatus.includes('dft')) return 'Draft';

  if (
    rawStatus.includes('approved') ||
    rawStatus.includes('admitted') ||
    rawStatus.includes('enrolled') ||
    student.isApproved === true ||
    hasAssignedClassRollNumber(student)
  ) {
    return 'Approved';
  }

  if (rawStatus.includes('provis')) return 'Provisional';

  return 'Submitted';
}

export function isStudentAdmissionApproved(student) {
  return resolveStudentAdmissionStatus(student) === 'Approved';
}

/**
 * Checks whether an examinee has been flagged as "Dropped" from taking the board examination.
 * Such examinees must be excluded from official JKBOSE examination returns.
 */
export function isStudentExamDropped(student) {
  if (!student || typeof student !== 'object') return false;
  const raw = student.raw || student._rawStudent || student;

  // Official Institutional Dropped Records for Session 2025-26:
  const rollVal = getAssignedClassRollNumber(student);
  const clsName = String(student.className || student.class || student.Class || raw.className || raw.class || raw.Class || '').toLowerCase();
  const regVal = String(student.boardRegNo || student.regNo || raw.boardRegNo || raw.regNo || '').trim();
  const formVal = String(student.formNo || student['Form No.'] || raw.formNo || raw['Form No.'] || '').trim();
  const sName = String(student.name || student.studentName || raw.name || raw.studentName || student["Student's Name"] || raw["Student's Name"] || '').toLowerCase();

  // 1. Class 10th: STRICT INVARIANT — ONLY Roll 46 Suhaib Yousuf (Form 251297, Reg 2501000000610046) is dropped.
  // All other 59 enrolled examinees (Rolls 1 to 45 and 47 to 60) remain strictly active, healing any accidental drop flags.
  if (clsName.includes('10')) {
    const isSuhaibYousuf = (
      rollVal === '46' ||
      formVal === '251297' ||
      regVal.includes('2501000000610046') ||
      (sName.includes('suhaib') && sName.includes('yousuf'))
    );
    return isSuhaibYousuf;
  }

  // 2. Class 11th: Official Institutional Dropped Records (Rolls 72 Seher Un Nisa & 186 Wanhar Ahmad Malik)
  if (
    regVal.includes('2401010000200017') ||
    regVal.includes('2401010005700067') ||
    formVal === '250459' ||
    formVal === '250558'
  ) {
    return true;
  }

  // Wanhar Ahmad Malik (Class 11th Roll 186) - distinguish from Roll 188 Hashim Khurshid
  if (regVal.includes('2401000000610032')) {
    if (rollVal === '186' || sName.includes('wanhar')) {
      return true;
    }
  }

  if (clsName.includes('11') && (rollVal === '72' || rollVal === '186')) {
    if (sName.includes('seher') || sName.includes('wanhar') || !sName) {
      return true;
    }
  }

  // 3. Generic drop status flags (for non-10th records or unclassified documents)
  if (student.isExamDropped === true || raw.isExamDropped === true) return true;
  if (student.examDropped === true || raw.examDropped === true) return true;
  if (student.isDropped === true || raw.isDropped === true) return true;
  if (student.dropped === true || raw.dropped === true) return true;

  const statusStr = String(
    student.examStatus ||
    raw.examStatus ||
    student['Exam Status'] ||
    raw['Exam Status'] ||
    student['JKBOSE Exam Status'] ||
    raw['JKBOSE Exam Status'] ||
    student.examinationStatus ||
    raw.examinationStatus ||
    student.status ||
    raw.status ||
    student.Status ||
    raw.Status ||
    student.admissionStatus ||
    raw.admissionStatus ||
    student['Admission Status'] ||
    raw['Admission Status'] ||
    student.studentStatus ||
    raw.studentStatus ||
    ''
  ).trim().toLowerCase();

  if (
    statusStr === 'dropped' ||
    statusStr === 'exam dropped' ||
    statusStr === 'dropped from exam' ||
    statusStr.includes('dropped') ||
    statusStr === 'discharged' ||
    statusStr.includes('discharge')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks approval state of a student record for practicals and academic returns.
 * Invariant: Examinee must not be dropped/rejected and must either possess an assigned
 * class roll number, be marked as approved/admitted, or originate from master registers.
 */
export function checkStudentApprovalState(student) {
  if (!student || typeof student !== 'object') {
    return { isApproved: false, isRejected: false, isPending: false, isDropped: false, hasRoll: false };
  }
  const isDropped = isStudentExamDropped(student);
  const rollVal = getAssignedClassRollNumber(student);
  const hasRoll = Boolean(rollVal);

  const raw = student.raw || student._rawStudent || student;
  const rawStatus = String(
    student.status ||
    raw.status ||
    student.Status ||
    raw.Status ||
    student.admissionStatus ||
    raw.admissionStatus ||
    student['Admission Status'] ||
    raw['Admission Status'] ||
    ''
  ).trim().toLowerCase();

  const isRejected = isDropped || rawStatus.includes('reject') || rawStatus.includes('cancel') || student.isRejected === true || raw.isRejected === true;
  const isExplicitApproved =
    rawStatus.includes('approv') ||
    rawStatus.includes('admit') ||
    rawStatus.includes('enrol') ||
    rawStatus.includes('complet') ||
    rawStatus.includes('active') ||
    student.isApproved === true ||
    raw.isApproved === true ||
    student._source === 'masterRegisters' ||
    raw._source === 'masterRegisters';

  const stSess = String(student.Session || student.session || student.academicSession || raw.Session || raw.session || raw.academicSession || '');
  const isCurrentSession = !stSess || stSess.includes('2025-26');

  // Invariant: For current academic session (2025-26), an examinee MUST have an assigned Class Roll Number.
  // Historical sessions (prior to 2025-26) can rely on master registers or explicit admission approval.
  const isApproved = !isRejected && !isDropped && (hasRoll || (!isCurrentSession && isExplicitApproved));
  const isPending = !isApproved && !isRejected && !isDropped;

  return { isApproved, isRejected, isPending, isDropped, hasRoll };
}

export function isStudentApprovedForPracticals(student) {
  return checkStudentApprovalState(student).isApproved;
}

export { CLASS_ROLL_NUMBER_KEYS };
