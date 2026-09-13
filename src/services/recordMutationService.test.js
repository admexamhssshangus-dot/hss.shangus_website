import { captureFields, restoreFields, applyRecordPatch, rollbackMutationJob } from './recordMutationService';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
jest.mock('./firebase', () => ({ db: {} }));
jest.mock('./dbCache', () => ({ invalidateCache: jest.fn() }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(),
  runTransaction: jest.fn(), setDoc: jest.fn(), serverTimestamp: jest.fn(() => 'SERVER_TIME') }));
test('restores missing fields and preserves unrelated later edits', () => {
  const before = captureFields({ name: 'Before', untouched: 1 }, { name: 'After', added: 4 });
  expect(restoreFields({ name: 'After', added: 4, untouched: 2 }, before, { name: 'After', added: 4 })).toEqual({ name: 'Before', untouched: 2 });
});
test('a newer edit stops rollback instead of deleting the student', () => {
  expect(() => restoreFields({ name: 'Newer' }, { name: { exists: true, value: 'Before' } }, { name: 'After' })).toThrow(/conflict/);
});
test('edit and before-image are queued in the same transaction', async () => {
  doc.mockImplementation((_db,...parts) => parts.join('/'));
  const tx = { get: jest.fn(async ref => ({ exists: () => ref === 'admissions/physical', data: () => ({ name: 'Before' }) })), set: jest.fn() };
  runTransaction.mockImplementation((_db, body) => body(tx));
  await applyRecordPatch({ _docId: 'physical', name: 'Before' }, { name: 'After' }, { jobId: 'job', entryId: 'row' });
  expect(tx.set).toHaveBeenCalledWith('admissions/physical', { name: 'After' });
  expect(tx.set).toHaveBeenCalledWith('csvImportBatches/job/entries/row', expect.objectContaining({ before: { name: { exists: true, value: 'Before' } }, status: 'applied' }));
});
test('legacy batches with no before-image fail safely', async () => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ kind: 'legacy' }) });
  await expect(rollbackMutationJob('legacy')).rejects.toThrow(/no durable before-images/);
});

test('missing fields in current database doc do not throw false-positive conflict on preview aliases', async () => {
  doc.mockImplementation((_db, ...parts) => parts.join('/'));
  const tx = {
    get: jest.fn(async ref => ({
      exists: () => ref === 'admissions/physical',
      data: () => ({ 'DoB (figures)': '18-05-2007' }) // notice 'dob' is NOT a property in current
    })),
    set: jest.fn()
  };
  runTransaction.mockImplementation((_db, body) => body(tx));

  // student preview has 'dob', patch updates both 'dob' and 'DoB (figures)'
  await expect(applyRecordPatch(
    { _docId: 'physical', dob: '18-05-2007' },
    { dob: '18-05-2007', 'DoB (figures)': '18-05-2007' },
    { jobId: 'job', entryId: 'row-1' }
  )).resolves.toBe('job');
});

test('date format equivalence (DD-MM-YYYY vs YYYY-MM-DD) avoids conflict error', async () => {
  doc.mockImplementation((_db, ...parts) => parts.join('/'));
  const tx = {
    get: jest.fn(async ref => ({
      exists: () => ref === 'admissions/physical',
      data: () => ({ dob: '2007-05-18' })
    })),
    set: jest.fn()
  };
  runTransaction.mockImplementation((_db, body) => body(tx));

  await expect(applyRecordPatch(
    { _docId: 'physical', dob: '18-05-2007' },
    { dob: '18-05-2007' },
    { jobId: 'job', entryId: 'row-2' }
  )).resolves.toBe('job');
});

test('force: true bypasses conflict check entirely during bulk overwrite', async () => {
  doc.mockImplementation((_db, ...parts) => parts.join('/'));
  const tx = {
    get: jest.fn(async ref => ({
      exists: () => ref === 'admissions/physical',
      data: () => ({ name: 'DatabaseChangedName' })
    })),
    set: jest.fn()
  };
  runTransaction.mockImplementation((_db, body) => body(tx));

  await expect(applyRecordPatch(
    { _docId: 'physical', name: 'OldPreviewName' },
    { name: 'OverwrittenName' },
    { jobId: 'job', entryId: 'row-3', force: true }
  )).resolves.toBe('job');
});

test('real concurrent conflict throws when force is false', async () => {
  doc.mockImplementation((_db, ...parts) => parts.join('/'));
  const tx = {
    get: jest.fn(async ref => ({
      exists: () => ref === 'admissions/physical',
      data: () => ({ name: 'DatabaseChangedName' })
    })),
    set: jest.fn()
  };
  runTransaction.mockImplementation((_db, body) => body(tx));

  await expect(applyRecordPatch(
    { _docId: 'physical', name: 'OldPreviewName' },
    { name: 'NewName' },
    { jobId: 'job', entryId: 'row-4', force: false }
  )).rejects.toThrow(/"name" changed since the preview/);
});

