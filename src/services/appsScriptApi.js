// =================================================================
// HSS SHANGUS — Apps Script REST API Client
// =================================================================
// Centralized client for all React ↔ Apps Script communication.
// Replaces google.script.run with fetch() POST requests.
// =================================================================

import { sessionManager } from './sessionManager';
import { auth, db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { DEFAULT_FORM_STRUCTURE, DEFAULT_SUBJECTS_CONFIG } from '../utils/defaultFormSchema';

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

async function checkDuplicateMobileInSession({
  mobile,
  session,
  currentApplicationId,
  currentFormNo,
  currentOwnerUid,
  currentEmail,
}) {
  if (!mobile) return { isDuplicate: false };
  const cleanMobile = String(mobile).replace(/\D/g, '');
  if (cleanMobile.length < 10) return { isDuplicate: false };
  const targetMobile10 = cleanMobile.slice(-10);

  const targetSession = String(session || getCurrentAcademicSession()).trim();
  const currentUid = String(currentOwnerUid || auth.currentUser?.uid || sessionManager.getUser()?.uid || sessionManager.getUser()?.id || '').trim();
  const emailNorm = String(currentEmail || auth.currentUser?.email || sessionManager.getUser()?.email || '').toLowerCase().trim();
  const currentCleanFormNo = String(currentFormNo || '').replace(/^(N\/A|#N\/A|—|-|null|undefined)$/i, '').trim();
  const cleanAppId = String(currentApplicationId || '').replace(/^(N\/A|#N\/A|—|-|null|undefined)$/i, '').trim();

  try {
    const snap = await getDocs(collection(db, 'admissions'));
    if (!snap.empty) {
      for (const d of snap.docs) {
        const data = d.data() || {};
        const docFormNo = String(data['Form Number'] || data.FormNo || data.formNo || d.id || '').trim();

        // Skip current application doc if editing
        if (cleanAppId && (d.id === cleanAppId || docFormNo === cleanAppId)) continue;
        if (currentCleanFormNo && (d.id === currentCleanFormNo || d.id === currentCleanFormNo.replace(/\//g, '_') || docFormNo === currentCleanFormNo)) continue;

        // If it's the applicant's own record (same user uid or same email), skip
        if (currentUid && data.ownerUid && String(data.ownerUid).trim() === currentUid) continue;

        const docEmail = String(data['Email Address'] || data.email || data.emailNormalized || '').toLowerCase().trim();
        if (emailNorm && docEmail && docEmail === emailNorm) continue;

        // Skip withdrawn/deleted/purged/rejected records
        const status = String(data.Status || data.status || '').trim();
        if (['Withdrawn', 'Purged', 'Deleted', 'Rejected'].includes(status) || data._deleted === true || data._purged === true) {
          continue;
        }

        // Compare session
        const docSession = String(data.Session || data.session || data.sessionCanonical || '').trim() || targetSession;
        if (docSession !== targetSession) {
          continue; // Allowed in different academic sessions
        }

        // Check if student mobile or parent mobile matches
        const studentMobile = String(data['Mobile No. (with working WhatsApp)'] || data.mobile || data['Mobile Number'] || '').replace(/\D/g, '').slice(-10);
        const parentMobile = String(data["Parent's Mobile No. (must be working)"] || data.parentMobile || data['Parent Mobile'] || '').replace(/\D/g, '').slice(-10);

        if (studentMobile === targetMobile10 || parentMobile === targetMobile10) {
          const formNo = data['Form Number'] || data.FormNo || data.formNo || d.id;
          const className = String(data['Admission sought for class'] || data.class || data.Class || 'N/A').trim();
          const sessionName = docSession;

          return {
            isDuplicate: true,
            existingFormNo: formNo,
            existingSession: sessionName,
            existingClass: className,
            message: `This mobile number is already linked to Form No. ${formNo} of Session ${sessionName} (Class ${className}). Duplicate mobile submissions are not allowed for the same session.`,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[appsScriptApi] checkDuplicateMobileInSession note:', err);
  }

  return { isDuplicate: false };
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

function getCurrentAcademicSession() {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0 = Jan, 11 = Dec
  const currentYear = now.getFullYear();
  const sessionEndYear = currentMonth >= 10 ? currentYear + 1 : currentYear;
  const sessionStartYear = sessionEndYear - 1;
  return `${sessionStartYear}-${String(sessionEndYear).slice(-2)}`;
}

async function getStudentApplication() {
  const { loadAdmissionWorkspace } = await import('./admissionWorkflowApi');
  return loadAdmissionWorkspace();
}

async function saveApplication(payload) {
  const { saveAdmissionDraft, submitAdmission } = await import('./admissionWorkflowApi');
  const {
    applicationId = '',
    submissionKey = '',
    _upgradeMode = false,
    ...formData
  } = payload || {};
  const status = String(formData.Status || formData.status || '').toLowerCase();
  if (status === 'draft') {
    return saveAdmissionDraft({ formData, applicationId });
  }
  return submitAdmission({
    formData,
    applicationId,
    submissionKey,
    upgradeMode: _upgradeMode === true,
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
    cleanId.replace(/[/\s]/g, '_').toLowerCase(),
    cleanId.replace(/[/\s]/g, '_').toUpperCase(),
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
  checkDuplicateMobileInSession,
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
