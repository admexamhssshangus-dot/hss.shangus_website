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
 * Helper to test if a candidate subject string is valid and not corrupted.
 */
export function isValidSubjectString(s) {
  if (!s || typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed.length < 3) return false;
  if (trimmed === '[Enter Subject Line Here]') return false;
  // Reject if it is just a fragment of an office address (e.g. 'office,', 'Office Anantnag', 'sub-office')
  if (/^(?:office|sub-office|sub office|branch|sub-division|district)\b/i.test(trimmed)) return false;
  return true;
}

/**
 * Clean up leading/trailing punctuation and markdown/HTML residue from subject string
 */
export function cleanSubjectString(raw) {
  if (!raw) return '';
  let s = raw.replace(/<[^>]+>/g, '').trim();
  // Strip leading punctuation: colons, hyphens, en/em dashes, dots, underscores, asterisks
  s = s.replace(/^(?:[:：\-–—._*#]|\s)+/, '').trim();
  // Strip trailing punctuation if it ends with dangling colon, hyphen, or dash
  s = s.replace(/(?:[:：\-–—]|\s)+$/, '').trim();
  return s;
}

/**
 * Extract Subject line or main topic from letter HTML snapshot.
 * 
 * Supports:
 * - "Subject: <topic>"
 * - "Sub: <topic>"
 * - "Sub. <topic>"
 * - "Sub:- <topic>"
 * - "<strong>Subject:</strong> <u><topic></u>"
 * - Prominent notice/order headings
 * 
 * Accurately prevents false-positives from compound words like "Sub-office" in addresses.
 * 
 * @param {string} bodyHtml
 * @param {string} [fallbackTitle]
 * @returns {string}
 */
export function extractLetterSubject(bodyHtml, fallbackTitle = '') {
  if (!bodyHtml || typeof bodyHtml !== 'string') return fallbackTitle || '';

  // 1. Line-by-line inspection (most accurate approach because it respects block boundaries)
  const lines = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|tr|li|section|article)>/gi, '\n')
    .split(/[\r\n]+/)
    .map(l => l.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);

  // Pass 1: Line starting with Subject or Sub
  // Note: Must match 'Subject' or 'Sub' followed by a colon, ':-', or dot+space, or spaces around dash.
  // CRITICAL: A hyphen directly after 'Sub' with no colon or space is a compound word like 'Sub-office'!
  for (const line of lines) {
    const m = line.match(/^(?:(?:\*|_|#|\s)*)(?:Subject|Sub\.?|SUB\.?)\s*(?:[:：]|[:-]|\.\s*[:：]|\.\s+|\s+[-–—]\s+)\s*(.+)$/i);
    if (m && m[1]) {
      const cleaned = cleanSubjectString(m[1]);
      if (isValidSubjectString(cleaned)) {
        return cleaned;
      }
    }
  }

  // Pass 2: DOMParser element-by-element inspection (if DOMParser available)
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(`<div>${bodyHtml}</div>`, 'text/html');
      const elements = Array.from(doc.querySelectorAll('p, div, h1, h2, h3, h4, tr, td'));
      for (const el of elements) {
        const text = (el.textContent || '').trim();
        if (!text) continue;
        const m = text.match(/(?:^|\b)(?:Subject|Sub\.?|SUB\.?)\s*(?:[:：]|[:-]|\.\s*[:：]|\.\s+|\s+[-–—]\s+)\s*(.+)$/i);
        if (m && m[1]) {
          const cleaned = cleanSubjectString(m[1]);
          if (isValidSubjectString(cleaned)) {
            return cleaned;
          }
        }
      }
    } catch (_) {}
  }

  // Pass 3: Regex across full HTML for inline formatted tags (e.g. <b>Sub:</b> <u>Authorization letter...</u>)
  const inlineRegex = /(?:^|[>\n\r])\s*(?:<\/?(?:strong|b|u|em|span)[^>]*>|\s)*(?:Subject|Sub\.?|SUB\.?)\s*(?:<\/?(?:strong|b|u|em|span)[^>]*>|\s)*(?:[:：]|[:-]|\.\s*[:：]|\.\s+|\s+[-–—]\s+)\s*(?:<\/?(?:strong|b|u|em|span)[^>]*>|\s)*([^<\n\r]+(?:<\/?(?:strong|b|u|em|span)[^>]*>[^<\n\r]+)*)/i;
  const match = bodyHtml.match(inlineRegex);
  if (match && match[1]) {
    const cleaned = cleanSubjectString(match[1]);
    if (isValidSubjectString(cleaned)) {
      return cleaned;
    }
  }

  // Pass 4: Check prominent title or heading like "OFFICE ORDER", "NOTIFICATION", "ACCOMMODATION CERTIFICATE"
  for (const line of lines) {
    if (line.match(/^(OFFICE ORDER|NOTIFICATION|CIRCULAR|MEMORANDUM|MEETING NOTICE|DUTY ORDER|ACCOMMODATION CERTIFICATE|EXPERIENCE CERTIFICATE|CHARACTER CERTIFICATE|BONAFIDE CERTIFICATE)/i)) {
      return cleanSubjectString(line).slice(0, 120);
    }
  }

  // Pass 5: Fallback: Check lines before salutation (Sir/Madam) that look like a standalone title
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^(To|Sir|Respected|Madam|Dear|Yours|With reference|Ref\b|Date\b|Office of|Govt|Government)/i)) continue;
    if (line.match(/certificate|sanction|permission|request|appointment|joining|transfer|order/i) && line.length >= 10 && line.length <= 150) {
      const cleaned = cleanSubjectString(line);
      if (isValidSubjectString(cleaned)) return cleaned;
    }
  }

  return fallbackTitle || '';
}

/**
 * Extract recipient addressee from letter HTML snapshot.
 * E.g.:
 * - "To, The Chief Education Officer"
 * - Or addressee lines preceding the Subject: "Assistant secretary, JKBOSE Sub-office, Anantnag"
 * 
 * @param {string} bodyHtml
 * @returns {string}
 */
export function extractLetterRecipient(bodyHtml) {
  if (!bodyHtml || typeof bodyHtml !== 'string') return '';

  const lines = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|tr|li|section|article)>/gi, '\n')
    .split(/[\r\n]+/)
    .map(l => l.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);

  // 1. Explicit "To, ..." or "To: ..." lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^To\s*[,:]/i.test(line)) {
      const rest = line.replace(/^To\s*[,:]\s*/i, '').trim();
      if (rest && rest.length > 2 && rest !== '[Addressee Name / Designation]') {
        return rest;
      }
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (!next.match(/^(Subject|Sub\b|Sir|Madam|Respected)/i)) {
          return next;
        }
      }
    }
  }

  // 2. Addressee block before Sub: / Subject:
  // e.g.
  // Assistant secretary,
  // JKBOSE Sub-office,
  // Anantnag
  const subIndex = lines.findIndex(l => /^(?:Subject|Sub\.?|SUB\.?)\s*(?:[:：]|[:-]|\.\s*[:：]|\.\s+|\s+[-–—]\s+)/i.test(l));
  if (subIndex > 0) {
    const candidateLines = lines.slice(0, subIndex).filter(l => 
      !l.match(/^(Ref|Date|Office of|Govt|Government|Higher Secondary|Shangus|Anantnag\s*-\s*\d+|Pin\s*:)/i)
    );
    if (candidateLines.length > 0) {
      const formatted = candidateLines
        .map(l => l.replace(/[,;]+$/, '').trim())
        .filter(Boolean)
        .join(', ');
      if (formatted && formatted.length > 2) {
        return formatted;
      }
    }
  }

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

  // Resolve Subject: if passed and valid use it, otherwise auto-extract if letter
  let resolvedSubject = String(subject || '').trim();
  if (docType === 'letter') {
    if ((!resolvedSubject || !isValidSubjectString(resolvedSubject)) && bodyHtml) {
      resolvedSubject = extractLetterSubject(bodyHtml);
    }
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

  const sanitizeRecords = (list) => {
    return list.map(item => {
      const isLetter = (item.docType || '').toLowerCase() === 'letter' || 
                       (item.templateId || '').toLowerCase().includes('letter') || 
                       (item.templateName || '').toLowerCase().includes('letter') ||
                       (item.title || '').toLowerCase().includes('letter');
      if (isLetter && item.bodyHtml) {
        const s = (item.subject || '').trim();
        const isCorrupt = !s || !isValidSubjectString(s);
        if (isCorrupt) {
          const healed = extractLetterSubject(item.bodyHtml);
          if (healed) {
            item.subject = healed;
          }
        }
        // Auto-heal recipient if missing or redundant self school name
        const rec = (item.recipientOrStudent || '').trim();
        const isSelf = rec.toLowerCase().includes('govt. hr') ||
                       rec.toLowerCase().includes('govt. higher') ||
                       rec.toLowerCase().includes('shangus') ||
                       rec.toLowerCase().includes('office of the');
        if (!rec || isSelf) {
          const extractedRec = extractLetterRecipient(item.bodyHtml);
          if (extractedRec) {
            item.recipientOrStudent = extractedRec;
          }
        }
      }
      return item;
    });
  };

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

      const merged = sanitizeRecords(Array.from(map.values())).sort((a, b) => {
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

  const sanitizedCached = sanitizeRecords(cachedList);
  return filterByDocType(sanitizedCached, docType);
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
