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
  if (rawStatus.includes('drop') || isStudentExamDropped(student)) return 'Dropped';
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

  return (
    statusStr === 'dropped' ||
    statusStr === 'exam dropped' ||
    statusStr === 'dropped from exam' ||
    statusStr.includes('dropped') ||
    statusStr === 'discharged' ||
    statusStr.includes('discharge')
  );
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

  const isApproved = !isRejected && !isDropped && (hasRoll || isExplicitApproved);
  const isPending = !isApproved && !isRejected && !isDropped;

  return { isApproved, isRejected, isPending, isDropped, hasRoll };
}

export function isStudentApprovedForPracticals(student) {
  return checkStudentApprovalState(student).isApproved;
}

export { CLASS_ROLL_NUMBER_KEYS };
