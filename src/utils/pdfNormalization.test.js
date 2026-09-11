import { resolveCleanAdmNo, resolveCleanStream } from './pdfGenerator';
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('../services/firebase', () => ({ db: {}, auth: {} }));
test.each(['-', '—', 'n/a', 'N/A', 'undefined', 'null'])('skips placeholder %s before later aliases', value => {
  expect(resolveCleanAdmNo({ admNo: value, 'Admission No.': '00123/26' })).toBe('00123/26');
});
test('specific Home Science stays distinct from Science', () => {
  expect(resolveCleanStream({ Stream: 'Home Science' }, '11th')).toBe('Home Science');
  expect(resolveCleanStream({ Stream: 'Home Science' }, '10th')).toBe('General');
});
