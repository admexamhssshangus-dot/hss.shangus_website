import {
  commitIssuedCertificateBatch,
  extractCertificateSerial,
  normalizeCertificateIssueDate,
  validateCertificateAssignments,
  formatGeneralRefNo,
  parseGeneralRefNo
} from './certificateRegistryService';
import { addDoc, collection, doc, getDoc, runTransaction } from 'firebase/firestore';

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
      student: { regNo: 'REG-001', raw: { id: 'adm_250001' } }
    }], '04-09-2026')).rejects.toThrow(/serial conflict/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  test('locks a new serial and stamps the source student document', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => {
        if (ref === 'systemSettings/certificateRegistry') return { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) };
        if (String(ref).startsWith('certificateNumberLocks/')) return { exists: () => false, data: () => ({}) };
        return { exists: () => true, data: () => ({}) };
      }),
      set: transactionSet
    }));

    const result = await commitIssuedCertificateBatch([{
      certNo: '1401',
      formNo: '250001',
      student: { regNo: 'REG-001', raw: { id: 'adm_250001' } }
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
    expect(transactionSet).toHaveBeenCalledWith(
      'certificateNumberLocks/1401',
      expect.objectContaining({ certificateNo: '1401', regNo: 'REG-001', status: 'Active' })
    );
  });

  test('stamps the exact individual master-register document', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => {
        if (ref === 'systemSettings/certificateRegistry') return { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) };
        if (String(ref).startsWith('certificateNumberLocks/')) return { exists: () => false, data: () => ({}) };
        return { exists: () => true, data: () => ({}) };
      }),
      set: transactionSet
    }));

    await commitIssuedCertificateBatch([{
      certNo: '1401',
      student: {
        regNo: 'REG-001',
        raw: { _docId: 'mr_2025-26_12th_reg_REG001', _srcCollection: 'masterRegisters' }
      }
    }], '2026-09-04');

    expect(transactionSet).toHaveBeenCalledWith(
      'masterRegisters/mr_2025-26_12th_reg_REG001',
      expect.objectContaining({ certificateNo: '1401', dischargeIssueDate: '2026-09-04' }),
      { merge: true }
    );
    expect(transactionSet).toHaveBeenCalledWith(
      'certificateNumberLocks/1401',
      expect.objectContaining({ sourceDocument: 'masterRegisters/mr_2025-26_12th_reg_REG001' })
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
      student: { regNo: 'REG-MISSING', raw: { id: 'adm_missing' } }
    }], '2026-09-04')).rejects.toThrow(/was not found/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  test('does not overwrite an already-issued student from stale UI data', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => {
        if (ref === 'systemSettings/certificateRegistry') return { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) };
        if (String(ref).startsWith('certificateNumberLocks/')) return { exists: () => false, data: () => ({}) };
        return { exists: () => true, data: () => ({ certificateNo: '1399' }) };
      }),
      set: transactionSet
    }));

    await expect(commitIssuedCertificateBatch([{
      certNo: '1401',
      formNo: '250001',
      student: { regNo: 'REG-001', raw: { id: 'adm_250001' } }
    }], '2026-09-04')).rejects.toThrow(/already has certificate #1399/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  test('allows an explicit duplicate for the same registration and retains issue history', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => {
        if (ref === 'systemSettings/certificateRegistry') return { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) };
        if (String(ref).startsWith('certificateNumberLocks/')) return { exists: () => false, data: () => ({}) };
        return { exists: () => true, data: () => ({ certificateNo: '1399', dischargeIssueDate: '2025-08-01' }) };
      }),
      set: transactionSet
    }));

    await commitIssuedCertificateBatch([{
      certNo: '1401',
      previousCertificateNo: '1399',
      issueKind: 'Duplicate',
      formNo: '250001',
      student: { regNo: 'REG-001', raw: { id: 'adm_250001' } }
    }], '2026-09-04');

    expect(transactionSet).toHaveBeenCalledWith(
      'admissions/adm_250001',
      expect.objectContaining({
        certificateNo: '1401',
        duplicateOfCertificateNo: '1399',
        dischargeCertStatus: 'Issued (Duplicate)',
        certificateIssueHistory: expect.arrayContaining([
          expect.objectContaining({ certificateNo: '1399' }),
          expect.objectContaining({ certificateNo: '1401', issueKind: 'Duplicate' })
        ])
      }),
      { merge: true }
    );
  });

  test('rejects a certificate number already locked to another registration', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => {
        if (ref === 'systemSettings/certificateRegistry') return { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) };
        if (String(ref).startsWith('certificateNumberLocks/')) return { exists: () => true, data: () => ({ regNo: 'REG-OTHER' }) };
        return { exists: () => true, data: () => ({}) };
      }),
      set: transactionSet
    }));

    await expect(commitIssuedCertificateBatch([{
      certNo: '1401',
      formNo: '250001',
      student: { regNo: 'REG-001', raw: { id: 'adm_250001' } }
    }], '2026-09-04')).rejects.toThrow(/already locked to REG-OTHER/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  test('rejects a duplicate when its previous certificate belongs to another registration', async () => {
    const transactionSet = jest.fn();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) });
    runTransaction.mockImplementation(async (_db, operation) => operation({
      get: jest.fn(async ref => {
        if (ref === 'systemSettings/certificateRegistry') return { exists: () => true, data: () => ({ lastIssuedCertNo: 1400 }) };
        if (ref === 'certificateNumberLocks/1401') return { exists: () => false, data: () => ({}) };
        if (ref === 'certificateNumberLocks/1399') {
          return { exists: () => true, data: () => ({ regNo: 'REG-OTHER', regKey: 'regother' }) };
        }
        return { exists: () => true, data: () => ({ certificateNo: '1399' }) };
      }),
      set: transactionSet
    }));

    await expect(commitIssuedCertificateBatch([{
      certNo: '1401',
      previousCertificateNo: '1399',
      issueKind: 'Duplicate',
      formNo: '250001',
      student: { regNo: 'REG-001', raw: { id: 'adm_250001' } }
    }], '2026-09-04')).rejects.toThrow(/locked to REG-OTHER, not this registration number/i);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  describe('General certificate reference number formatting & parsing', () => {
    test('formats compact ref number with HSS prefix and 2-digit year', () => {
      expect(formatGeneralRefNo('HSS/Char-Past', 1369, '2026')).toBe('HSS/Char-Past/1369/26');
      expect(formatGeneralRefNo('HSS/SHG/Char-Past', 1369, '2026')).toBe('HSS/Char-Past/1369/26');
      expect(formatGeneralRefNo('HSS/SHG', 1454, '2026')).toBe('HSS/1454/26');
      expect(formatGeneralRefNo('HSS/Bonafide', 1455, '26')).toBe('HSS/Bonafide/1455/26');
    });

    test('parses compact ref numbers with 2-digit or 4-digit years', () => {
      const parsed1 = parseGeneralRefNo('HSS/Char-Past/1369/26');
      expect(parsed1.prefix).toBe('HSS/Char-Past');
      expect(parsed1.serial).toBe(1369);
      expect(parsed1.year).toBe('26');
      expect(parsed1.formatted).toBe('HSS/Char-Past/1369/26');

      const parsed2 = parseGeneralRefNo('HSS/SHG/Char-Past/1369/2026');
      expect(parsed2.prefix).toBe('HSS/Char-Past');
      expect(parsed2.serial).toBe(1369);
      expect(parsed2.year).toBe('26');
      expect(parsed2.formatted).toBe('HSS/Char-Past/1369/26');

      const parsed3 = parseGeneralRefNo('HSS/1454/26');
      expect(parsed3.prefix).toBe('HSS');
      expect(parsed3.serial).toBe(1454);
      expect(parsed3.year).toBe('26');
      expect(parsed3.formatted).toBe('HSS/1454/26');
    });
  });
});
