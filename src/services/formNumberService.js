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
const PUBLIC_SETTINGS_DOC = 'settings';
const PUBLIC_SETTINGS_COLLECTION = 'site';
const DELETED_HISTORY_COLLECTION = 'deletedFormsHistory';

/**
 * Fetch current Form Number configuration from Firestore (admin or public site settings) or return smart defaults.
 */
export async function getFormNumberConfig() {
  let dbData = null;
  
  // 1. Try systemSettings/formNumberConfig (available to Admins & Teachers)
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID));
    if (snap && snap.exists()) {
      dbData = snap.data();
    }
  } catch (e) {
    // Expected for unauthenticated or student users due to firestore rules
  }

  // 2. Try site/settings (publicly readable by everyone including student portal)
  if (!dbData) {
    try {
      const siteSnap = await getDoc(doc(db, PUBLIC_SETTINGS_COLLECTION, PUBLIC_SETTINGS_DOC));
      if (siteSnap && siteSnap.exists()) {
        const siteData = siteSnap.data();
        if (siteData.formNumberConfig || siteData.nextFormNumber || siteData.startingSeries) {
          dbData = siteData.formNumberConfig || {
            nextFormNumber: siteData.nextFormNumber,
            startingSeries: siteData.startingSeries,
            recycledFormNumbers: siteData.recycledFormNumbers,
            session: siteData.session
          };
        }
      }
    } catch (e) {
      console.warn('Public site settings read note:', e);
    }
  }

  // 3. Try localStorage cached counter
  if (!dbData) {
    try {
      const localMax = localStorage.getItem('hss_last_max_form_no');
      if (localMax && /^\d+$/.test(localMax)) {
        dbData = { nextFormNumber: Number(localMax) + 1 };
      }
    } catch (_) {}
  }

  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth() + 1; // 1-12
  const calDay = now.getDate(); // 1-31

  // Teacher/Admin configurable settings (defaults: Cutoff = 31st October, Format = YY0000)
  const cutoffMonth = dbData?.cutoffMonth !== undefined ? Number(dbData.cutoffMonth) : 10;
  const cutoffDay = dbData?.cutoffDay !== undefined ? Number(dbData.cutoffDay) : 31;
  const digitFormat = dbData?.digitFormat || 'YY0000'; // 'YY0000' (250001) or 'YYYY0000' (20250001)

  // Determine if current date is PAST the cutoff date in the current calendar year
  let sessionEndYear = calYear;
  if (calMonth > cutoffMonth || (calMonth === cutoffMonth && calDay > cutoffDay)) {
    sessionEndYear = calYear + 1;
  }

  const sessionStartYear = sessionEndYear - 1;
  const computedSessionName = `${sessionStartYear}-${String(sessionEndYear).slice(-2)}`;
  const yearPrefix = digitFormat === 'YYYY0000' ? String(sessionStartYear) : String(sessionStartYear).slice(-2);
  const defaultStartingSeries = parseInt(`${yearPrefix}0001`, 10);

  return {
    session: dbData?.session || computedSessionName,
    cutoffMonth: cutoffMonth,
    cutoffDay: cutoffDay,
    digitFormat: digitFormat,
    startingSeries: dbData?.startingSeries !== undefined ? Number(dbData.startingSeries) : defaultStartingSeries,
    nextFormNumber: dbData?.nextFormNumber !== undefined ? Number(dbData.nextFormNumber) : (dbData?.startingSeries !== undefined ? Number(dbData.startingSeries) : defaultStartingSeries),
    recycledFormNumbers: Array.isArray(dbData?.recycledFormNumbers) ? dbData.recycledFormNumbers : [],
    lastUpdated: dbData?.lastUpdated || new Date().toISOString()
  };
}

/**
 * Calculate the next available Form Number for a new student (Strictly Sequential max + 1).
 * 1. Checks recycled deleted form numbers first.
 * 2. Scans existing applications in admissions and masterRegisters memory cache & Firestore to find max existing form number.
 * 3. Increments sequentially to max + 1 without skipping or reordering.
 */
export async function getNextAvailableFormNumber() {
  const config = await getFormNumberConfig();

  // If recycled form numbers exist from deleted applications, assign the oldest recycled number first
  const recycled = Array.isArray(config.recycledFormNumbers) ? config.recycledFormNumbers.filter(Boolean) : [];
  if (recycled.length > 0) {
    const firstRecycled = String(recycled[0]).trim();
    if (firstRecycled) return firstRecycled;
  }

  // Scan admissions and masterRegisters in memory/cache & Firestore to get max existing form number
  let maxFormNum = 0;

  const checkRecord = (rec) => {
    if (!rec) return;
    const fNoStr = String(rec['Form Number'] || rec['Form No.'] || rec['FormNo'] || rec.formNo || rec.fNo || '').replace(/[^0-9]/g, '');
    if (fNoStr && fNoStr.length >= 4 && fNoStr.length <= 8) {
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

  // Check localStorage for the highest seen form number
  try {
    const localMax = localStorage.getItem('hss_last_max_form_no');
    if (localMax && /^\d+$/.test(localMax)) {
      const num = parseInt(localMax, 10);
      if (!isNaN(num) && num > maxFormNum) maxFormNum = num;
    }
  } catch (_) {}

  // Also query Firestore admissions collection directly if admin permissions are active
  try {
    const snap = await getDocs(collection(db, 'admissions'));
    snap.forEach(d => checkRecord(d.data()));
  } catch (e) {}

  const configNext = Number(config.nextFormNumber) || Number(config.startingSeries) || 250001;
  const candidate = Math.max(configNext, maxFormNum > 0 ? maxFormNum + 1 : configNext);

  return String(candidate);
}

/**
 * Mark a form number as consumed when a student submits an application.
 * Removes it from recycled list and advances nextFormNumber across systemSettings and public site settings.
 */
export async function consumeFormNumber(formNo) {
  if (!formNo) return;
  const cleanFormNoStr = String(formNo).replace(/[^0-9]/g, '');
  const cleanFormNo = parseInt(cleanFormNoStr, 10);
  if (isNaN(cleanFormNo)) return;

  try {
    // Update local cache tracker immediately
    localStorage.setItem('hss_last_max_form_no', String(cleanFormNo));
  } catch (_) {}

  try {
    const config = await getFormNumberConfig();
    const recycled = Array.isArray(config.recycledFormNumbers) ? config.recycledFormNumbers : [];
    const isRecycled = recycled.includes(cleanFormNoStr) || recycled.includes(cleanFormNo);

    const updatedRecycled = recycled.filter(n => String(n) !== cleanFormNoStr);
    const updatedNext = isRecycled ? config.nextFormNumber : Math.max(Number(config.nextFormNumber || 0), cleanFormNo + 1);

    const updatedConfig = {
      ...config,
      nextFormNumber: updatedNext,
      recycledFormNumbers: updatedRecycled,
      lastUpdated: new Date().toISOString()
    };

    // 1. Update systemSettings/formNumberConfig
    setDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID), updatedConfig, { merge: true }).catch(() => {});

    // 2. Update site/settings (publicly accessible for students)
    setDoc(doc(db, PUBLIC_SETTINGS_COLLECTION, PUBLIC_SETTINGS_DOC), {
      nextFormNumber: updatedNext,
      recycledFormNumbers: updatedRecycled,
      formNumberConfig: updatedConfig
    }, { merge: true }).catch(() => {});
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
    const safeDocId = cleanFormNoStr.replace(/[\/\s\\]/g, '_');
    const docId = `del_${safeDocId}_${Date.now()}`;
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
    const payload = {
      ...newConfig,
      lastUpdated: new Date().toISOString()
    };
    // 1. Save to admin-restricted systemSettings/formNumberConfig
    await setDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID), payload, { merge: true });

    // 2. Sync to public site/settings for student portal
    await setDoc(doc(db, PUBLIC_SETTINGS_COLLECTION, PUBLIC_SETTINGS_DOC), {
      nextFormNumber: Number(newConfig.nextFormNumber || newConfig.startingSeries || 250001),
      recycledFormNumbers: newConfig.recycledFormNumbers || [],
      formNumberConfig: payload
    }, { merge: true }).catch(() => {});

    try {
      if (newConfig.nextFormNumber) {
        localStorage.setItem('hss_last_max_form_no', String(Number(newConfig.nextFormNumber) - 1));
      }
    } catch (_) {}

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
