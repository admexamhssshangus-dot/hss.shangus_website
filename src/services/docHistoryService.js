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
 * Recursively removes non-serializable values (functions, undefined, UI callback props starting with '_')
 * so Firestore setDoc / updateDoc operations never fail.
 */
function sanitizeFirestoreData(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'function' || typeof val === 'symbol') return undefined;
  if (typeof val !== 'object') return val;
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) {
    return val
      .map(sanitizeFirestoreData)
      .filter(item => item !== undefined);
  }
  const clean = {};
  for (const [k, v] of Object.entries(val)) {
    if (k.startsWith('_') || typeof v === 'function' || typeof v === 'symbol') {
      continue;
    }
    const sanitized = sanitizeFirestoreData(v);
    if (sanitized !== undefined) {
      clean[k] = sanitized;
    }
  }
  return clean;
}

/**
 * Extract Subject line or main topic from letter HTML snapshot.
 * Supports:
 * - "Subject: <topic>"
 * - "Sub: <topic>"
 * - "<strong>Subject:</strong> <u><topic></u>"
 * - Prominent notice/order headings
 * 
 * @param {string} bodyHtml
 * @param {string} [fallbackTitle]
 * @returns {string}
 */
export function extractLetterSubject(bodyHtml, fallbackTitle = '') {
  if (!bodyHtml || typeof bodyHtml !== 'string') return fallbackTitle || '';

  // 1. Fast regex for explicit "Subject:" or "Sub:" lines
  const subRegex = /(?:Subject|Sub)\s*[:：\-–—]+\s*(?:<\/?(?:strong|b|u|em|span)[^>]*>|\s)*([^<\n\r]+(?:<\/?(?:strong|b|u|em|span)[^>]*>[^<\n\r]+)*)/i;
  const match = bodyHtml.match(subRegex);
  if (match && match[1]) {
    const clean = match[1].replace(/<[^>]+>/g, '').trim();
    if (clean && clean.length > 2 && clean !== '[Enter Subject Line Here]') {
      return clean;
    }
  }

  // 2. DOM Parser inspection (browser environment)
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(`<div>${bodyHtml}</div>`, 'text/html');
      
      // Look for any paragraph or heading containing Subject / Sub
      const paragraphs = Array.from(doc.querySelectorAll('p, div, h1, h2, h3, h4'));
      for (const el of paragraphs) {
        const text = el.textContent || '';
        const m = text.match(/(?:Subject|Sub)\s*[:：\-–—]+\s*(.*)/i);
        if (m && m[1]) {
          const s = m[1].trim();
          if (s && s.length > 2 && s !== '[Enter Subject Line Here]') {
            return s;
          }
        }
      }

      // 3. Fallback: Check for prominent title or heading like "OFFICE ORDER" or first paragraph
      for (const el of paragraphs) {
        const text = (el.textContent || '').trim();
        if (!text) continue;
        if (text.startsWith('To,') || text.startsWith('To:') || text.startsWith('Respected') || text.startsWith('Sir') || text.startsWith('Madam')) {
          continue;
        }
        if (/^(OFFICE ORDER|NOTIFICATION|CIRCULAR|MEMORANDUM|MEETING NOTICE|DUTY ORDER)/i.test(text)) {
          return text.slice(0, 120);
        }
      }

      // 4. Fallback: First meaningful sentence if no subject
      for (const el of paragraphs) {
        const text = (el.textContent || '').trim();
        if (!text || text.startsWith('To,') || text.startsWith('To:') || text.startsWith('Respected') || text.startsWith('Sir') || text.startsWith('Yours')) {
          continue;
        }
        if (text.length >= 15) {
          return text.slice(0, 110) + (text.length > 110 ? '...' : '');
        }
      }
    } catch (_) {}
  }

  return fallbackTitle || '';
}

/**
 * Extract recipient addressee from letter HTML snapshot.
 * E.g. "To, <br/> The Chief Education Officer" -> "The Chief Education Officer"
 * 
 * @param {string} bodyHtml
 * @returns {string}
 */
export function extractLetterRecipient(bodyHtml) {
  if (!bodyHtml || typeof bodyHtml !== 'string') return '';

  try {
    const doc = new DOMParser().parseFromString(`<div>${bodyHtml}</div>`, 'text/html');
    const paragraphs = Array.from(doc.querySelectorAll('p, div'));
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const text = (p.textContent || '').trim();
      if (/^To\s*[,:]/i.test(text)) {
        // Handle <br> tags within the paragraph
        const htmlWithBreaks = (p.innerHTML || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
        const lines = htmlWithBreaks.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const recipientLine = lines[1].replace(/^To\s*[,:]?\s*/i, '').trim();
          if (recipientLine && recipientLine !== '[Addressee Name / Designation]' && recipientLine.length > 2) {
            return recipientLine;
          }
        }
        // If "To," is on its own line/paragraph, check immediate next sibling paragraph
        if (i + 1 < paragraphs.length) {
          const nextText = (paragraphs[i + 1].textContent || '').trim();
          if (nextText && !nextText.match(/^(Subject|Sub\s*[:-]|Respected|Sir|Madam)/i) && nextText.length > 2) {
            return nextText.split('\n')[0].trim();
          }
        }
      }
    }
  } catch (_) {}

  return '';
}

/**
 * Save a generated document (Bonafide, Certificate, or Official Letter) to Cloud History.
 * Every record is immutable and captures the full rendered HTML snapshot, timestamp,
 * recipient/student metadata, and the triggering action (Printed, Downloaded, or Saved to Cloud).
 * 
 * @param {object} params
 * @param {'bonafide' | 'letter' | 'certificate'} params.docType
 * @param {string} params.title
 * @param {string} [params.subject]
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
  subject = '',
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
  const nowIso = new Date().toISOString();
  const normalizedTitle = String(title || (docType === 'letter' ? 'Official Letter' : 'Student Certificate')).trim();
  const normalizedRefNo = String(refNo || '').trim();

  // Resolve Subject: if passed use it, otherwise auto-extract if letter
  let resolvedSubject = String(subject || '').trim();
  if (!resolvedSubject && docType === 'letter' && bodyHtml) {
    resolvedSubject = extractLetterSubject(bodyHtml);
  }

  // Resolve Recipient: for letters, if generic school name or empty, extract addressee from bodyHtml
  let normalizedRecipient = String(recipientOrStudent || '').trim();
  if (docType === 'letter' && (!normalizedRecipient || normalizedRecipient.toLowerCase().includes('shangus'))) {
    const extractedAddressee = extractLetterRecipient(bodyHtml);
    if (extractedAddressee) {
      normalizedRecipient = extractedAddressee;
    }
  }

  // Clean and sanitize extraData (strip large redundant raw objects)
  const cleanExtraData = { ...(extraData || {}) };
  delete cleanExtraData.rawStudent;
  delete cleanExtraData.raw;
  // If photo is huge base64 data URI (> 30KB), avoid ballooning Firestore/local storage
  if (typeof cleanExtraData.studentPhotoUrl === 'string' && cleanExtraData.studentPhotoUrl.startsWith('data:') && cleanExtraData.studentPhotoUrl.length > 30000) {
    cleanExtraData.studentPhotoUrl = null; // Can be re-resolved on demand from DB photo cache
  }

  // 1. Smart Deduplication: Check if an identical document was saved/printed in recent window (15 mins)
  let cached = [];
  let existingRecentDoc = null;
  try {
    const rawCache = localStorage.getItem(LOCAL_HISTORY_CACHE_KEY);
    if (rawCache) cached = JSON.parse(rawCache) || [];

    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    existingRecentDoc = cached.find(item => {
      if (item.docType !== docType) return false;
      const itemTime = new Date(item.createdAt || 0).getTime();
      if (itemTime < fifteenMinsAgo) return false;

      // Match by exact reference number
      if (normalizedRefNo && item.refNo && item.refNo === normalizedRefNo) return true;

      // Match by recipient + title + subject
      if (normalizedRecipient && item.recipientOrStudent && item.recipientOrStudent.toLowerCase() === normalizedRecipient.toLowerCase() && item.title === normalizedTitle) {
        if (!resolvedSubject || !item.subject || item.subject.toLowerCase() === resolvedSubject.toLowerCase()) {
          return true;
        }
      }

      return false;
    });
  } catch (_) {}

  // Reuse existing ID if updating a recent document, or create fresh unique ID
  const id = existingRecentDoc?.id || `dochist_${docType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const rawPayload = {
    id,
    docType, // 'bonafide' | 'letter' | 'discharge'
    title: normalizedTitle,
    subject: resolvedSubject,
    refNo: normalizedRefNo,
    dateStr: String(dateStr || new Date().toLocaleDateString('en-GB')).trim(),
    recipientOrStudent: normalizedRecipient,
    studentDetails: studentDetails && typeof studentDetails === 'object' ? studentDetails : null,
    bodyHtml: String(bodyHtml || '').trim(),
    actionType: String(actionType || 'Saved to Cloud').trim(),
    templateId: String(templateId || '').trim(),
    templateName: String(templateName || '').trim(),
    extraData: cleanExtraData,
    createdAt: nowIso,
    serverCreatedAt: serverTimestamp(),
    immutable: true
  };

  const recordPayload = sanitizeFirestoreData(rawPayload);

  // 2. Optimistically update local cache
  try {
    const updated = [recordPayload, ...cached.filter(item => item.id !== id)].slice(0, 1000);
    localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('hss-doc-history-updated', { detail: { count: updated.length } }));
  } catch (e) {
    console.warn('Local history cache save error:', e);
  }

  // 3. Persist to Cloud Firestore
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
 * @param {number} [options.limitCount=500]
 * @returns {Promise<Array<object>>}
 */
export async function fetchGeneratedDocHistory({
  docType = 'all',
  limitCount = 500
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
  const isAdmissionDoc = (d) => {
    const dt = (d.docType || '').toLowerCase();
    if (dt === 'admission_form' || dt === 'admission' || dt === 'form') return true;
    const titleLower = (d.title || '').toLowerCase();
    return titleLower.includes('admission application form') ||
           titleLower.includes('provisional admission slip') ||
           titleLower.includes('application form');
  };

  if (docType === 'admission_form' || docType === 'admission' || docType === 'forms') {
    return list.filter(d => isAdmissionDoc(d));
  }
  if (docType === 'bonafide' || docType === 'certificate') {
    return list.filter(d => !isAdmissionDoc(d) && (d.docType === 'bonafide' || d.docType === 'certificate'));
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
