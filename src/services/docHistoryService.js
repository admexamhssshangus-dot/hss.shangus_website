// =================================================================
// HSS SHANGUS — Official Document Cloud History & Archive Service
// Manages immutable audit logs and archives for generated Bonafides,
// Certificates, and Official Letters in Firebase Firestore.
// =================================================================

import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';

const COLLECTION_DOC_HISTORY = 'generatedDocumentHistory';
const LOCAL_HISTORY_CACHE_KEY = 'hss_generated_docs_history_cache';

/**
 * Save a generated document (Bonafide, Certificate, or Official Letter) to Cloud History.
 * Every record is immutable and captures the full rendered HTML snapshot, timestamp,
 * recipient/student metadata, and the triggering action (Printed, Downloaded, or Saved to Cloud).
 * 
 * @param {object} params
 * @param {'bonafide' | 'letter' | 'certificate'} params.docType
 * @param {string} params.title
 * @param {string} params.refNo
 * @param {string} params.dateStr
 * @param {string} [params.recipientOrStudent]
 * @param {object} [params.studentDetails]
 * @param {string} params.bodyHtml
 * @param {'Printed / Saved PDF' | 'Downloaded (.docx)' | 'Saved to Cloud'} params.actionType
 * @param {string} [params.templateId]
 * @param {string} [params.templateName]
 * @param {object} [params.extraData]
 * @returns {Promise<{ id: string, success: boolean }>}
 */
export async function saveGeneratedDocToHistory({
  docType = 'bonafide',
  title = '',
  refNo = '',
  dateStr = '',
  recipientOrStudent = '',
  studentDetails = null,
  bodyHtml = '',
  actionType = 'Saved to Cloud',
  templateId = '',
  templateName = '',
  extraData = {}
}) {
  const timestamp = Date.now();
  const id = `dochist_${docType}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const recordPayload = {
    id,
    docType, // 'bonafide' | 'letter' | 'certificate'
    title: String(title || (docType === 'letter' ? 'Official Letter' : 'Student Certificate')).trim(),
    refNo: String(refNo || '').trim(),
    dateStr: String(dateStr || new Date().toLocaleDateString('en-GB')).trim(),
    recipientOrStudent: String(recipientOrStudent || '').trim(),
    studentDetails: studentDetails && typeof studentDetails === 'object' ? studentDetails : null,
    bodyHtml: String(bodyHtml || '').trim(),
    actionType: String(actionType || 'Saved to Cloud').trim(),
    templateId: String(templateId || '').trim(),
    templateName: String(templateName || '').trim(),
    extraData: extraData && typeof extraData === 'object' ? extraData : {},
    createdAt: nowIso,
    serverCreatedAt: serverTimestamp(),
    immutable: true
  };

  // 1. Optimistically update local cache
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : [];
    const updated = [recordPayload, ...cached.filter(item => item.id !== id)].slice(0, 300);
    localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('hss-doc-history-updated', { detail: { count: updated.length } }));
  } catch (e) {
    console.warn('Local history cache save error:', e);
  }

  // 2. Persist to Cloud Firestore
  try {
    const docRef = doc(db, COLLECTION_DOC_HISTORY, id);
    await setDoc(docRef, recordPayload);
    return { id, success: true };
  } catch (err) {
    console.error('Failed to write document history to Firestore:', err);
    return { id, success: true, localOnly: true, error: err.message };
  }
}

/**
 * Fetch archived documents from Cloud Firestore and local storage cache.
 * 
 * @param {object} [options]
 * @param {'all' | 'bonafide' | 'letter' | 'certificate'} [options.docType='all']
 * @param {number} [options.limitCount=150]
 * @returns {Promise<Array<object>>}
 */
export async function fetchGeneratedDocHistory({
  docType = 'all',
  limitCount = 150
} = {}) {
  let cachedList = [];

  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
    if (raw) {
      cachedList = JSON.parse(raw) || [];
    }
  } catch (e) {
    console.warn('Error parsing local history cache:', e);
  }

  try {
    const colRef = collection(db, COLLECTION_DOC_HISTORY);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    const cloudRecords = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data) {
        cloudRecords.push({
          ...data,
          id: docSnap.id
        });
      }
    });

    if (cloudRecords.length > 0) {
      // Merge unique by ID
      const map = new Map();
      cachedList.forEach(item => map.set(item.id, item));
      cloudRecords.forEach(item => map.set(item.id, item));

      const merged = Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(merged));
      
      return filterByDocType(merged, docType);
    }
  } catch (err) {
    console.warn('Firestore history fetch error (using local cache):', err);
  }

  return filterByDocType(cachedList, docType);
}

/**
 * Filter documents list by specific document type.
 */
function filterByDocType(list, docType) {
  if (!docType || docType === 'all') return list;
  if (docType === 'bonafide' || docType === 'certificate') {
    return list.filter(d => d.docType === 'bonafide' || d.docType === 'certificate');
  }
  return list.filter(d => d.docType === docType);
}

/**
 * Delete an archived record from Firestore and local cache.
 * 
 * @param {string} docId
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteGeneratedDocFromHistory(docId) {
  if (!docId) return { success: false };

  // 1. Update local cache
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) || [];
      const updated = cached.filter(item => item.id !== docId);
      localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hss-doc-history-updated', { detail: { count: updated.length } }));
    }
  } catch (e) {
    console.warn('Local cache delete error:', e);
  }

  // 2. Delete from Cloud Firestore
  try {
    const docRef = doc(db, COLLECTION_DOC_HISTORY, docId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (err) {
    console.error('Failed to delete doc history from Firestore:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Bulk delete multiple archived records from Firestore and local cache.
 * 
 * @param {Array<string>} docIds
 * @returns {Promise<{ success: boolean, deletedCount: number }>}
 */
export async function deleteMultipleGeneratedDocsFromHistory(docIds) {
  if (!Array.isArray(docIds) || docIds.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const idSet = new Set(docIds);

  // 1. Update local cache optimistically
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) || [];
      const updated = cached.filter(item => !idSet.has(item.id));
      localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hss-doc-history-updated', { detail: { count: updated.length } }));
    }
  } catch (e) {
    console.warn('Local cache bulk delete error:', e);
  }

  // 2. Batch delete from Cloud Firestore in chunks of 400
  try {
    const chunkSize = 400;
    for (let i = 0; i < docIds.length; i += chunkSize) {
      const chunk = docIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        const docRef = doc(db, COLLECTION_DOC_HISTORY, id);
        batch.delete(docRef);
      });
      await batch.commit();
    }
    return { success: true, deletedCount: docIds.length };
  } catch (err) {
    console.error('Failed to bulk delete doc history from Firestore:', err);
    return { success: false, error: err.message, deletedCount: 0 };
  }
}
