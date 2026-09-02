import {
  filterIdCardStudents,
  getIdCardStudentKey,
  generateVerificationQrUrl,
  normalizeStudentClass,
  getStudentStreamVal,
  resolveClassTheme,
  paginateIdCardStudents,
  selectIdCardStudents,
} from './idCardRenderer';

const students = [
  { id: 'a', session: '2025-26', class: '11th', stream: 'Science', status: 'Approved', classRollNo: '2', studentName: 'Aamir' },
  { id: 'b', session: '2026-27', class: '11th', stream: 'Science', status: 'Approved', classRollNo: '1', studentName: 'Bilal' },
  { id: 'c', session: '2026-27', class: '12th', stream: 'Humanities', status: 'Submitted', classRollNo: '3', studentName: 'Ciya' },
];

describe('optimized ID card cohort utilities', () => {
  test('normalizes Roman class IX without misclassifying it as class X', () => {
    expect(normalizeStudentClass('Class IX')).toBe('9th');
    expect(normalizeStudentClass('X')).toBe('10th');
    expect(normalizeStudentClass('Class XII')).toBe('12th');
  });

  test('keeps Humanities themes separate and does not invent missing streams', () => {
    expect(resolveClassTheme('11th', 'Humanities').id).toBe('navy');
    expect(getStudentStreamVal({ class: '11th' })).toBe('');
    expect(getStudentStreamVal({ class: '9th' })).toBe('General');
  });

  test('strictly filters by academic session and sorts natural roll numbers', () => {
    const result = filterIdCardStudents(students, { session: '2026-27', status: 'All' });
    expect(result.map(student => student.id)).toEqual(['b', 'c']);
  });

  test('an empty manual selection stays empty instead of printing everyone', () => {
    expect(selectIdCardStudents(students, new Set(), true, 'all', 1, 30)).toEqual([]);
  });

  test('stable keys survive filtering and manual range selection', () => {
    const selected = new Set([getIdCardStudentKey(students[1])]);
    expect(selectIdCardStudents(students, selected, true, 'range', 1, 10).map(student => student.id)).toEqual(['b']);
  });

  test('paginates cards without dropping the final partial page', () => {
    expect(paginateIdCardStudents(students, 2).map(page => page.length)).toEqual([2, 1]);
  });

  test('invalidates cached QR codes when registration identity changes', () => {
    const before = generateVerificationQrUrl({ ...students[0], boardRegNo: 'REG-A', formNo: '100' });
    const after = generateVerificationQrUrl({ ...students[0], boardRegNo: 'REG-B', formNo: '100' });
    expect(before).not.toBe(after);
  });
});
