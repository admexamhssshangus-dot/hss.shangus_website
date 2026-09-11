import { gradeAssessment, expectedSubjectCodes } from './assessment';
const row = (code, value) => ({ subjectCode: code, marksObtained: value, maxMarks: 100, minMarks: 36 });
test('a failed subject cannot receive Distinction despite a high aggregate', () => {
  const result = gradeAssessment([row('A',100), row('B',100), row('C',100), row('D',20)], ['A','B','C','D']);
  expect(result.percentage).toBe('80.0'); expect(result.resultStatus).toBe('RE-APPEAR'); expect(result.division).not.toContain('Distinction');
});
test.each([undefined, '', 'WH', -1, 101])('invalid or withheld marks %s stay pending', mark => {
  expect(gradeAssessment([row('A',mark)], ['A']).resultStatus).toBe('PENDING');
});
test('missing expected subject, scale, enrollment, or duplicate award cannot pass', () => {
  expect(gradeAssessment([row('A',100)], ['A','B']).resultStatus).toBe('PENDING');
  expect(gradeAssessment([{ ...row('A',20), maxMarks: undefined }], ['A']).resultStatus).toBe('PENDING');
  expect(gradeAssessment([row('A',100)], []).resultStatus).toBe('PENDING');
  expect(gradeAssessment([row('A',100), row('A',90)], ['A']).resultStatus).toBe('PENDING');
});
test('absent is not zero or pass and maxima use the actual scheme', () => {
  expect(gradeAssessment([row('A','AB')], ['A']).resultStatus).toBe('ABSENT');
  expect(gradeAssessment([{ subjectCode: 'PH', marksObtained: 8, maxMarks: 10, minMarks: 4 }], ['PH']).percentage).toBe('80.0');
});
test('expected subjects recognize full names and preserve unrecognized requirements', () => {
  expect(expectedSubjectCodes({ selectedSubjects: ['General English', 'Physics', 'Home Science', 'Unknown elective'] })).toEqual(['EN','PH','HSC','UNKNOWN:unknownelective']);
});
