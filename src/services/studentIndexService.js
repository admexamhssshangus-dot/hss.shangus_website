// =================================================================
// HSS SHANGUS — Pre-Computed Registration & Identity Index Service
// =================================================================
// Maintains a server-cached, compact index document in Cloud Firestore
// (`system_indexes/student_reg_index`) to provide instant O(1) identity,
// registration number, admission number, and photo lookups.
// =================================================================

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const INDEX_COLLECTION = 'system_indexes';
const INDEX_DOC_ID = 'student_reg_index';
const CACHE_KEY = 'hss_student_reg_index_cache';

let memoryIndexCache = null;

/**
 * Clean and normalize registration number strings.
 */
export function normalizeRegKey(val) {
  if (!val) return '';
  const clean = String(val).trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (/^(n\/a|—|-|null|undefined)$/i.test(clean) || clean.length < 5) return '';
  return clean;
}

/**
 * Fetch the compact student registration index from memory, storage, or Firestore.
 * @param {boolean} forceRefresh - If true, forces fetch from Firestore
 * @returns {Promise<Record<string, object>>} Map of regKey -> student index entry
 */
export async function getStudentRegIndex(forceRefresh = false) {
  if (!forceRefresh && memoryIndexCache && Object.keys(memoryIndexCache).length > 0) {
    return memoryIndexCache;
  }

  // 1. Try local storage cache
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          memoryIndexCache = parsed;
          return parsed;
        }
      }
    } catch (_) {}
  }

  // 2. Fetch fresh from Firestore
  try {
    const snap = await getDoc(doc(db, INDEX_COLLECTION, INDEX_DOC_ID));
    if (snap.exists()) {
      const data = snap.data() || {};
      const index = data.index || data;
      delete index.updatedAt;
      delete index._version;

      memoryIndexCache = index;
      try {
        const json = JSON.stringify(index);
        sessionStorage.setItem(CACHE_KEY, json);
        localStorage.setItem(CACHE_KEY, json);
      } catch (_) {}

      return index;
    }
  } catch (err) {
    console.warn('[studentIndexService] Index fetch note:', err);
  }

  return memoryIndexCache || {};
}

/**
 * Look up a student by Registration Number in the pre-computed index.
 * @param {string} regNo
 * @returns {object|null}
 */
export function lookupStudentByRegSync(regNo) {
  if (!memoryIndexCache) return null;
  const key = normalizeRegKey(regNo);
  if (!key) return null;
  return memoryIndexCache[key] || null;
}

/**
 * Update or insert a single student record into the Firestore index.
 * @param {object} studentData
 */
export async function updateStudentInRegIndex(studentData) {
  if (!studentData || typeof studentData !== 'object') return;

  const rawReg = studentData['Board Registration Number'] ||
    studentData['Board Registration No. (Class 11th)'] ||
    studentData['Board Reg. No.'] ||
    studentData.boardRegNo ||
    studentData.regNo ||
    studentData['Reg. No.'];

  const regKey = normalizeRegKey(rawReg);
  if (!regKey) return;

  const admNo = studentData['Admission Number'] || studentData['Adm. No.'] || studentData.admNo || '';
  const rollNo = studentData['Class Roll No'] || studentData['Class Roll No.'] || studentData.classRollNo || studentData.rollNo || '';
  const studentName = studentData["Student's Name (as per school records)"] || studentData["Student's Name"] || studentData.studentName || studentData.name || '';
  const fatherName = studentData["Father's/Guardian's Name (as per school records)"] || studentData["Father's Name"] || studentData.fatherName || '';
  const className = studentData['Admission sought for class'] || studentData['Class'] || studentData.class || '';
  const sessionName = studentData['Session'] || studentData.session || '';
  const photoUrl = studentData['photo_id'] || studentData['Student Photo'] || studentData.photoUrl || studentData.photoId || '';

  const entry = {
    admNo: String(admNo).trim(),
    rollNo: String(rollNo).trim(),
    name: String(studentName).trim(),
    fatherName: String(fatherName).trim(),
    class: String(className).trim(),
    session: String(sessionName).trim(),
    photo: String(photoUrl).trim().startsWith('data:') ? '' : String(photoUrl).trim()
  };

  // Update in-memory cache immediately
  if (!memoryIndexCache) memoryIndexCache = {};
  memoryIndexCache[regKey] = { ...(memoryIndexCache[regKey] || {}), ...entry };

  try {
    await setDoc(
      doc(db, INDEX_COLLECTION, INDEX_DOC_ID),
      {
        [`index.${regKey}`]: entry,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[studentIndexService] Single student index update note:', err);
  }
}

/**
 * Rebuild and push the entire registration index to Firestore from active + master records.
 * @param {Array<object>} admissionsList
 * @param {Array<object>} masterList
 */
export async function rebuildStudentRegIndex(admissionsList = [], masterList = []) {
  const newIndex = {};

  const processRecord = (rec) => {
    if (!rec || typeof rec !== 'object') return;
    const rawReg = rec['Board Registration Number'] ||
      rec['Board Registration No. (Class 11th)'] ||
      rec['Board Registration No. (Class 10th)'] ||
      rec['Board Reg. No.'] ||
      rec['Reg. No.'] ||
      rec.boardRegNo ||
      rec.regNo;

    const regKey = normalizeRegKey(rawReg);
    if (!regKey) return;

    const admNo = rec['Admission Number'] || rec['Adm. No.'] || rec.admNo || '';
    const rollNo = rec['Class Roll No'] || rec['Class Roll No.'] || rec.classRollNo || rec.rollNo || '';
    const studentName = rec["Student's Name (as per school records)"] || rec["Student's Name"] || rec.studentName || rec.name || '';
    const fatherName = rec["Father's/Guardian's Name (as per school records)"] || rec["Father's Name"] || rec.fatherName || '';
    const className = rec['Admission sought for class'] || rec['Class'] || rec.class || '';
    const sessionName = rec['Session'] || rec.session || '';
    const photoUrl = rec['photo_id'] || rec['Student Photo'] || rec.photoUrl || rec.photoId || '';

    const cleanPhoto = String(photoUrl).startsWith('data:') ? '' : String(photoUrl).trim();

    newIndex[regKey] = {
      admNo: String(admNo).trim() || newIndex[regKey]?.admNo || '',
      rollNo: String(rollNo).trim() || newIndex[regKey]?.rollNo || '',
      name: String(studentName).trim() || newIndex[regKey]?.name || '',
      fatherName: String(fatherName).trim() || newIndex[regKey]?.fatherName || '',
      class: String(className).trim() || newIndex[regKey]?.class || '',
      session: String(sessionName).trim() || newIndex[regKey]?.session || '',
      photo: cleanPhoto || newIndex[regKey]?.photo || ''
    };
  };

  // Process master records first, then active admissions overwrite with latest
  if (Array.isArray(masterList)) masterList.forEach(processRecord);
  if (Array.isArray(admissionsList)) admissionsList.forEach(processRecord);

  memoryIndexCache = newIndex;

  try {
    await setDoc(
      doc(db, INDEX_COLLECTION, INDEX_DOC_ID),
      {
        index: newIndex,
        _version: 1,
        totalEntries: Object.keys(newIndex).length,
        updatedAt: new Date().toISOString()
      }
    );
    console.log(`[studentIndexService] Rebuilt registration index with ${Object.keys(newIndex).length} entries.`);
    return { success: true, count: Object.keys(newIndex).length };
  } catch (err) {
    console.error('[studentIndexService] Failed to save rebuilt index to Firestore:', err);
    return { success: false, error: err.message };
  }
}

const studentIndexService = {
  getStudentRegIndex,
  lookupStudentByRegSync,
  updateStudentInRegIndex,
  rebuildStudentRegIndex,
  normalizeRegKey
};

export default studentIndexService;
