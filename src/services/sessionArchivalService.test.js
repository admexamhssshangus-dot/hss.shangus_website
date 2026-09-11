import { archiveSessionRecords } from './sessionArchivalService';
import { doc, getDocs, runTransaction } from 'firebase/firestore';
jest.mock('./firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), getDocs: jest.fn(), query: jest.fn(), where: jest.fn(),
  orderBy: jest.fn(), documentId: jest.fn(), limit: jest.fn(), startAfter: jest.fn(), runTransaction: jest.fn(), serverTimestamp: () => 'SERVER_TIME' }));
const student = { _docId: 'physical', Session: '2025-26', Class: '12th', Status: 'Approved', classRollNo: '1', boardRegNo: 'REG1', studentName: 'Synthetic' };
function setup(extra = {}) {
  const records = { 'admissions/physical': student, 'site/settings': { session: '2025-26' }, ...extra };
  doc.mockImplementation((_db,...parts) => ({ path: parts.join('/') }));
  getDocs.mockResolvedValue({ docs: [], size: 0 });
  const tx = { get: async ref => ({ exists: () => Object.hasOwn(records, ref.path), data: () => records[ref.path] }),
    set: jest.fn((ref, data, options) => { records[ref.path] = options?.merge ? { ...records[ref.path], ...data } : data; }) };
  runTransaction.mockImplementation((_db, body) => body(tx));
  return { records, tx };
}
const options = { session: '2025-26', newSession: '2026-27', purgeDrafts: false, purgeRejected: false };
test('archive and pointer are in one transaction and the old source leaves active queries', async () => {
  const { records } = setup();
  await archiveSessionRecords([student], options);
  expect(records['masterRegisters/archive_2025-26_physical'].studentName).toBe('Synthetic');
  expect(records['admissions/physical']).toEqual({ _deleted: true, _archivedTo: 'masterRegisters/archive_2025-26_physical', Status: 'Archived', archivalJobId: '2025-26' });
  expect(records['site/settings'].session).toBe('2026-27');
  await archiveSessionRecords([student], options);
  expect(records['masterRegisters/archive_2025-26_physical'].studentName).toBe('Synthetic');
});
test('different cohort fails before any archive write', async () => {
  const { tx } = setup({ 'admissions/physical': { ...student, Session: '2024-25' } });
  await expect(archiveSessionRecords([student], options)).rejects.toThrow(/different session/);
  expect(tx.set).not.toHaveBeenCalled();
});
test('existing archives cannot be replaced by a recreated admission', async () => {
  const { tx } = setup({ 'masterRegisters/archive_2025-26_physical': { studentName: 'Earlier student' } });
  await expect(archiveSessionRecords([student], options)).rejects.toThrow(/already has an archive/);
  expect(tx.set).not.toHaveBeenCalled();
});
