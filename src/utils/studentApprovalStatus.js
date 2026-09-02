const CLASS_ROLL_NUMBER_KEYS = Object.freeze([
  'classRollNo',
  'Class Roll No',
  'Class Roll No.',
  'Class Roll Number',
  'Class R.No.',
  'Class R.No',
  'Class R. No.',
  'Class R. No',
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
  'roll'
]);

const INVALID_CLASS_ROLL_VALUES = /^(?:0|n\/?a|na|none|nil|null|undefined|unknown|pending|not\s*assigned|unassigned|—|-)$/i;

/**
 * Returns the authoritative assigned Class Roll No. across the supported
 * Firestore admission schemas. Board/examination roll numbers are deliberately
 * excluded because they do not approve an admission.
 */
export function getAssignedClassRollNumber(student) {
  if (!student || typeof student !== 'object') return '';

  for (const key of CLASS_ROLL_NUMBER_KEYS) {
    const rawValue = student[key];
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
  if (hasAssignedClassRollNumber(student)) return 'Approved';

  const rawStatus = String(
    student.status ||
    student.Status ||
    student.admissionStatus ||
    student['Admission Status'] ||
    ''
  ).trim().toLowerCase();

  if (rawStatus.includes('withdraw')) return 'Withdrawn';
  if (rawStatus.includes('reject') || rawStatus.includes('rejt') || rawStatus.includes('cancel')) return 'Rejected';
  if (rawStatus.includes('draft') || rawStatus.includes('dft')) return 'Draft';
  if (rawStatus.includes('provis')) return 'Provisional';

  // Explicit Approved/Admitted/Enrolled flags are historical metadata only.
  // A class roll number is the sole source of truth for current approval.
  return 'Submitted';
}

export function isStudentAdmissionApproved(student) {
  return hasAssignedClassRollNumber(student);
}

export { CLASS_ROLL_NUMBER_KEYS };
