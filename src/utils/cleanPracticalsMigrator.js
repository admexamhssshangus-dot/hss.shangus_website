/**
 * cleanPracticalsMigrator.js
 * Firestore practicalsData clean management utilities
 * Govt. Higher Secondary School Shangus
 */

import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Completely wipe all documents from the practicalsData collection in Firestore.
 */
export async function wipeAllPracticalsFromFirestore(onProgress) {
  try {
    console.log('[Practicals] Fetching all practicalsData documents for database wipe...');
    const snap = await getDocs(collection(db, 'practicalsData'));
    const total = snap.docs.length;
    console.log(`[Practicals] Found ${total} documents to wipe.`);

    if (total === 0) {
      return { success: true, count: 0 };
    }

    let deleted = 0;
    const batchSize = 250;
    let currentBatch = writeBatch(db);
    let batchOpCount = 0;

    for (const dSnap of snap.docs) {
      currentBatch.delete(doc(db, 'practicalsData', dSnap.id));
      batchOpCount++;
      deleted++;

      if (batchOpCount >= batchSize) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        batchOpCount = 0;
        if (onProgress) onProgress(Math.round((deleted / total) * 100));
      }
    }

    if (batchOpCount > 0) {
      await currentBatch.commit();
    }

    if (onProgress) onProgress(100);
    console.log(`[Practicals] Successfully wiped ${deleted} practical documents.`);
    return { success: true, count: deleted };
  } catch (err) {
    console.error('[Practicals] Database wipe error:', err);
    return { success: false, error: err.message };
  }
}
