/**
 * Authoritative Evaluation Classification & Types
 * Strictly distinguishes between Practical Evaluations (Internal Assessment & External Practical)
 * and School-Based Assessments (Pre-Board Tests, Golden Tests, Term End, Unit Tests, etc.)
 */

export const PRACTICAL_EVALUATION_TYPES = Object.freeze([
  { value: 'Internal Assessment', label: 'Internal Assessment', shortLabel: 'Internal' },
  { value: 'External Practical', label: 'External Practical', shortLabel: 'External' }
]);

export const DEFAULT_SCHOOL_ASSESSMENT_TYPES = Object.freeze([
  { value: 'Pre-Board Test', label: 'Pre-Board Examination', shortLabel: 'Pre-Board' },
  { value: 'Golden Test', label: 'Golden Test / Winter Assessment', shortLabel: 'Golden' },
  { value: 'Unit Assessment', label: 'Unit Test / Monthly Assessment', shortLabel: 'Unit Test' },
  { value: 'Term End Evaluation', label: 'Term End Examination', shortLabel: 'Term End' },
  { value: 'Midterm Test', label: 'Midterm Assessment', shortLabel: 'Midterm' }
]);

/**
 * Checks whether an evaluation type string is strictly a practical evaluation
 * (Internal Assessment or External Practical), excluding all school-based examinations.
 */
export function isPracticalEvaluationType(evalType) {
  if (!evalType) return false;
  const t = String(evalType).trim().toLowerCase();

  // Explicit non-practical / school examination keywords
  if (
    t.includes('preboard') ||
    t.includes('pre-board') ||
    t.includes('golden') ||
    t.includes('term end') ||
    t.includes('term-end') ||
    t.includes('midterm') ||
    t.includes('mid-term') ||
    t.includes('unit test') ||
    t.includes('unit assessment') ||
    t.includes('diagnostic') ||
    t.includes('olympiad') ||
    t.includes('talent search') ||
    t.includes('competitive') ||
    t.includes('gk') ||
    t.includes('mock') ||
    t.includes('board pattern')
  ) {
    return false;
  }

  // Must contain practical or internal/external practical keywords
  return t.includes('internal') || t.includes('external') || t.includes('practical');
}

/**
 * Checks whether an evaluation type string is a school-based assessment
 * (Pre-Board, Golden Test, Term End, Unit Test, etc.)
 */
export function isSchoolAssessmentType(evalType) {
  if (!evalType) return false;
  return !isPracticalEvaluationType(evalType);
}
