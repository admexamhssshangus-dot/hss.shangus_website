// =================================================================
// HSS SHANGUS — Apps Script REST API Client
// =================================================================
// Centralized client for all React ↔ Apps Script communication.
// Replaces google.script.run with fetch() POST requests.
// =================================================================

import { sessionManager } from './sessionManager';
import { auth, db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc, query, where } from 'firebase/firestore';
import { DEFAULT_FORM_STRUCTURE, DEFAULT_SUBJECTS_CONFIG } from '../utils/defaultFormSchema';
import { getCachedCollection, getCachedCollectionSync } from './dbCache';
import { loadAdmissionWorkspace, submitAdmission } from './admissionWorkflowApi';

const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec';
const APPS_SCRIPT_URL = process.env.REACT_APP_APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds (Apps Script can be slow)

// ---------------------------------------------------------------------------
// Error Messages (user-friendly mapping)
// ---------------------------------------------------------------------------
const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Your session has expired. Please log in again.',
  SESSION_INVALID: 'Your session is no longer valid. Please log in again.',
  SESSION_CONFLICT: 'Your account has been logged in from another device.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT: 'The request took too long. Please try again.',
  SERVER_ERROR: 'Something went wrong on the server. Please try again later.',
  INVALID_RESPONSE: 'Received an invalid response from the server.',
};

// ---------------------------------------------------------------------------
// Core API call function
// ---------------------------------------------------------------------------

/**
 * Call an Apps Script server function via the REST API bridge.
 *
 * @param {string}  action    - The server function name (e.g., 'loginUser')
 * @param {object}  params    - Parameters to pass to the function
 * @param {object}  options   - Additional options
 * @param {boolean} options.requireAuth  - Whether to attach session token (default: auto-detect)
 * @param {number}  options.timeout      - Custom timeout in ms
 * @param {number}  options.retries      - Number of retries on transient failures
 * @returns {Promise<any>}    - The result data from the server function
 */
async function call(action, params = {}, options = {}) {
  if (!APPS_SCRIPT_URL) {
    throw new ApiError(
      'Apps Script URL not configured. Set REACT_APP_APPS_SCRIPT_URL in your .env file.',
      'CONFIG_ERROR'
    );
  }

  const timeout = options.timeout || REQUEST_TIMEOUT_MS;
  const maxRetries = options.retries !== undefined ? options.retries : MAX_RETRIES;

  // Build request body
  const body = {
    action,
    params,
    deviceId: sessionManager.getDeviceId(),
  };

  // Attach auth token if available (or if explicitly required)
  const session = sessionManager.getSession();
  if (session && session.token) {
    body.token = session.token;
  } else if (options.requireAuth) {
    throw new ApiError(ERROR_MESSAGES.AUTH_REQUIRED, 'AUTH_REQUIRED');
  }

  // Execute with retries
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await _executeFetch(body, timeout);
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry auth errors or client errors
      if (error.code === 'AUTH_REQUIRED' || error.code === 'SESSION_INVALID' || error.code === 'SESSION_CONFLICT') {
        console.warn('[appsScriptApi] Auth exception:', error.code);
        throw error;
      }

      // Retry on transient network/server errors
      if (attempt < maxRetries) {
        await _delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError;
}

/**
 * Execute the actual fetch request with timeout
 */
async function _executeFetch(body, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        // Apps Script deployed web apps don't support custom headers well,
        // so we send everything in the body. Content-Type is text/plain
        // to avoid CORS preflight (simple request).
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'follow', // Apps Script redirects on exec
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ApiError(
        `Server returned ${response.status}: ${response.statusText}`,
        'SERVER_ERROR'
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(ERROR_MESSAGES.INVALID_RESPONSE, 'INVALID_RESPONSE');
    }

    // Handle API-level errors
    if (data && data.success === false) {
      throw new ApiError(
        data.error || data.message || 'Operation failed',
        data.code || 'SERVER_ERROR'
      );
    }

    // Return the data payload
    return data.data !== undefined ? data.data : data;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new ApiError(ERROR_MESSAGES.TIMEOUT, 'TIMEOUT');
    }

    throw new ApiError(
      ERROR_MESSAGES.NETWORK_ERROR,
      'NETWORK_ERROR'
    );
  }
}

// ---------------------------------------------------------------------------
// Convenience methods for common operations
// ---------------------------------------------------------------------------

/**
 * Health check — verify the API bridge is working.
 * @returns {Promise<{status: string, version: string, timestamp: string}>}
 */
function ping() {
  return call('ping', {}, { retries: 0, timeout: 10000 });
}

async function login(email, password, keepLoggedIn = false, requiredRole = '', forceLogin = false) {
  let res = await call('loginUser', { email, password, keepLoggedIn, requiredRole, forceLogin }, { requireAuth: false });
  
  // Auto-fallback: If Admin tab was selected but account is SuperAdmin (which legacy script expects 'president' for)
  if (res && res.success === false && requiredRole === 'admin' && res.message && (res.message.includes('SuperAdmin') || res.message.includes('role mismatch'))) {
    res = await call('loginUser', { email, password, keepLoggedIn, requiredRole: 'president', forceLogin }, { requireAuth: false });
  }
  
  // Normalize token field for React frontend
  if (res && res.sessionToken && !res.token) {
    res.token = res.sessionToken;
  }
  
  return res;
}

function register(name, email, mobile, password, otp, role = 'Student', initialClass = '', initialSubject = '') {
  return call('registerUser', { name, email, mobile, password, otp, role, initialClass, initialSubject }, { requireAuth: false });
}

function checkEmail(email, role = 'student') {
  return call('checkEmailRegistered', { email, role }, { requireAuth: false });
}

function checkMobile(mobile, email = null) {
  return call('checkMobileRegistered', { mobile, email }, { requireAuth: false });
}

function sendOTP(email, name, mobile) {
  return call('sendRegistrationOTP', { email, name, mobile }, { requireAuth: false });
}

function sendResetOTP(email) {
  return call('sendPasswordResetOTP', { email }, { requireAuth: false });
}

function resetPassword(email, otp, newPassword) {
  return call('resetPasswordWithOTP', { email, otp, newPassword }, { requireAuth: false });
}

function getAvailableRoles(email) {
  return call('getAvailableRolesForEmail', { email }, { requireAuth: false });
}

// --- Session ---
function validateSession() {
  return call('validatePersistentSession');
}

function heartbeat() {
  return call('validateSessionHeartbeat', {}, { retries: 0, timeout: 15000 });
}

function logout() {
  return call('revokePersistentSession').finally(() => {
    sessionManager.clearSession();
  });
}

function switchRole(email, newRole) {
  return call('switchUserRole', { email, newRole });
}

// --- Public Data ---
function getPublicSettings() {
  return call('getPublicSettings', {}, { requireAuth: false });
}

// Memory caches for static configurations
let cacheFormStructure = null;
let cacheSubjectsConfig = null;

async function getFormStructure() {
  if (cacheFormStructure) return cacheFormStructure;
  try {
    const cachedStr = sessionStorage.getItem('cached_form_structure');
    if (cachedStr) {
      cacheFormStructure = JSON.parse(cachedStr);
      if (cacheFormStructure && Array.isArray(cacheFormStructure.data)) {
        const existingNames = new Set(cacheFormStructure.data.map(f => f.fieldName || f.name || f['Field Name']));
        DEFAULT_FORM_STRUCTURE.forEach(defField => {
          const defName = defField.fieldName || defField.name || defField['Field Name'];
          if (!existingNames.has(defName)) {
            cacheFormStructure.data.push(defField);
          }
        });
      }
      return cacheFormStructure;
    }
  } catch (e) {}

  // 1. Try Firestore First
  try {
    const snap = await getDocs(collection(db, 'formStructure'));
    if (!snap.empty) {
      const items = snap.docs.map(doc => doc.data());
      // Merge in any missing canonical fields from DEFAULT_FORM_STRUCTURE
      const existingNames = new Set(items.map(f => f.fieldName || f.name || f['Field Name']));
      DEFAULT_FORM_STRUCTURE.forEach(defField => {
        const defName = defField.fieldName || defField.name || defField['Field Name'];
        if (!existingNames.has(defName)) {
          items.push(defField);
        }
      });
      cacheFormStructure = { success: true, data: items };
      try { sessionStorage.setItem('cached_form_structure', JSON.stringify(cacheFormStructure)); } catch (e) {}
      return cacheFormStructure;
    }
  } catch (err) {
    console.warn('Firestore getFormStructure note:', err);
  }

  // 2. Pure Offline / Firestore Default Fallback (0ms Network latency)
  cacheFormStructure = { success: true, data: DEFAULT_FORM_STRUCTURE };
  try { sessionStorage.setItem('cached_form_structure', JSON.stringify(cacheFormStructure)); } catch (e) {}
  return cacheFormStructure;
}

async function getSubjectsConfig() {
  if (cacheSubjectsConfig) return cacheSubjectsConfig;
  try {
    const cachedSubj = sessionStorage.getItem('cached_subjects_config');
    if (cachedSubj) {
      cacheSubjectsConfig = JSON.parse(cachedSubj);
      return cacheSubjectsConfig;
    }
  } catch (e) {}

  // 1. Try Firestore First
  try {
    const snap = await getDocs(collection(db, 'subjectsConfig'));
    if (!snap.empty) {
      const configObj = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        const rawItems = Array.isArray(d.items) ? d.items : [d];
        rawItems.forEach(item => {
          if (!item || typeof item !== 'object') return;
          const cls = String(item.Class || item.class || d.groupKey || '').trim();
          if (!cls) return;

          const stream = String(item.Stream || item.stream || 'General').trim();
          if (!configObj[cls]) configObj[cls] = {};

          const compulsory = Array.isArray(item['Compulsory Subjects'] || item.compulsory)
            ? (item['Compulsory Subjects'] || item.compulsory)
            : String(item['Compulsory Subjects'] || item.compulsory || '').split(',').map(s => s.trim()).filter(Boolean);

          const group1 = Array.isArray(item['Group1 Options'] || item['Group 1 Options'] || item.group1)
            ? (item['Group1 Options'] || item['Group 1 Options'] || item.group1)
            : String(item['Group1 Options'] || item['Group 1 Options'] || item.group1 || '').split(',').map(s => s.trim()).filter(Boolean);

          const group2 = Array.isArray(item['Group2 Options'] || item['Group 2 Options'] || item.group2)
            ? (item['Group2 Options'] || item['Group 2 Options'] || item.group2)
            : String(item['Group2 Options'] || item['Group 2 Options'] || item.group2 || '').split(',').map(s => s.trim()).filter(Boolean);

          const optional = Array.isArray(item.optional)
            ? item.optional
            : [...new Set([...group1, ...group2])];

          configObj[cls][stream] = {
            ...item,
            compulsory,
            group1,
            group2,
            optional,
            g1Min: item['G1 Min'] !== undefined ? Number(item['G1 Min']) : 1,
            g1Max: item['G1 Max'] !== undefined ? Number(item['G1 Max']) : 1,
            g2Min: item['G2 Min'] !== undefined ? Number(item['G2 Min']) : 0,
            g2Max: item['G2 Max'] !== undefined ? Number(item['G2 Max']) : 1,
          };
        });
      });

      if (Object.keys(configObj).length > 0) {
        cacheSubjectsConfig = { success: true, data: configObj };
        try { sessionStorage.setItem('cached_subjects_config', JSON.stringify(cacheSubjectsConfig)); } catch (e) {}
        return cacheSubjectsConfig;
      }
    }
  } catch (err) {
    console.warn('Firestore getSubjectsConfig note:', err);
  }

  // 2. Pure Offline / Firestore Default Fallback (0ms Network latency)
  cacheSubjectsConfig = { success: true, data: DEFAULT_SUBJECTS_CONFIG };
  try { sessionStorage.setItem('cached_subjects_config', JSON.stringify(cacheSubjectsConfig)); } catch (e) {}
  return cacheSubjectsConfig;
}

// --- Student ---
function getInitialData() {
  return call('getInitialDataForUser');
}

async function legacyGetStudentApplication() {
  try {
    const user = sessionManager.getUser();
    if (user) {
      const uid = auth.currentUser?.uid || user.uid || user.id || '';
      const email = String(user.email || '').toLowerCase().trim();
      const mobile = String(user.mobile || user.phone || user['Mobile No. (with working WhatsApp)'] || '').replace(/[^0-9]/g, '');
      const regNo = String(user.regNo || user.boardRegNo || user['Board Registration Number'] || '').toLowerCase().trim();
      const aadhar = String(user.aadhar || user.aadhaar || user['Aadhar No.'] || '').replace(/[^0-9]/g, '');
      const studentName = String(user.name || user.displayName || user.studentName || user["Student's Name (as per school records)"] || '').toLowerCase().trim();

      const isMatch = (a) => {
        if (!a) return false;
        // Skip soft-deleted and purged records
        if (a.Status === 'Deleted' || a.status === 'Deleted' || a.Status === 'Purged' || a.status === 'Purged' || a._deleted === true) return false;

        if (uid && a.ownerUid && String(a.ownerUid).trim() === String(uid).trim()) return true;

        const aEmail = String(a['Email Address'] || a.email || a.emailNormalized || '').toLowerCase().trim();
        if (email && aEmail && aEmail === email) return true;

        const aMobile = String(a['Mobile No. (with working WhatsApp)'] || a['Mobile No.'] || a.mobile || '').replace(/[^0-9]/g, '');
        if (mobile && aMobile && aMobile.length >= 10 && aMobile.slice(-10) === mobile.slice(-10)) return true;

        const aRegNo = String(a['Board Registration No. (Class 10th)'] || a['Board Registration No. (Class 11th)'] || a['Board Registration Number'] || a['Board Reg. No.'] || a.regNo || '').toLowerCase().trim();
        if (regNo && aRegNo && aRegNo === regNo) return true;

        const aAadhar = String(a['Aadhar No.'] || a.aadhar || '').replace(/[^0-9]/g, '');
        if (aadhar && aAadhar && aAadhar.length >= 12 && aAadhar.slice(-12) === aadhar.slice(-12)) return true;

        const aName = String(a["Student's Name (as per school records)"] || a["Student's Name"] || a.studentName || a.name || '').toLowerCase().trim();
        if (studentName && aName && studentName === aName && (email || mobile)) return true;

        return false;
      };

      const matchedApps = [];
      const historicalRecords = [];

      // 1. Search admissions (Use instant memory/sync cache first)
      const cachedAdmissions = getCachedCollectionSync('admissions');
      if (cachedAdmissions && Array.isArray(cachedAdmissions)) {
        cachedAdmissions.forEach(d => {
          if (isMatch(d)) matchedApps.push(d);
        });
      }

      // If sync cache missed, fetch fresh admissions from cache/Firestore SWR
      if (matchedApps.length === 0) {
        try {
          const freshApps = await getCachedCollection('admissions', true, 5 * 60 * 1000);
          if (freshApps && Array.isArray(freshApps)) {
            freshApps.forEach(d => {
              if (isMatch(d)) matchedApps.push(d);
            });
          }
        } catch (e) {}
      }

      // 2. Search masterRegisters for historical student records (Sync cache first)
      const cachedMaster = getCachedCollectionSync('masterRegisters');
      if (cachedMaster && Array.isArray(cachedMaster)) {
        cachedMaster.forEach(d => {
          if (Array.isArray(d.items)) {
            d.items.forEach(item => {
              if (isMatch(item)) historicalRecords.push({ docId: item['Form Number'] || d.id, ...item });
            });
          } else if (isMatch(d)) {
            historicalRecords.push({ docId: d.id, ...d });
          }
        });
      }

      // Filter out any soft-deleted records that slipped through cache
      const liveApps = matchedApps.filter(a => a.Status !== 'Deleted' && a.status !== 'Deleted' && a._deleted !== true);

      return {
        success: true,
        applications: liveApps,
        historicalRecords,
        data: { applications: liveApps, historicalRecords }
      };
    }
  } catch (e) {
    console.warn('getStudentApplication note:', e);
  }
  return { success: true, applications: [], historicalRecords: [], data: { applications: [], historicalRecords: [] } };
}

async function legacySaveApplication(payload) {
  const data = payload.formData || payload;
  const isUpgradeMode = Boolean(payload._upgradeMode || data._upgradeMode);
  const provisionalFormNo = payload._provisionalFormNo || data._provisionalFormNo;

  const cleanFNoVal = (val) => {
    if (!val) return '';
    const s = String(val).replace(/^(N\/A|#N\/A|—|-|null|undefined)$/i, '').trim();
    if (s.startsWith('FORM_')) return '';
    return s;
  };

  let formNo = cleanFNoVal(provisionalFormNo || data['Form Number'] || data['FormNo'] || data['Form No.'] || data.formNumber || data.formNo);
  if (!formNo) {
    try {
      const { getNextAvailableFormNumber } = require('./formNumberService');
      formNo = await getNextAvailableFormNumber();
    } catch (_) {
      formNo = `26${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }
  const sanitizedDocId = formNo.replace(/\//g, '_');

  const admissionClass = String(data['Admission sought for class'] || data['class'] || '').trim();
  const session = String(data['Session'] || data['session'] || '').trim();
  const userEmail = String(data['Email Address'] || data['email'] || '').toLowerCase().trim();
  const userMobile = String(data['Mobile No. (with working WhatsApp)'] || data['mobile'] || '').replace(/[^0-9]/g, '');
  const isProvisional = data['Admission Type (Class 11th)'] === 'Provisional' ||
    data['Admission Type (Class 12th)'] === 'Provisional' ||
    data['Admission Type'] === 'Provisional' ||
    Boolean(data.isProvisional);

  // ── DUPLICATE GUARD (skip in upgrade mode) ──
  if (!isUpgradeMode && !isProvisional) {
    try {
      const snap = await getDocs(collection(db, 'admissions'));
      if (!snap.empty) {
        for (const d of snap.docs) {
          if (d.id === sanitizedDocId) continue; // same doc = edit, not duplicate
          const ex = d.data();
          const exClass = String(ex['Admission sought for class'] || ex['class'] || '').trim();
          const exSession = String(ex['Session'] || ex['session'] || '').trim();
          const exStatus = String(ex['Status'] || ex['status'] || '').trim();
          const exEmail = String(ex['Email Address'] || ex['email'] || '').toLowerCase().trim();
          const exMobile = String(ex['Mobile No. (with working WhatsApp)'] || ex['mobile'] || '').replace(/[^0-9]/g, '');
          const exIsProvisional = ex['Admission Type (Class 11th)'] === 'Provisional' ||
            ex['Admission Type (Class 12th)'] === 'Provisional' ||
            ex['Admission Type'] === 'Provisional' ||
            Boolean(ex.isProvisional);

          // Match same student (email or mobile) for same session + class
          const isSameStudent =
            (userEmail && exEmail && userEmail === exEmail) ||
            (userMobile && exMobile && userMobile.slice(-10) === exMobile.slice(-10));
          const isSameContext =
            (!session || !exSession || session === exSession) &&
            (exClass === admissionClass);
          const isExistingFull = !exIsProvisional &&
            (exStatus === 'Submitted' || exStatus === 'Approved' || exStatus === 'Draft');

          if (isSameStudent && isSameContext && isExistingFull) {
            return {
              success: false,
              error: 'duplicate',
              message: `You already have an active ${exStatus} admission application (Form #${ex['Form Number'] || d.id}) for Class ${exClass}. You can edit it instead of submitting a new one.`,
              existingFormNo: ex['Form Number'] || d.id,
            };
          }
        }
      }
    } catch (dupErr) {
      console.warn('Duplicate guard check error (non-fatal):', dupErr);
    }
  }

  const payloadData = {
    ...data,
    ownerUid: auth.currentUser?.uid || data.ownerUid,
    'Form Number': formNo,
    isProvisional: isProvisional,
    Status: data.Status || 'Submitted',
    updatedAt: new Date().toISOString(),
    ...(isUpgradeMode ? { upgradedAt: new Date().toISOString(), isProvisional: false } : {}),
  };
  // Remove internal flags from saved data
  delete payloadData._upgradeMode;
  delete payloadData._provisionalFormNo;

  try {
    await setDoc(doc(db, 'admissions', sanitizedDocId), payloadData, { merge: true });
  } catch (e) {
    console.warn('Firestore saveApplication admissions write error:', e);
  }

  // ── ADMISSION HISTORY (upgrade only) ──
  if (isUpgradeMode) {
    try {
      const historyDocId = `${sanitizedDocId}_upgrade_${Date.now()}`;
      await setDoc(doc(db, 'admissionHistory', historyDocId), {
        formNo,
        event: 'provisional_upgraded_to_full',
        studentName: data["Student's Name (as per school records)"] || data['name'] || '',
        studentEmail: userEmail,
        admissionClass,
        session,
        timestamp: new Date().toISOString(),
      });
    } catch (histErr) {
      console.warn('admissionHistory write error (non-fatal):', histErr);
    }
  }

  // masterRegisters is populated ONLY during session-close (Push to Source & Reset Session).
  // New admissions must NOT be written here.

  try {
    const { updateCachedItem, syncStudentPhotoOnRegUpdate } = require('./dbCache');
    updateCachedItem('admissions', sanitizedDocId, payloadData);
    const reg = data['Board Registration Number'] || data['Board Registration No.'] || data['Board Registration No. (Class 10th)'] || data['Board Registration No. (Class 11th)'] || data.boardRegNo || data.regNo;
    const photo = data.photo_id || data['Student Photo'] || data.photoUrl || data.photo;
    if (reg && photo && typeof syncStudentPhotoOnRegUpdate === 'function') {
      syncStudentPhotoOnRegUpdate({
        newReg: reg,
        student: payloadData,
        photoData: photo
      }).catch(() => {});
    }
  } catch (e) {}

  // Non-blocking Apps Script background sync
  call('saveApplicationData', payload, { timeout: 120000 }).catch(err => {
    console.warn('Background Apps Script sync note:', err);
  });

  return {
    success: true,
    formNumber: formNo,
    isProvisional,
    wasUpgraded: isUpgradeMode,
    message: isUpgradeMode
      ? `Provisional admission (Form #${formNo}) successfully upgraded to Full Admission!`
      : isProvisional
      ? `Provisional admission form (Form #${formNo}) submitted successfully!`
      : 'Application submitted successfully to official database.',
  };
}

function getCurrentAcademicSession() {
  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth() + 1; // 1-12
  const calDay = now.getDate();
  const isPastCutoff = calMonth > 10 || (calMonth === 10 && calDay > 31);
  const sessionEndYear = isPastCutoff ? calYear + 1 : calYear;
  const sessionStartYear = sessionEndYear - 1;
  return `${sessionStartYear}-${String(sessionEndYear).slice(-2)}`;
}

async function getStudentApplication() {
  const computedSession = getCurrentAcademicSession();
  try {
    // Plain CRA localhost does not host Netlify Functions. Use the same
    // owner-scoped Firestore read locally so dashboard/form loading stays clean;
    // writes still require the authoritative Netlify workflow.
    if (process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      const uid = auth.currentUser?.uid;
      const email = (auth.currentUser?.email || '').toLowerCase().trim();
      if (!uid && !email) {
        return { success: true, applications: [], historicalRecords: [], activeSession: computedSession, data: { applications: [], historicalRecords: [], activeSession: computedSession } };
      }
      try {
        let appDocs = [];
        if (uid) {
          const snap = await getDocs(query(collection(db, 'admissions'), where('ownerUid', '==', uid)));
          appDocs.push(...snap.docs);
        }
        if (email && appDocs.length === 0) {
          const emailSnap = await getDocs(query(collection(db, 'admissions'), where('emailNormalized', '==', email)));
          appDocs.push(...emailSnap.docs);
        }
        const applications = appDocs
          .map(item => ({ docId: item.id, ...item.data() }))
          .filter(item => item.Status !== 'Deleted' && item.Status !== 'Withdrawn' && item._deleted !== true);
        return {
          success: true,
          applications,
          historicalRecords: [],
          activeSession: computedSession,
          data: { applications, historicalRecords: [], activeSession: computedSession },
          localReadOnly: true,
        };
      } catch (err) {
        console.warn('Local Firestore admissions lookup note:', err);
        return {
          success: true,
          applications: [],
          historicalRecords: [],
          activeSession: computedSession,
          data: { applications: [], historicalRecords: [], activeSession: computedSession },
          localReadOnly: true,
        };
      }
    }
    const workspace = await loadAdmissionWorkspace();
    const applications = Array.isArray(workspace.applications) ? workspace.applications : [];
    const activeSession = workspace.activeSession || computedSession;
    return {
      success: true,
      applications,
      historicalRecords: [],
      activeSession,
      admissionAvailability: workspace.admissionAvailability || {},
      data: {
        applications,
        historicalRecords: [],
        activeSession,
        admissionAvailability: workspace.admissionAvailability || {},
      },
    };
  } catch (e) {
    console.warn('getStudentApplication fallback note:', e);
    return {
      success: true,
      applications: [],
      historicalRecords: [],
      activeSession: computedSession,
      data: { applications: [], historicalRecords: [], activeSession: computedSession },
    };
  }
}

async function saveApplication(payload) {
  const role = String(sessionManager.getUser()?.role || '').toLowerCase();
  if (role.includes('admin')) return legacySaveApplication(payload);
  const data = payload.formData || payload;
  return submitAdmission({
    formData: data,
    applicationId: payload.applicationId || data.docId || data.applicationId || '',
    submissionKey: payload.submissionKey,
    upgradeMode: Boolean(payload._upgradeMode || data._upgradeMode),
  });
}

async function deleteStudentApplication(formNoOrDocId) {
  if (!formNoOrDocId) return { success: false, message: 'Form number required.' };
  const rawId = String(formNoOrDocId).trim();
  const digitsOnly = rawId.replace(/[^0-9]/g, '');
  const cleanId = rawId.replace(/^#/, '').trim();

  const user = sessionManager.getUser();
  const userEmail = user?.email ? String(user.email).toLowerCase().trim() : '';

  // Generate all possible document ID formats this record could be stored under
  const idCandidates = Array.from(new Set([
    rawId,
    cleanId,
    digitsOnly,
    `FORM_${digitsOnly}`,
    `FORM_${cleanId}`,
    cleanId.replace(/\//g, '_'),
    cleanId.replace(/[\/\s]/g, '_').toLowerCase(),
    cleanId.replace(/[\/\s]/g, '_').toUpperCase(),
  ].filter(Boolean)));

  const deletionTimestamp = new Date().toISOString();
  const softDeletePayload = {
    Status: 'Deleted',
    _deleted: true,
    _deletedAt: deletionTimestamp,
    _deletedBy: userEmail || 'Student Self Delete',
  };

  let softDeletedCount = 0;

  try {
    // Legacy fallback only: update exact existing candidate IDs. Do not create
    // guessed Deleted stubs and do not scan admissions by identity.
    for (const cid of idCandidates) {
      if (!cid || cid.includes('/')) continue;
      try {
        const ref = doc(db, 'admissions', cid);
        const existing = await getDoc(ref);
        if (!existing.exists()) continue;
        await setDoc(ref, softDeletePayload, { merge: true });
        softDeletedCount++;
      } catch (_) {}
    }

    // 3. Clear local multi-tier caches completely
    const { updateCachedItem, invalidateCache } = require('./dbCache');
    idCandidates.forEach(cid => {
      updateCachedItem('admissions', cid, null);
      updateCachedItem('masterRegisters', cid, null);
    });
    invalidateCache('admissions');
    invalidateCache('masterRegisters');

    // 4. Recycle deleted form number into system queue
    const { recycleDeletedFormNumber } = require('./formNumberService');
    recycleDeletedFormNumber(cleanId || digitsOnly, {}, userEmail || 'Student Self Delete').catch(() => {});

    // 5. Clear local session storage draft
    try { sessionStorage.removeItem('hss_admission_draft'); } catch(e) {}

    console.log(`[deleteStudentApplication] Soft-deleted ${softDeletedCount} documents for form ${cleanId}`);

    return { success: true, message: `Application #${cleanId} deleted successfully.` };
  } catch (e) {
    console.error('deleteStudentApplication error:', e);
    return { success: false, error: e.message };
  }
}

function updateProfile(email, name, mobile, residence) {
  return call('updateUserProfile', { email, name, mobile, residence });
}

// --- Admin ---
let cacheAdminDashboard = null;

async function getAdminDashboard(options = {}) {
  const force = options.forceRefresh;
  if (!force && cacheAdminDashboard) return cacheAdminDashboard;

  if (!force) {
    try {
      const cached = sessionStorage.getItem('cached_admin_dashboard');
      if (cached) {
        cacheAdminDashboard = JSON.parse(cached);
        return cacheAdminDashboard;
      }
    } catch (e) {}
  }

  // 1. Try Firestore First for Instant 0ms Load
  try {
    const snap = await getDocs(collection(db, 'admissions'));
    if (!snap.empty) {
      const list = snap.docs.map(doc => doc.data());
      cacheAdminDashboard = { success: true, applications: list, total: list.length };
      try { sessionStorage.setItem('cached_admin_dashboard', JSON.stringify(cacheAdminDashboard)); } catch (e) {}
      return cacheAdminDashboard;
    }
  } catch (err) {
    console.warn('Firestore getAdminDashboard note:', err);
  }

  // 2. Apps Script Fallback
  return call('getAdminDashboardData', {}, { timeout: 120000 }).then(res => {
    if (res) {
      cacheAdminDashboard = res;
      try { sessionStorage.setItem('cached_admin_dashboard', JSON.stringify(res)); } catch (e) {}
    }
    return res;
  });
}

function invalidateAdminCache() {
  cacheAdminDashboard = null;
  try { sessionStorage.removeItem('cached_admin_dashboard'); } catch (e) {}
}

// --- Task Progress ---
function getTaskProgress(taskId) {
  return call('getTaskProgress', { taskId }, { retries: 0, timeout: 10000 });
}

function abortTask(taskId) {
  return call('abortTask', { taskId }, { retries: 0 });
}

// ---------------------------------------------------------------------------
// Custom Error class
// ---------------------------------------------------------------------------
class ApiError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }

  /**
   * Get a user-friendly error message
   */
  get userMessage() {
    return ERROR_MESSAGES[this.code] || this.message;
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
const appsScriptApi = {
  // Core
  call,
  ping,
  ApiError,

  // Auth
  login,
  register,
  checkEmail,
  checkMobile,
  sendOTP,
  sendResetOTP,
  resetPassword,
  getAvailableRoles,

  // Session
  validateSession,
  heartbeat,
  logout,
  switchRole,

  // Public
  getPublicSettings,
  getFormStructure,
  getSubjectsConfig,

  // Student
  getInitialData,
  getStudentApplication,
  saveApplication,
  deleteStudentApplication,
  updateProfile,

  // Admin
  getAdminDashboard,
  invalidateAdminCache,

  // Task
  getTaskProgress,
  abortTask,
};

export default appsScriptApi;
export { ApiError };
