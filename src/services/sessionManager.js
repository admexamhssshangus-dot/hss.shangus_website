// =================================================================
// HSS SHANGUS — Client-Side Session Manager
// =================================================================
// Manages authentication tokens and device identifiers for the
// Apps Script REST API bridge. Supports persistent sessions
// ("Keep me logged in") via localStorage, and temporary sessions
// via sessionStorage.
// =================================================================

const STORAGE_KEYS = {
  TOKEN: 'hss_session_token',
  DEVICE_ID: 'hss_device_id',
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
// Session Storage (token + user data)
// ---------------------------------------------------------------------------

/**
 * Save a session after successful login.
 * @param {object} data - Login response from the server
 * @param {string} data.token - Session token
 * @param {object} data.user  - User data (email, name, role, etc.)
 * @param {boolean} keepLoggedIn - Whether to persist across browser restarts
 */
function saveSession(data, keepLoggedIn = false) {
  const storage = keepLoggedIn ? localStorage : sessionStorage;

  // Remember which storage type was used
  localStorage.setItem(STORAGE_KEYS.PERSISTENT, keepLoggedIn ? 'true' : 'false');

  storage.setItem(STORAGE_KEYS.TOKEN, data.token || '');
  storage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user || {}));
  storage.setItem(STORAGE_KEYS.LAST_HEARTBEAT, Date.now().toString());

  // Auth signal in localStorage so Navbar's storage-event listener gets notified
  // (sessionStorage changes don't fire window 'storage' events in the same tab)
  localStorage.setItem('hss_auth_state', JSON.stringify({ role: data.user?.role, name: data.user?.name, ts: Date.now() }));

  // Dispatch a custom event so same-tab listeners (Navbar) update immediately
  try { window.dispatchEvent(new CustomEvent('hss-auth-changed', { detail: { loggedIn: true } })); } catch (_) {}

  // Ensure device ID is set
  getDeviceId();
}

/**
 * Get the current session data.
 * @returns {{ token: string, user: object, deviceId: string } | null}
 */
function getSession() {
  const isPersistent = localStorage.getItem(STORAGE_KEYS.PERSISTENT) === 'true';
  const storage = isPersistent ? localStorage : sessionStorage;

  const token = storage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return null;

  let user = {};
  try {
    user = JSON.parse(storage.getItem(STORAGE_KEYS.USER) || '{}');
  } catch {
    user = {};
  }

  return {
    token,
    user,
    deviceId: getDeviceId(),
    isPersistent,
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

  const isPersistent = localStorage.getItem(STORAGE_KEYS.PERSISTENT) === 'true';
  const storage = isPersistent ? localStorage : sessionStorage;

  const updatedUser = { ...session.user, ...updates };
  storage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
}

/**
 * Clear all session data (logout).
 */
function clearSession() {
  // Clear from both storage types to be safe
  [localStorage, sessionStorage].forEach(storage => {
    storage.removeItem(STORAGE_KEYS.TOKEN);
    storage.removeItem(STORAGE_KEYS.USER);
    storage.removeItem(STORAGE_KEYS.LAST_HEARTBEAT);
  });
  localStorage.removeItem(STORAGE_KEYS.PERSISTENT);
  // Remove auth signal so Navbar knows the user logged out
  localStorage.removeItem('hss_auth_state');
  // Notify same-tab listeners immediately
  try { window.dispatchEvent(new CustomEvent('hss-auth-changed', { detail: { loggedIn: false } })); } catch (_) {}
  // Device ID is intentionally kept
}

// ---------------------------------------------------------------------------
// Heartbeat tracking
// ---------------------------------------------------------------------------

/**
 * Check if a heartbeat is due.
 * @returns {boolean}
 */
function isHeartbeatDue() {
  const isPersistent = localStorage.getItem(STORAGE_KEYS.PERSISTENT) === 'true';
  const storage = isPersistent ? localStorage : sessionStorage;

  const last = parseInt(storage.getItem(STORAGE_KEYS.LAST_HEARTBEAT) || '0', 10);
  return (Date.now() - last) > HEARTBEAT_INTERVAL_MS;
}

/**
 * Record that a heartbeat was just sent.
 */
function recordHeartbeat() {
  const isPersistent = localStorage.getItem(STORAGE_KEYS.PERSISTENT) === 'true';
  const storage = isPersistent ? localStorage : sessionStorage;
  storage.setItem(STORAGE_KEYS.LAST_HEARTBEAT, Date.now().toString());
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const sessionManager = {
  // Device ID
  getDeviceId,

  // Session CRUD
  saveSession,
  getSession,
  getToken,
  getUser,
  isLoggedIn,
  updateUser,
  clearSession,

  // Heartbeat
  isHeartbeatDue,
  recordHeartbeat,
  HEARTBEAT_INTERVAL_MS,
};

export default sessionManager;
