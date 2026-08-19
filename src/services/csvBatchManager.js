import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { updateCachedItem, invalidateCache } from './dbCache';
import { deleteStudentDocument } from '../portal/admin/AdvancedReports';
import { logAdminActivity } from './adminActivityLogger';

const BATCH_STORAGE_KEY = 'hss_csv_import_batches_v1';
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days

/**
 * Get all stored CSV import batches (filtered for 30-day TTL)
 * Combines localStorage cache with Cloud Firestore backup for 100% persistence
 */
export async function getCsvImportBatches() {
  let localBatches = [];
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY);
    if (raw) {
      localBatches = JSON.parse(raw);
    }
  } catch (e) {}

  // Also query Cloud Firestore if local storage has empty or few batches
  try {
    const snap = await getDocs(collection(db, 'csvImportBatches'));
    const cloudBatches = [];
    snap.forEach(d => {
      const data = d.data();
      if (data && data.batchId) {
        cloudBatches.push({
          ...data,
          importedRecords: data.importedRecords || data.summaryRecords || []
        });
      }
    });

    if (cloudBatches.length > 0) {
      const batchMap = new Map();
      [...localBatches, ...cloudBatches].forEach(b => {
        if (b && b.batchId) {
          batchMap.set(b.batchId, {
            ...batchMap.get(b.batchId),
            ...b,
            importedRecords: (b.importedRecords && b.importedRecords.length > 0) ? b.importedRecords : (batchMap.get(b.batchId)?.importedRecords || [])
          });
        }
      });
      localBatches = Array.from(batchMap.values());
    }
  } catch (e) {
    // Ignore Firestore offline read errors
  }

  // Filter out batches older than 30 days
  const now = Date.now();
  const validBatches = (localBatches || [])
    .filter(b => {
      if (!b || !b.timestamp) return false;
      const age = now - new Date(b.timestamp).getTime();
      return age <= MAX_TTL_MS;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Save cleaned lightweight list back to local storage
  try {
    const liteToStore = validBatches.map(b => ({
      ...b,
      importedRecords: (b.importedRecords || []).map(r => {
        const { photo_id, 'Student Photo': sp, photoUrl, photo, ...rest } = r;
        return rest;
      })
    }));
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(liteToStore.slice(0, 50)));
  } catch (e) {}

  return validBatches;
}

/**
 * Save a new CSV import batch record
 */
export async function saveCsvImportBatch(batchData) {
  const nowStr = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MAX_TTL_MS).toISOString();

  // Sanitize records to strip heavy base64 strings so storage quota is never breached
  const sanitizedRecords = (batchData.importedRecords || []).map(r => {
    if (!r || typeof r !== 'object') return r;
    const clean = {};
    Object.keys(r).forEach(k => {
      const v = r[k];
      if (typeof v === 'string' && (v.startsWith('data:') || v.length > 500)) return;
      clean[k] = v;
    });
    return clean;
  });

  const newBatch = {
    batchId: `csv_batch_${Date.now()}`,
    fileName: batchData.fileName || 'imported_students.csv',
    timestamp: nowStr,
    expiresAt,
    totalCount: batchData.importedRecords?.length || 0,
    importedRecords: sanitizedRecords, // Cleaned preview array without massive images
    reasonCategory: batchData.reasonCategory || 'CSV Batch Import',
    customReason: batchData.customReason || ''
  };

  const existing = await getCsvImportBatches();
  const updated = [newBatch, ...existing.filter(b => b.batchId !== newBatch.batchId)].slice(0, 50);

  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('localStorage batch save warning:', e);
  }

  // Also backup batch metadata to Firestore csvImportBatches collection
  try {
    await setDoc(doc(db, 'csvImportBatches', newBatch.batchId), {
      batchId: newBatch.batchId,
      fileName: newBatch.fileName,
      timestamp: nowStr,
      expiresAt,
      totalCount: newBatch.totalCount,
      summaryRecords: sanitizedRecords.slice(0, 500)
    }, { merge: true });
  } catch (e) {
    console.warn('Cloud Firestore batch save warning:', e);
  }

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
