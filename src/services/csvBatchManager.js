import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { updateCachedItem, invalidateCache } from './dbCache';
import { deleteStudentDocument } from '../portal/admin/AdvancedReports';
import { logAdminActivity } from './adminActivityLogger';

const BATCH_STORAGE_KEY = 'hss_csv_import_batches_v1';
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days

/**
 * Get all stored CSV import batches (filtered for 30-day TTL)
 */
export async function getCsvImportBatches() {
  let localBatches = [];
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY);
    if (raw) {
      localBatches = JSON.parse(raw);
    }
  } catch (e) {}

  // Filter out batches older than 30 days
  const now = Date.now();
  const validBatches = (localBatches || []).filter(b => {
    if (!b || !b.timestamp) return false;
    const age = now - new Date(b.timestamp).getTime();
    return age <= MAX_TTL_MS;
  });

  // Save cleaned list back to local storage
  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(validBatches));
  } catch (e) {}

  return validBatches;
}

/**
 * Save a new CSV import batch record
 */
export async function saveCsvImportBatch(batchData) {
  const nowStr = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MAX_TTL_MS).toISOString();

  const newBatch = {
    batchId: `csv_batch_${Date.now()}`,
    fileName: batchData.fileName || 'imported_students.csv',
    timestamp: nowStr,
    expiresAt,
    totalCount: batchData.importedRecords?.length || 0,
    importedRecords: batchData.importedRecords || [], // Full preview array
    reasonCategory: batchData.reasonCategory || 'CSV Batch Import',
    customReason: batchData.customReason || ''
  };

  const existing = await getCsvImportBatches();
  const updated = [newBatch, ...existing].slice(0, 50); // Keep last 50 batches within 30 days

  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}

  // Also backup batch metadata to Firestore csvImportBatches collection
  try {
    await setDoc(doc(db, 'csvImportBatches', newBatch.batchId), {
      batchId: newBatch.batchId,
      fileName: newBatch.fileName,
      timestamp: nowStr,
      expiresAt,
      totalCount: newBatch.totalCount,
      summaryRecords: (newBatch.importedRecords || []).map(r => ({
        id: r.id || r.docId,
        formNo: r.formNo || r['Form No.'],
        studentName: r.studentName || r["Student's Name (as per school records)"],
        class: r.class || r['Class'],
        classRollNo: r.classRollNo || r['Class Roll No'] || ''
      }))
    }, { merge: true });
  } catch (e) {}

  return newBatch;
}

/**
 * Undo & Rollback an entire CSV Import Batch
 */
export async function undoCsvImportBatch(batchId) {
  const batches = await getCsvImportBatches();
  const targetBatch = batches.find(b => b.batchId === batchId);
  if (!targetBatch) return false;

  const records = targetBatch.importedRecords || [];
  let deletedCount = 0;

  // Run deleteStudentDocument in parallel for all items in batch
  const deletePromises = records.map(async (st) => {
    try {
      await deleteStudentDocument(st);
      deletedCount++;
    } catch (e) {}
  });

  await Promise.allSettled(deletePromises);

  // Invalidate full caches
  invalidateCache('admissions');
  invalidateCache('masterRegisters');

  // Remove batch from history
  const remaining = batches.filter(b => b.batchId !== batchId);
  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(remaining));
  } catch (e) {}

  try {
    await deleteDoc(doc(db, 'csvImportBatches', batchId)).catch(() => {});
  } catch (e) {}

  // Log admin activity audit
  await logAdminActivity({
    actionType: 'delete',
    actionTitle: `Rollback CSV Import Batch: "${targetBatch.fileName}"`,
    details: `Undid CSV batch "${targetBatch.fileName}" from ${new Date(targetBatch.timestamp).toLocaleString()}, purging ${deletedCount} imported student records.`,
    reasonCategory: 'CSV Import Batch Rollback',
    customReason: 'Admin executed batch undo for CSV import file',
    metadata: { batchId, fileName: targetBatch.fileName, totalCount: deletedCount }
  }).catch(() => {});

  return true;
}
