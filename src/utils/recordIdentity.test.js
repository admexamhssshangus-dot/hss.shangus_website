import { uniqueStudentMatch, recordLocator, locateNestedRecord } from './recordIdentity';
const student = { id: 'physical-doc', formNo: '0005', boardRegNo: 'REG123', Class: '12th', Session: '2025-26' };
test('never selects the same registration from a different cohort', () => {
  expect(uniqueStudentMatch([{ ...student, Class: '11th' }], { reg: 'REG123' }, '2025-26', '12th')).toBeNull();
  expect(uniqueStudentMatch([{ ...student, Session: '2024-25' }], { reg: 'REG123' }, '2025-26', '12th')).toBeNull();
});
test('rejects duplicates and conflicting identifiers', () => {
  expect(uniqueStudentMatch([student, { ...student, id: 'another' }], { reg: 'REG123' }, '2025-26', '12th')).toBeNull();
  expect(uniqueStudentMatch([student], { reg: 'REG123', form: 'other' }, '2025-26', '12th')).toBeNull();
});
test('keeps the physical source document independent of the form number', () => {
  expect(recordLocator({ ...student, id: '0005', _docId: 'admin_express_17345' }).documentId).toBe('admin_express_17345');
});
test('archived matches require unique identity and cohort, never just name', () => {
  const source = { Session: '2025-26', Class: '12th', students: [student, { ...student, formNo: '0006', boardRegNo: 'REG777' }] };
  const locator = recordLocator({ ...student, _parentDocId: 'chunk_123' });
  expect(locateNestedRecord(source, locator).index).toBe(0);
  expect(() => locateNestedRecord({ ...source, students: [student, student] }, locator)).toThrow(/ambiguous/);
  expect(() => locateNestedRecord({ ...source, students: [{ ...student, Session: '2024-25' }] }, locator)).toThrow(/ambiguous/);
});

test('locates nested record via direct arrayIndex or bi-annual cross-session update', () => {
  const source = { Session: '2025-26', Class: '11th', students: [student, { ...student, formNo: '0006', boardRegNo: '220100000030010' }] };
  
  // 1. Direct arrayIndex match
  const locatorWithIndex = recordLocator({ ...student, boardRegNo: '220100000030010', _parentDocId: 'chunk_123', _arrayIndex: 1 });
  expect(locateNestedRecord(source, locatorWithIndex).index).toBe(1);

  // 2. Bi-annual cross-session match (e.g. 2026 APR/BIAN update targeting 2025-26 archived record)
  const biAnnualStudent = { ...student, boardRegNo: '220100000030010', Session: '2026 APR/BIAN', _parentDocId: 'chunk_123' };
  const locatorBiAnnual = recordLocator(biAnnualStudent);
  expect(locateNestedRecord(source, locatorBiAnnual).index).toBe(1);
});

test('resolves DIET registration number for Class 9th and secondary admissions', () => {
  const { recordIdentity } = require('./recordIdentity');
  const student9th = {
    'Form Number': '251316',
    'Class': '9th',
    'Session': '2025-26',
    'DIET Registration No.': 'DIET012345'
  };
  const identity = recordIdentity(student9th);
  expect(identity.reg).toBe('diet012345');
});
