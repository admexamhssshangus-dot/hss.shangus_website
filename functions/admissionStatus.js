const AUTHORITATIVE_CLASS_ROLL_NUMBER_KEYS = Object.freeze([
  'classRollNo',
  'Class Roll No',
  'Class Roll No.',
  'Class Roll Number',
  'Class R.No.',
  'Class R.No',
  'Class R. No.',
  'Class R. No',
  'Class Roll',
  'classRoll',
  'ClassRoll',
  'ClassRollNo',
  'class_roll',
  'currentRollNo',
  'assignedRoll',
  'crNo',
  'RL. NO.',
  'RL. NO',
  'assignedRollNo',
  'class_roll_no',
  'Class_Roll_No',
  'Class Roll No (Class 12th)',
  'Class Roll No (Class 11th)',
  'Class Roll No (Class 10th)'
]);

const LEGACY_CLASS_ROLL_NUMBER_KEYS = Object.freeze([
  'rollNo',
  'Roll No.',
  'Roll No',
  'roll_no',
  'roll',
  'R.No.',
  'R.No',
  'R. No.',
  'R. No',
  'Roll'
]);

const INVALID_CLASS_ROLL_VALUES = /^(?:0|n\/?a|na|none|nil|null|undefined|unknown|pending|not\s*assigned|unassigned|—|-)$/i;

function isLikelyOfficialExamRollNumber(value) {
  return /^\d{7,}$/.test(String(value == null ? '' : value).trim());
}

function getUsableRollValue(student, raw, key) {
  const rawValue = student[key] !== undefined && student[key] !== null ? student[key] : raw[key];
  if (rawValue === undefined || rawValue === null) return '';
  const value = String(rawValue).trim();
  return value && !INVALID_CLASS_ROLL_VALUES.test(value) ? value : '';
}

/**
 * Returns the authoritative assigned Class Roll No. across the supported
 * Firestore admission schemas. Board/examination roll numbers are deliberately
 * excluded because they do not approve an admission.
 */
function getAssignedClassRollNumber(student) {
  if (!student || typeof student !== 'object') return '';

  const raw = student.raw || student._rawStudent || student;
  for (const key of AUTHORITATIVE_CLASS_ROLL_NUMBER_KEYS) {
    const value = getUsableRollValue(student, raw, key);
    if (value) return value;
  }
  for (const key of LEGACY_CLASS_ROLL_NUMBER_KEYS) {
    const value = getUsableRollValue(student, raw, key);
    if (value && !isLikelyOfficialExamRollNumber(value)) return value;
  }

  return '';
}

function hasAssignedClassRollNumber(student) {
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
function resolveStudentAdmissionStatus(student) {
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

function isStudentAdmissionApproved(student) {
  return resolveStudentAdmissionStatus(student) === 'Approved';
}

module.exports = {
  CLASS_ROLL_NUMBER_KEYS: Object.freeze([...AUTHORITATIVE_CLASS_ROLL_NUMBER_KEYS, ...LEGACY_CLASS_ROLL_NUMBER_KEYS]),
  getAssignedClassRollNumber,
  hasAssignedClassRollNumber,
  resolveStudentAdmissionStatus,
  isStudentAdmissionApproved
};
