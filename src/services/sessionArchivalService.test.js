import { archiveSessionRecords, generateMasterRegisterDocId } from './sessionArchivalService';
import { doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';

jest.mock('./firebase', () => ({ db: {} }));
jest.mock('./dbCache', () => ({ clearAllMemoryCache: jest.fn(), invalidateCache: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  documentId: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: () => 'SERVER_TIME',
  setDoc: jest.fn(),
  deleteDoc: jest.fn()
}));

const student = {
  _docId: 'physical',
  Session: '2025-26',
  Class: '12th',
  Status: 'Approved',
  classRollNo: '1',
  boardRegNo: 'REG1',
  studentName: 'Synthetic'
};

function setup(extra = {}) {
  const records = { 'admissions/physical': student, 'site/settings': { session: '2025-26' }, ...extra };
  doc.mockImplementation((_db, ...parts) => ({ path: parts.join('/') }));
  getDocs.mockResolvedValue({ docs: [], size: 0 });
  const applySet = (ref, data, options) => {
    records[ref.path] = options?.merge ? { ...records[ref.path], ...data } : data;
  };
  const applyDelete = ref => { delete records[ref.path]; };
  writeBatch.mockImplementation(() => ({
    set: jest.fn(applySet),
    delete: jest.fn(applyDelete),
    commit: jest.fn().mockResolvedValue()
  }));
  setDoc.mockImplementation(async (ref, data, options) => applySet(ref, data, options));
  return { records };
}

const options = { session: '2025-26', newSession: '2026-27' };

beforeEach(() => jest.clearAllMocks());

test('archives each approved application into its own deterministic master-register document', async () => {
  const { records } = setup();
  await archiveSessionRecords([student], options);

  const masterId = generateMasterRegisterDocId(student, '2025-26');
  expect(records[`masterRegisters/${masterId}`]).toMatchObject({
    id: masterId,
    _docId: masterId,
    _source: 'masterRegisters',
    _isHistorical: true,
    session: '2025-26',
    canonicalClass: '12th',
    boardRegNo: 'REG1'
  });
  expect(records['admissions/physical']).toBeUndefined();
  expect(records['site/settings']).toMatchObject({ session: '2026-27', lastArchivedSession: '2025-26' });
});

test('keeps identifiers stable for a repeat archive attempt', () => {
  expect(generateMasterRegisterDocId(student, '2025-26')).toBe('mr_2025-26_12th_REG1');
  expect(generateMasterRegisterDocId({ ...student, _docId: 'another-physical' }, '2025-26')).toBe('mr_2025-26_12th_REG1');
});

test('rejects an invalid target session before starting any writes', async () => {
  setup();
  await expect(archiveSessionRecords([student], { ...options, newSession: 'invalid' })).rejects.toThrow(/valid new academic session/);
  expect(writeBatch).not.toHaveBeenCalled();
});
