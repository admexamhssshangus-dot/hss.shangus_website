jest.mock('./firebase', () => ({ db: {} }));
jest.mock('./dbCache', () => ({ updateCachedItem: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  writeBatch: jest.fn()
}));

import {
  commitIssuedCertificateBatch,
  extractCertificateSerial,
  normalizeCertificateIssueDate,
  validateCertificateAssignments
} from './certificateRegistryService';
import { addDoc, collection, doc, getDoc, runTransaction } from 'firebase/firestore';

describe('TC/DC certificate registry rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collection.mockImplementation((_db, name) => name);
    doc.mockImplementation((_db, ...segments) => segments.join('/'));
    addDoc.mockResolvedValue({ id: 'history-entry' });
  });

  test.each([
    ['1368', '1368'],
    ['1368 (26-08-2026)', '1368'],
    ['HSS/SHG/TC-DC/1368/2026', '1368'],
    ['Awaiting Result', ''],
    ['0', '']
  ])('extracts the official serial from %s', (input, expected) => {
    expect(extractCertificateSerial(input)).toBe(expected);
  });

  test.each([
    ['2026-09-04', '2026-09-04'],
    ['4-9-2026', '2026-09-04'],
    ['04/09/2026', '2026-09-04'],
    ['31-02-2026', ''],
    ['not-a-date', '']
  ])('normalizes valid issue dates and rejects invalid dates', (input, expected) => {
    expect(normalizeCertificateIssueDate(input)).toBe(expected);
  });

  test('accepts a unique positive assignment batch', () => {
    expect(validateCertificateAssignments([{ certNo: '1368' }, { certNo: '1369' }])).toEqual([1368, 1369]);
  });

  test('rejects duplicate or invalid serial assignments', () => {
    expect(() => validateCertificateAssignments([{ certNo: '1368' }, { certNo: '1368' }])).toThrow(/Duplicate/);
    expect(() => validateCertificateAssignments([{ certNo: 'Awaiting Result' }])).toThrow(/valid positive serial/);
  });

  test('atomically rejects a serial already reserved by another issuer', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn().mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) }),
      set: transactionSet
    }));

    await expect(commitIssuedCertificateBatch([{
      certNo: '1400',
      formNo: '250001',
      student: { raw: { id: 'adm_250001' } }
    }], '04-09-2026')).rejects.toThrow(/serial conflict/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  test('locks a new serial and stamps the source student document', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => ref === 'systemSettings/certificateRegistry'
        ? { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) }
        : { exists: () => true, data: () => ({}) }),
      set: transactionSet
    }));

    const result = await commitIssuedCertificateBatch([{
      certNo: '1401',
      formNo: '250001',
      student: { raw: { id: 'adm_250001' } }
    }], '04-09-2026');

    expect(result).toMatchObject({ success: true, count: 1, lastIssuedCertNo: 1401 });
    expect(transactionSet).toHaveBeenCalledWith(
      'admissions/adm_250001',
      expect.objectContaining({ certificateNo: '1401', dischargeIssueDate: '2026-09-04' }),
      { merge: true }
    );
    expect(transactionSet).toHaveBeenCalledWith(
      'systemSettings/certificateRegistry',
      expect.objectContaining({ lastIssuedCertNo: 1401 }),
      { merge: true }
    );
  });

  test('does not reserve a serial when the student source record is missing', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => ref === 'systemSettings/certificateRegistry'
        ? { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) }
        : { exists: () => false, data: () => ({}) }),
      set: transactionSet
    }));

    await expect(commitIssuedCertificateBatch([{
      certNo: '1401',
      formNo: 'missing',
      student: { raw: { id: 'adm_missing' } }
    }], '2026-09-04')).rejects.toThrow(/was not found/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  test('does not overwrite an already-issued student from stale UI data', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => ref === 'systemSettings/certificateRegistry'
        ? { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) }
        : { exists: () => true, data: () => ({ certificateNo: '1399' }) }),
      set: transactionSet
    }));

    await expect(commitIssuedCertificateBatch([{
      certNo: '1401',
      formNo: '250001',
      student: { raw: { id: 'adm_250001' } }
    }], '2026-09-04')).rejects.toThrow(/already has certificate #1399/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });
});
