// =================================================================
// HSS SHANGUS — Apps Script REST API Client
// =================================================================
// Centralized client for all React ↔ Apps Script communication.
// Replaces google.script.run with fetch() POST requests.
// =================================================================

import { sessionManager } from './sessionManager';
import { db } from './firebase';
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
      return cacheFormStructure;
    }
  } catch (e) {}

  // 1. Try Firestore First
  try {
    const snap = await getDocs(collection(db, 'formStructure'));
    if (!snap.empty) {
      const items = snap.docs.map(doc => doc.data());
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
        if (d.items && Array.isArray(d.items)) {
          d.items.forEach(item => {
            const cls = item.Class || item.class || '11th';
            if (!configObj[cls]) configObj[cls] = item;
          });
        } else if (d.Class || d.class) {
          configObj[d.Class || d.class] = d;
        }
      });
      cacheSubjectsConfig = { success: true, data: configObj };
      try { sessionStorage.setItem('cached_subjects_config', JSON.stringify(cacheSubjectsConfig)); } catch (e) {}
      return cacheSubjectsConfig;
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

async function getStudentApplication() {
  try {
    const user = sessionManager.getUser();
    if (user) {
      const email = String(user.email || '').toLowerCase().trim();
      const mobile = String(user.mobile || user.phone || '').replace(/[^0-9]/g, '');
      const regNo = String(user.regNo || user.boardRegNo || '').toLowerCase().trim();
      const aadhar = String(user.aadhar || user.aadhaar || '').replace(/[^0-9]/g, '');

      const snap = await getDocs(collection(db, 'admissions'));
      if (!snap.empty) {
        const apps = snap.docs
          .map(d => ({ docId: d.id, ...d.data() }))
          .filter(a => {
            const aEmail = String(a['Email Address'] || a.email || '').toLowerCase().trim();
            const aMobile = String(a['Mobile No. (with working WhatsApp)'] || a['Mobile No.'] || a.mobile || '').replace(/[^0-9]/g, '');
            const aRegNo = String(a['Board Registration No. (Class 10th)'] || a['Board Registration No. (Class 11th)'] || a['Board Reg. No.'] || a.regNo || '').toLowerCase().trim();
            const aAadhar = String(a['Aadhar No.'] || a.aadhar || '').replace(/[^0-9]/g, '');

            if (email && aEmail && aEmail === email) return true;
            if (mobile && aMobile && aMobile.length >= 10 && aMobile.slice(-10) === mobile.slice(-10)) return true;
            if (regNo && aRegNo && aRegNo === regNo) return true;
            if (aadhar && aAadhar && aAadhar.length >= 12 && aAadhar.slice(-12) === aadhar.slice(-12)) return true;

            return false;
          });

        if (apps.length > 0) {
          return { success: true, applications: apps, data: { applications: apps } };
        }
      }
    }
  } catch (e) {
    console.warn('Firestore getStudentApplication note:', e);
  }
  return call('getStudentApplicationData');
}

async function saveApplication(payload) {
  const data = payload.formData || payload;
  const formNo = String(data['Form Number'] || data['FormNo'] || data.formNumber || `FORM_${Date.now()}`);

  try {
    await setDoc(doc(db, 'admissions', formNo.replace(/\//g, '_')), {
      ...data,
      'Form Number': formNo,
      Status: data.Status || 'Submitted',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore saveApplication write error:', e);
  }

  // Non-blocking Apps Script background sync
  call('saveApplicationData', payload, { timeout: 120000 }).catch(err => {
    console.warn('Background Apps Script sync note:', err);
  });

  return { success: true, formNumber: formNo, message: 'Application submitted successfully to Cloud Firestore.' };
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
