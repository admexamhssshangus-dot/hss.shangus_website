// =================================================================
// HSS SHANGUS — Centralized Examinee Drop & Active Status Service
// =================================================================
// Provides persistent cloud synchronization for dropped/active examinees
// across all modules (Analytics Suite, JKBOSE Rolls, Custom Roster, Practicals).
// Supports students originating from live admissions, master registers, and static rosters.
// =================================================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { updateCachedItem } from './dbCache';
import { getAssignedClassRollNumber, isStudentExamDropped } from '../utils/studentApprovalStatus';

const SETTINGS_DOC = 'examineeDropOverrides';
const LOCAL_STORAGE_KEY = 'hss_examinee_drop_overrides_v1';

// Seed initial drop list so known exclusions (such as Wanhar Ahmad Malik, Class 10th Roll 22)
// are immediately active even before a fresh Firestore sync.
const INITIAL_KNOWN_DROPS = {
  'name_10th_wanharahmadmalik': {
    isExamDropped: true,
    examStatus: 'dropped',
    examDroppedReason: 'Administrative exclusion',
    studentName: 'Wanhar Ahmad Malik',
    className: '10th',
    classRollNo: '22',
    updatedAt: '2026-09-30T10:00:00.000Z'
  },
  'roll_10th_22': {
    isExamDropped: true,
    examStatus: 'dropped',
    examDroppedReason: 'Administrative exclusion',
    studentName: 'Wanhar Ahmad Malik',
    className: '10th',
    classRollNo: '22',
    updatedAt: '2026-09-30T10:00:00.000Z'
  },
  'form_250558': {
    isExamDropped: true,
    examStatus: 'dropped',
    examDroppedReason: 'Administrative exclusion',
    studentName: 'Wanhar Ahmad Malik',
    className: '10th',
    classRollNo: '22',
    updatedAt: '2026-09-30T10:00:00.000Z'
  }
};

let inMemoryOverridesMap = new Map();

/**
 * Generate lookup keys for a student record to match drop overrides.
 */
export function getStudentDropLookupKeys(st) {
  if (!st || typeof st !== 'object') return [];
  const raw = st.raw || st._rawStudent || st;
  const keys = [];

  const docId = String(st.id || st._id || st.docId || st._docId || raw.id || raw.docId || '').trim();
  if (docId && docId !== '—') {
    keys.push(`id_${docId.toLowerCase()}`);
  }

  const formNo = String(st.formNo || raw.formNo || st['Form No'] || raw['Form No'] || st['Form Number'] || raw['Form Number'] || st['Form No.'] || raw['Form No.'] || st.fNo || '').trim();
  if (formNo && formNo !== '—' && formNo !== '0') {
    keys.push(`form_${formNo.toLowerCase()}`);
  }

  const cls = String(st.class || st.className || raw.class || raw.className || raw.Class || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const sess = String(st.session || raw.session || raw.Session || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const roll = String(getAssignedClassRollNumber(st) || st.classRollNo || st.rollNo || raw.classRollNo || raw.rollNo || '').trim();
  const name = String(st.studentName || st.name || raw.studentName || raw.name || raw["Student's Name"] || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cls && roll && roll !== '—') {
    keys.push(`roll_${cls}_${roll}`);
    if (sess) {
      keys.push(`roll_${sess}_${cls}_${roll}`);
    }
  }

  if (cls && name && name.length > 2) {
    keys.push(`name_${cls}_${name}`);
    if (sess) {
      keys.push(`name_${sess}_${cls}_${name}`);
    }
  }

  if (name && roll && roll !== '—') {
    keys.push(`name_roll_${name}_${roll}`);
  }

  return keys;
}

/**
 * Fetch persistent examinee drop overrides from Cloud Firestore.
 */
export async function fetchExamineeDropOverrides() {
  const result = new Map();

  // 1. Preload initial known drops
  Object.entries(INITIAL_KNOWN_DROPS).forEach(([k, v]) => {
    result.set(k, v);
  });

  // 2. Preload local storage cache
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([k, v]) => result.set(k, v));
      }
    }
  } catch (_) {}

  // 3. Fetch from Firestore systemSettings
  try {
    const snap = await getDoc(doc(db, 'systemSettings', SETTINGS_DOC));
    if (snap.exists()) {
      const data = snap.data();
      const overrides = data.overrides || data.droppedStudents || data;
      if (overrides && typeof overrides === 'object') {
        Object.entries(overrides).forEach(([k, v]) => {
          if (v && typeof v === 'object') {
            result.set(k, v);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[examineeDropService] Firestore fetch note:', err.message || err);
  }

  inMemoryOverridesMap = result;
  return result;
}

/**
 * Checks whether a student is marked as dropped, either by direct field or persistent override.
 */
export function checkIsStudentDropped(st, overridesMap = inMemoryOverridesMap) {
  if (!st) return false;
  if (isStudentExamDropped(st)) return true;

  if (overridesMap && overridesMap.size > 0) {
    const lookupKeys = getStudentDropLookupKeys(st);
    for (const key of lookupKeys) {
      if (overridesMap.has(key)) {
        const entry = overridesMap.get(key);
        if (entry && entry.isExamDropped !== undefined) {
          return Boolean(entry.isExamDropped);
        }
      }
    }
  }

  return false;
}

/**
 * Persist drop or restore status for a student end-to-end.
 */
export async function persistStudentExamDropStatus(student, shouldDrop, reasonText = '', userEmail = 'admin') {
  if (!student) throw new Error('Student record is required');

  const keys = getStudentDropLookupKeys(student);
  const primaryDocId = String(student.id || student._id || student.docId || student._docId || '').trim();
  const formNo = String(student.formNo || student['Form No'] || student['Form Number'] || '').trim();
  const studentName = student.studentName || student.name || 'Student';

  const updatePayload = {
    isExamDropped: shouldDrop,
    examStatus: shouldDrop ? 'dropped' : 'active',
    examDroppedReason: shouldDrop ? (reasonText || 'Administrative exclusion') : null,
    examDroppedAt: shouldDrop ? new Date().toISOString() : null,
    examDroppedBy: userEmail || 'admin',
    updatedAt: new Date().toISOString(),
    studentName,
    classRollNo: getAssignedClassRollNumber(student) || student.classRollNo || '',
    className: student.className || student.class || '',
    session: student.session || student.Session || ''
  };

  // 1. Update in-memory map
  keys.forEach(k => inMemoryOverridesMap.set(k, updatePayload));

  // 2. Persist to localStorage
  try {
    const obj = {};
    inMemoryOverridesMap.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj));
  } catch (_) {}

  // 3. Persist to Cloud Firestore collection 'systemSettings' doc 'examineeDropOverrides'
  try {
    const firestoreOverrides = {};
    keys.forEach(k => {
      firestoreOverrides[k] = updatePayload;
    });

    await setDoc(doc(db, 'systemSettings', SETTINGS_DOC), {
      overrides: firestoreOverrides,
      lastUpdated: new Date().toISOString(),
      updatedBy: userEmail || 'admin'
    }, { merge: true });
  } catch (cloudErr) {
    console.warn('[examineeDropService] Cloud settings note:', cloudErr.message || cloudErr);
  }

  // 4. Update the student document in Firestore if an authentic docId or formNo exists
  let primaryDocUpdated = false;
  const targetDocId = primaryDocId || formNo;

  if (targetDocId && targetDocId !== '—' && !targetDocId.startsWith('item_') && !targetDocId.startsWith('part_')) {
    // If student has a parent chunk in masterRegisters
    const parentDocId = student._parentDocId || student.parentDocId;
    if (student._srcCollection === 'masterRegisters' && parentDocId) {
      try {
        const parentRef = doc(db, 'masterRegisters', String(parentDocId));
        const parentSnap = await getDoc(parentRef);
        if (parentSnap.exists()) {
          const parentData = parentSnap.data();
          const arrayKey = ['items', 'students', 'records', 'data'].find(k => Array.isArray(parentData[k]));
          if (arrayKey) {
            const updatedArray = parentData[arrayKey].map(rec => {
              const recKeys = getStudentDropLookupKeys(rec);
              const matches = recKeys.some(rk => keys.includes(rk));
              if (matches) {
                return { ...rec, ...updatePayload };
              }
              return rec;
            });
            await setDoc(parentRef, { [arrayKey]: updatedArray, updatedAt: serverTimestamp() }, { merge: true });
            updateCachedItem('masterRegisters', String(parentDocId), { [arrayKey]: updatedArray });
            primaryDocUpdated = true;
          }
        }
      } catch (chunkErr) {
        console.warn('[examineeDropService] Chunk update note:', chunkErr.message || chunkErr);
      }
    }

    // Attempt direct setDoc with merge in admissions
    if (!primaryDocUpdated) {
      try {
        const admRef = doc(db, 'admissions', targetDocId);
        await setDoc(admRef, updatePayload, { merge: true });
        updateCachedItem('admissions', targetDocId, updatePayload);
        primaryDocUpdated = true;
      } catch (admErr) {
        console.warn('[examineeDropService] Direct admissions setDoc note:', admErr.message || admErr);
      }
    }
  }

  return {
    success: true,
    updatedStudent: { ...student, ...updatePayload },
    keys
  };
}
