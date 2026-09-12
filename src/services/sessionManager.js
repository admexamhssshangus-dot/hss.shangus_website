// =================================================================
// HSS SHANGUS — Client-Side Session Manager
// =================================================================
// Manages authentication tokens and device identifiers for the
// Apps Script REST API bridge. Supports persistent sessions
// ("Keep me logged in") via localStorage, and temporary sessions
// via sessionStorage.
// Enforces single-device active sessions across Student, Teacher,
// Admin, and Super Admin roles.
// =================================================================

import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const STORAGE_KEYS = {
  TOKEN: 'hss_session_token',
  DEVICE_ID: 'hss_device_id',
  SESSION_ID: 'hss_session_id',
  USER: 'hss_session_user',
  PERSISTENT: 'hss_persistent_login',
  LAST_HEARTBEAT: 'hss_last_heartbeat',
};

// Heartbeat interval: 5 minutes
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Device ID (unique per browser/device, persists across sessions)
// ---------------------------------------------------------------------------

/**
 * Get or create a persistent device identifier.
 * This stays the same across logins and is used for session conflict detection.
 */
function getDeviceId() {
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = _generateDeviceId();
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
}

/**
 * Generate a unique device ID using crypto.randomUUID or fallback.
 */
function _generateDeviceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Session ID (unique per active login session)
// ---------------------------------------------------------------------------

/**
 * Generate a unique session ID for an active login.
 */
function generateSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Get current active session ID from sessionStorage or localStorage.
 */
function getSessionId() {
  return sessionStorage.getItem(STORAGE_KEYS.SESSION_ID) || localStorage.getItem(STORAGE_KEYS.SESSION_ID) || null;
}

/**
 * Set active session ID in both sessionStorage and localStorage.
 */
function setSessionId(sessionId) {
  if (!sessionId) return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Cloud Active Session Management (Firestore userSessions collection)
// ---------------------------------------------------------------------------

/**
 * Register this device as the single active session in Firestore.
 * Automatically invalidates any existing sessions on other devices.
 * @param {object} user - User object containing uid, email, role
 * @param {string} deviceId - Device identifier
 * @param {string} sessionId - Session identifier
 */
async function registerActiveSessionInCloud(user, deviceId, sessionId) {
  if (!user?.uid || !db) return;
  const uid = user.uid;
  const cleanEmail = String(user.email || '').toLowerCase().trim();
  const sessionDocRef = doc(db, 'userSessions', uid);

  let platform = 'Web';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) platform = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) platform = 'iOS';
    else if (/macintosh|mac os x/i.test(ua)) platform = 'macOS';
    else if (/windows/i.test(ua)) platform = 'Windows';
    else if (/linux/i.test(ua)) platform = 'Linux';
  }

  const payload = {
    sessionId: String(sessionId),
    deviceId: String(deviceId || getDeviceId()),
    updatedAt: new Date().toISOString(),
    email: cleanEmail,
    role: user.role || 'Student',
    deviceInfo: `${platform} (${typeof navigator !== 'undefined' ? (navigator.platform || 'Web') : 'Web'})`.slice(0, 100),
  };

  try {
    await setDoc(sessionDocRef, payload, { merge: true });
  } catch (err) {
    console.warn('Active session cloud registration note:', err);
  }
}

/**
 * Listen for session revocation in real-time.
 * If another device logs into this account, onRevoked is called immediately.
 * @param {string} uid - User UID
 * @param {string} currentSessionId - Local session ID
 * @param {function} onRevoked - Callback when session is revoked by another device
 * @returns {function} Unsubscribe function
 */
function listenForSessionRevocation(uid, currentSessionId, onRevoked) {
  if (!uid || !currentSessionId || !db) return () => {};

  const sessionDocRef = doc(db, 'userSessions', uid);
  let isInitial = true;

  const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const remoteSessionId = data?.sessionId;
    const remoteDeviceId = data?.deviceId;
    const myDeviceId = getDeviceId();

    // On initial snapshot: if another session was registered on another device while offline
    if (isInitial) {
      isInitial = false;
      if (remoteSessionId && remoteSessionId !== currentSessionId && remoteDeviceId !== myDeviceId) {
        onRevoked({ remoteSessionId, remoteDeviceId, deviceInfo: data.deviceInfo });
      }
      return;
    }

    // Live update when another device writes to userSessions/{uid}
    if (remoteSessionId && remoteSessionId !== currentSessionId) {
      // Same physical browser/device (e.g., another tab of same device):
      if (remoteDeviceId === myDeviceId) {
        // Synchronize local session ID so this tab stays alive
        setSessionId(remoteSessionId);
        return;
      }

      // DIFFERENT physical device! Terminate this old session immediately!
      onRevoked({ remoteSessionId, remoteDeviceId, deviceInfo: data.deviceInfo });
    }
  }, (err) => {
    console.warn('Session revocation listener note:', err);
  });

  return unsubscribe;
}

/**
 * Clear the cloud active session record on explicit logout.
 */
async function clearActiveSessionInCloud(uid) {
  if (!uid || !db) return;
  try {
    const sessionDocRef = doc(db, 'userSessions', uid);
    await setDoc(sessionDocRef, { sessionId: '', updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Session Storage (token + user data)
// ---------------------------------------------------------------------------

/**
 * Save a session after successful login.
 * @param {object} data - Login response from the server
 * @param {string} data.token - Session token
 * @param {object} data.user  - User data (email, name, role, etc.)
 * @param {boolean} keepLoggedIn - Whether to persist across browser restarts
 */
function saveSession(data, keepLoggedIn = true) {
  localStorage.setItem(STORAGE_KEYS.PERSISTENT, keepLoggedIn ? 'true' : 'false');

  const userStr = JSON.stringify(data.user || {});
  const tokenStr = data.token || '';
  const nowStr = Date.now().toString();

  // Ensure sessionId is recorded
  const sessionId = data.sessionId || getSessionId() || generateSessionId();
  setSessionId(sessionId);

  [localStorage, sessionStorage].forEach(storage => {
    try {
      storage.setItem(STORAGE_KEYS.TOKEN, tokenStr);
      storage.setItem(STORAGE_KEYS.USER, userStr);
      storage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      storage.setItem(STORAGE_KEYS.LAST_HEARTBEAT, nowStr);
      storage.removeItem('hss_explicit_logout');
    } catch (_) {}
  });

  try { localStorage.removeItem(STORAGE_KEYS.TOKEN); } catch (_) {}

  localStorage.setItem('hss_auth_state', JSON.stringify({ role: data.user?.role, name: data.user?.name, ts: Date.now() }));

  try { window.dispatchEvent(new CustomEvent('hss-auth-changed', { detail: { loggedIn: true } })); } catch (_) {}

  getDeviceId();
}

/**
 * Get the current session data. Checks sessionStorage first, then falls back to localStorage.
 * @returns {{ token: string, user: object, deviceId: string, sessionId: string } | null}
 */
function getSession() {
  let token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
  let userRaw = sessionStorage.getItem(STORAGE_KEYS.USER) || localStorage.getItem(STORAGE_KEYS.USER);

  if (!token || !userRaw) return null;

  let user = null;
  try {
    user = JSON.parse(userRaw);
  } catch (_) {
    user = null;
  }

  if (!user || (!user.email && !user.role)) return null;

  return {
    token,
    user,
    deviceId: getDeviceId(),
    sessionId: getSessionId(),
    isPersistent: localStorage.getItem(STORAGE_KEYS.PERSISTENT) !== 'false',
  };
}

/**
 * Get just the session token.
 * @returns {string|null}
 */
function getToken() {
  const session = getSession();
  return session ? session.token : null;
}

/**
 * Get the logged-in user data.
 * @returns {object|null}
 */
function getUser() {
  const session = getSession();
  return session ? session.user : null;
}

/**
 * Check if there is an active session.
 * @returns {boolean}
 */
function isLoggedIn() {
  return !!getToken();
}

/**
 * Update the stored user data (e.g., after profile edit).
 * @param {object} updates - Partial user fields to merge
 */
function updateUser(updates) {
  const session = getSession();
  if (!session) return;

  const updatedUser = { ...session.user, ...updates };
  const userStr = JSON.stringify(updatedUser);
  [localStorage, sessionStorage].forEach(storage => {
    try { storage.setItem(STORAGE_KEYS.USER, userStr); } catch (_) {}
  });
}

/**
 * Clear all session data (logout).
 */
function clearSession() {
  [localStorage, sessionStorage].forEach(storage => {
    try {
      storage.removeItem(STORAGE_KEYS.TOKEN);
      storage.removeItem(STORAGE_KEYS.USER);
      storage.removeItem(STORAGE_KEYS.SESSION_ID);
      storage.removeItem(STORAGE_KEYS.LAST_HEARTBEAT);
      storage.removeItem('hss_explicit_logout');

      const privateCachePrefixes = [
        'hss_cache_', 'draft_prac_', 'hss_att_cache_', 'hss_csv_import_batches_', 'hss_auth_verified_sync',
        'hss_reports_cache_',
        'hss_student_draft_',
        'hss_attendance_',
        'hss_holiday_',
        'hss_practicals_draft_',
        'hss_private_',
        'hss_gemini_',
      ];
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && privateCachePrefixes.some(prefix => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => storage.removeItem(k));
    } catch (_) {}
  });
  localStorage.removeItem(STORAGE_KEYS.PERSISTENT);
  localStorage.removeItem('hss_auth_state');
  try { window.dispatchEvent(new CustomEvent('hss-auth-changed', { detail: { loggedIn: false } })); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Heartbeat tracking
// ---------------------------------------------------------------------------

function isHeartbeatDue() {
  const isPersistent = localStorage.getItem(STORAGE_KEYS.PERSISTENT) === 'true';
  const storage = isPersistent ? localStorage : sessionStorage;

  const last = parseInt(storage.getItem(STORAGE_KEYS.LAST_HEARTBEAT) || '0', 10);
  return (Date.now() - last) > HEARTBEAT_INTERVAL_MS;
}

function recordHeartbeat() {
  const isPersistent = localStorage.getItem(STORAGE_KEYS.PERSISTENT) === 'true';
  const storage = isPersistent ? localStorage : sessionStorage;
  storage.setItem(STORAGE_KEYS.LAST_HEARTBEAT, Date.now().toString());
}

// ---------------------------------------------------------------------------
// SuperAdmin Check
// ---------------------------------------------------------------------------

export const SUPERADMIN_EMAIL = 'adm.exam.hss.shangus@gmail.com';

export function isSuperAdminUser(user = null) {
  try {
    const targetUser = user || getUser();
    if (targetUser) {
      const email = String(targetUser.email || '').toLowerCase().trim();
      if (email === SUPERADMIN_EMAIL) return true;
      const role = String(targetUser.role || targetUser.Role || '').toLowerCase().replace(/\s+/g, '');
      if ((role === 'superadmin' || targetUser.isSuperAdmin === true) && email === SUPERADMIN_EMAIL) return true;
    }

    const adminUser = JSON.parse(sessionStorage.getItem('hss_admin_user') || localStorage.getItem('hss_admin_user') || '{}');
    if (adminUser) {
      const email = String(adminUser.email || '').toLowerCase().trim();
      if (email === SUPERADMIN_EMAIL) return true;
      const role = String(adminUser.role || adminUser.Role || '').toLowerCase().replace(/\s+/g, '');
      if ((role === 'superadmin' || adminUser.isSuperAdmin === true) && email === SUPERADMIN_EMAIL) return true;
    }

    const portalUser = JSON.parse(sessionStorage.getItem('hss_session_user') || localStorage.getItem('hss_session_user') || '{}');
    if (portalUser) {
      const email = String(portalUser.email || '').toLowerCase().trim();
      if (email === SUPERADMIN_EMAIL) return true;
      const role = String(portalUser.role || portalUser.Role || '').toLowerCase().replace(/\s+/g, '');
      if ((role === 'superadmin' || portalUser.isSuperAdmin === true) && email === SUPERADMIN_EMAIL) return true;
    }
  } catch (_) {}
  return false;
}

export const sessionManager = {
  // Device ID & Session ID
  getDeviceId,
  getSessionId,
  setSessionId,
  generateSessionId,

  // Cloud Active Session
  registerActiveSessionInCloud,
  listenForSessionRevocation,
  clearActiveSessionInCloud,

  // Session CRUD
  saveSession,
  getSession,
  getToken,
  getUser,
  isLoggedIn,
  isSuperAdminUser,
  updateUser,
  clearSession,

  // Heartbeat
  isHeartbeatDue,
  recordHeartbeat,
  HEARTBEAT_INTERVAL_MS,
};

export default sessionManager;
