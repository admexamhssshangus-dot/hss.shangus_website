// =================================================================
// HSS SHANGUS — Sequential Form Number & Recycling Management Service
// =================================================================
// Manages auto-incrementing form numbers with session prefixes (e.g. 260001),
// collision detection, deleted form number recycling, and Super Admin controls.
// =================================================================

import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { getCachedCollectionSync } from './dbCache';

const CONFIG_DOC_ID = 'formNumberConfig';
const SETTINGS_COLLECTION = 'systemSettings';
const DELETED_HISTORY_COLLECTION = 'deletedFormsHistory';

/**
 * Fetch current Form Number configuration from Firestore or return smart defaults.
 */
export async function getFormNumberConfig() {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID));
    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn('getFormNumberConfig note:', e);
  }

  // Calculate default series based on current year/session (e.g. 2026 -> 260001)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  // Session starts in Oct (Month 10). If Oct or later, session is next year (e.g., Oct 2025 -> 2026-27 session -> 260001)
  const sessionStartYear = currentMonth >= 10 ? currentYear + 1 : currentYear;
  const defaultYearPrefix = String(sessionStartYear).slice(-2);
  const defaultSeries = parseInt(`${defaultYearPrefix}0001`, 10);
  const defaultSessionName = `${sessionStartYear - 1}-${String(sessionStartYear).slice(-2)}`;

  return {
    session: defaultSessionName,
    startingSeries: defaultSeries,
    nextFormNumber: defaultSeries,
    recycledFormNumbers: [],
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Calculate the next available Form Number for a new student.
 * 1. Checks recycled/deleted form numbers queue first.
 * 2. Scans existing applications in admissions and masterRegisters to find the maximum existing form number.
 * 3. Ensures no collision happens.
 */
export async function getNextAvailableFormNumber() {
  const config = await getFormNumberConfig();

  // 1. If recycled/deleted form numbers are available, return the lowest one!
  if (Array.isArray(config.recycledFormNumbers) && config.recycledFormNumbers.length > 0) {
    const sortedRecycled = [...config.recycledFormNumbers].sort((a, b) => Number(a) - Number(b));
    return String(sortedRecycled[0]);
  }

  // 2. Scan admissions and masterRegisters in memory/cache & Firestore to get max existing form number
  let maxFormNum = 0;

  const checkRecord = (rec) => {
    if (!rec) return;
    const fNoStr = String(rec['Form Number'] || rec['Form No.'] || rec['FormNo'] || rec.id || '').replace(/[^0-9]/g, '');
    if (fNoStr && fNoStr.length >= 5 && fNoStr.length <= 8) {
      const num = parseInt(fNoStr, 10);
      if (!isNaN(num) && num > maxFormNum) {
        maxFormNum = num;
      }
    }
  };

  const cachedAdmissions = getCachedCollectionSync('admissions');
  if (Array.isArray(cachedAdmissions)) {
    cachedAdmissions.forEach(item => {
      if (Array.isArray(item.items)) item.items.forEach(checkRecord);
      else checkRecord(item);
    });
  }

  const cachedMaster = getCachedCollectionSync('masterRegisters');
  if (Array.isArray(cachedMaster)) {
    cachedMaster.forEach(item => {
      if (Array.isArray(item.items)) item.items.forEach(checkRecord);
      else checkRecord(item);
    });
  }

  // Also query Firestore admissions collection directly to be 100% accurate
  try {
    const snap = await getDocs(collection(db, 'admissions'));
    snap.forEach(d => checkRecord(d.data()));
  } catch (e) {}

  const configNext = Number(config.nextFormNumber) || Number(config.startingSeries) || 260001;
  const candidate = Math.max(configNext, maxFormNum + 1);

  return String(candidate);
}

/**
 * Mark a form number as consumed when a student submits an application.
 * Removes it from recycled list and advances nextFormNumber if applicable.
 */
export async function consumeFormNumber(formNo) {
  if (!formNo) return;
  const cleanFormNoStr = String(formNo).replace(/[^0-9]/g, '');
  const cleanFormNo = parseInt(cleanFormNoStr, 10);
  if (isNaN(cleanFormNo)) return;

  try {
    const config = await getFormNumberConfig();
    const recycled = Array.isArray(config.recycledFormNumbers) ? config.recycledFormNumbers : [];
    const isRecycled = recycled.includes(cleanFormNoStr) || recycled.includes(cleanFormNo);

    const updatedRecycled = recycled.filter(n => String(n) !== cleanFormNoStr);
    const updatedNext = isRecycled ? config.nextFormNumber : Math.max(Number(config.nextFormNumber || 0), cleanFormNo + 1);

    await setDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID), {
      ...config,
      nextFormNumber: updatedNext,
      recycledFormNumbers: updatedRecycled,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('consumeFormNumber error:', e);
  }
}

/**
 * Recycle a deleted form number and save basic details of the deleted application in DB history.
 */
export async function recycleDeletedFormNumber(formNo, deletedRecordData = {}, adminEmail = '') {
  if (!formNo) return;
  const cleanFormNoStr = String(formNo).trim();

  try {
    // 1. Add to systemSettings/formNumberConfig recycled array
    const configRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID);
    await updateDoc(configRef, {
      recycledFormNumbers: arrayUnion(cleanFormNoStr),
      lastUpdated: new Date().toISOString()
    }).catch(async () => {
      const config = await getFormNumberConfig();
      const recycled = Array.isArray(config.recycledFormNumbers) ? config.recycledFormNumbers : [];
      if (!recycled.includes(cleanFormNoStr)) recycled.push(cleanFormNoStr);
      await setDoc(configRef, { ...config, recycledFormNumbers: recycled, lastUpdated: new Date().toISOString() }, { merge: true });
    });

    // 2. Remember basic details of deleted application in deletedFormsHistory collection
    const docId = `del_${cleanFormNoStr}_${Date.now()}`;
    await setDoc(doc(db, DELETED_HISTORY_COLLECTION, docId), {
      formNumber: cleanFormNoStr,
      studentName: deletedRecordData["Student's Name (as per school records)"] || deletedRecordData["Student's Name"] || deletedRecordData.name || 'N/A',
      fatherName: deletedRecordData["Father's/Guardian's Name (as per school records)"] || deletedRecordData["Father's Name"] || 'N/A',
      className: deletedRecordData["Admission sought for class"] || deletedRecordData["Class"] || 'N/A',
      stream: deletedRecordData["Stream for Class 11th"] || deletedRecordData["Stream"] || 'N/A',
      deletedAt: new Date().toISOString(),
      deletedBy: adminEmail || 'Admin',
      status: 'Recycled'
    }, { merge: true });

  } catch (e) {
    console.warn('recycleDeletedFormNumber error:', e);
  }
}

/**
 * Save updated Form Number Configuration (Super Admin setting).
 */
export async function saveFormNumberConfig(newConfig) {
  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID), {
      ...newConfig,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    return { success: true, message: 'Form Number configuration updated successfully!' };
  } catch (e) {
    console.error('saveFormNumberConfig error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Get deleted forms history log for Super Admin review.
 */
export async function getDeletedFormsHistory() {
  try {
    const snap = await getDocs(collection(db, DELETED_HISTORY_COLLECTION));
    const list = [];
    snap.forEach(d => list.push({ docId: d.id, ...d.data() }));
    return list.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
  } catch (e) {
    console.warn('getDeletedFormsHistory error:', e);
    return [];
  }
}
