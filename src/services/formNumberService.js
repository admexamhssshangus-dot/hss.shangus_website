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

  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth() + 1;
  const calDay = now.getDate();
  const cutoffMonth = config.cutoffMonth !== undefined ? Number(config.cutoffMonth) : 10;
  const cutoffDay = config.cutoffDay !== undefined ? Number(config.cutoffDay) : 31;
  let sessionEndYear = calYear;
  if (calMonth > cutoffMonth || (calMonth === cutoffMonth && calDay > cutoffDay)) {
    sessionEndYear = calYear + 1;
  }
  const sessionStartYear = sessionEndYear - 1;
  const yearPrefix = config.digitFormat === 'YYYY0000' ? String(sessionStartYear) : String(sessionStartYear).slice(-2);
  const defaultStartingSeries = parseInt(`${yearPrefix}0001`, 10);

  const consumedNumbers = new Set();
  let maxFormNum = 0;

  const checkVal = (rawVal) => {
    if (!rawVal) return;
    const cleanStr = String(rawVal).replace(/[^0-9]/g, '');
    if (cleanStr.length >= 4 && cleanStr.length <= 8) {
      const num = parseInt(cleanStr, 10);
      if (!isNaN(num) && num > 0) {
        consumedNumbers.add(cleanStr);
        consumedNumbers.add(String(num));
        // If it matches the current session series prefix (e.g. '25' for 2025-26) or standard length
        if (cleanStr.startsWith(yearPrefix) || !yearPrefix) {
          if (num > maxFormNum) {
            maxFormNum = num;
          }
        }
      }
    }
  };

  const checkRecord = (rec, docId = '') => {
    if (!rec && !docId) return;
    if (docId) checkVal(docId);
    if (!rec || typeof rec !== 'object') return;
    checkVal(rec['Form Number']);
    checkVal(rec['Form No.']);
    checkVal(rec['Form No']);
    checkVal(rec['FormNo']);
    checkVal(rec['formNo']);
    checkVal(rec['formNumber']);
    checkVal(rec['form_no']);
    checkVal(rec['fNo']);
    checkVal(rec['docId']);
    checkVal(rec['id']);
    checkVal(rec['_docId']);
  };

  // 1. Scan memory/sync caches
  const cachedAdmissions = getCachedCollectionSync('admissions');
  if (Array.isArray(cachedAdmissions)) {
    cachedAdmissions.forEach(item => {
      if (Array.isArray(item.items)) {
        item.items.forEach(inner => checkRecord(inner, inner?.id || inner?.docId));
      } else {
        checkRecord(item, item?.id || item?.docId);
      }
    });
  }

  const cachedMaster = getCachedCollectionSync('masterRegisters');
  if (Array.isArray(cachedMaster)) {
    cachedMaster.forEach(item => {
      if (Array.isArray(item.items)) {
        item.items.forEach(inner => checkRecord(inner, inner?.id || inner?.docId));
      } else {
        checkRecord(item, item?.id || item?.docId);
      }
    });
  }

  // 2. Query Firestore admissions collection directly
  try {
    const snap = await getDocs(collection(db, 'admissions'));
    if (!snap.empty) {
      snap.forEach(d => {
        checkRecord(d.data(), d.id);
      });
    }
  } catch (e) {
    console.warn('Firestore admissions scan for form numbers note:', e);
  }

  // 3. Check localStorage for highest seen form number
  try {
    const localMax = localStorage.getItem('hss_last_max_form_no');
    if (localMax && /^\d+$/.test(localMax)) {
      const num = parseInt(localMax, 10);
      if (!isNaN(num) && num > 0) {
        checkVal(localMax);
      }
    }
  } catch (_) {}

  // 4. Check recycled deleted form numbers (only if not already consumed in database)
  const recycled = (Array.isArray(config.recycledFormNumbers) ? config.recycledFormNumbers : [])
    .map(s => String(s || '').trim())
    .filter(s => /^\d{6}$/.test(s) && !s.startsWith('0') && !consumedNumbers.has(s));
  
  if (recycled.length > 0) {
    const firstRecycled = recycled[0];
    if (firstRecycled) return firstRecycled;
  }

  const configNext = Number(config.nextFormNumber) || Number(config.startingSeries) || defaultStartingSeries;
  const candidate = maxFormNum > 0 ? maxFormNum + 1 : Math.max(configNext, defaultStartingSeries);

  try {
    localStorage.setItem('hss_last_max_form_no', String(candidate));
  } catch (_) {}

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
  if (!/^\d{6}$/.test(cleanFormNoStr)) return;

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
