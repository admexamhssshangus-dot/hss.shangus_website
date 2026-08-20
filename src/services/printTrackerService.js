// =================================================================
// HSS SHANGUS — Application & Certificate Print Tracker Service
// Records print events per application/student with a strict 3-recent limit
// =================================================================

import { logAdminActivity } from './adminActivityLogger';

const STORAGE_PRINT_REGISTRY_KEY = 'hss_application_print_registry';
const STORAGE_PREFIX_APP_HISTORY = 'hss_app_print_history_';

/**
 * Extract a normalized, deterministic application key from student or application data
 */
export function extractApplicationKey(data) {
  if (!data) return 'UNKNOWN';
  if (typeof data === 'string' || typeof data === 'number') return String(data).trim();

  const raw = data.raw || data;
  const key = raw['Form Number'] ||
              raw['FormNo'] ||
              raw['formNo'] ||
              raw['Application No'] ||
              raw['Registration No'] ||
              raw['Registration No.'] ||
              raw['regNo'] ||
              raw['Roll No'] ||
              raw['Roll No.'] ||
              raw['rollNo'] ||
              raw['id'] ||
              raw['refNo'] ||
              raw['certificateNo'] ||
              'UNKNOWN';

  return String(key).trim();
}

/**
 * Record a print/export event for an application or certificate.
 * If multiple prints are made for the same application, retains only the 3 most recent records.
 *
 * @param {object|string} appOrStudent
 * @param {string} [docType='Admission Form']
 * @param {string} [actionType='Printed / Saved PDF']
 * @param {object} [extraMeta={}]
 * @returns {Array<object>} The updated array of up to 3 print history records
 */
export function recordApplicationPrint(appOrStudent, docType = 'Admission Form', actionType = 'Printed / Saved PDF', extraMeta = {}) {
  try {
    const raw = appOrStudent?.raw || appOrStudent || {};
    const appId = extractApplicationKey(appOrStudent);
    if (!appId || appId === 'UNKNOWN') return [];

    const studentName = String(
      raw["Student's Name (as per school records)"] ||
      raw["Student's Name"] ||
      raw['studentName'] ||
      raw['name'] ||
      extraMeta.studentName ||
      'Student'
    ).trim();

    const fatherName = String(
      raw["Father's/Guardian's Name (as per school records)"] ||
      raw["Father's Name"] ||
      raw['fatherName'] ||
      extraMeta.fatherName ||
      '—'
    ).trim();

    const className = String(
      raw['Admission sought for class'] ||
      raw['Class'] ||
      raw['class'] ||
      raw['className'] ||
      extraMeta.className ||
      '—'
    ).trim();

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const newRecord = {
      id: `prnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      appId,
      studentName,
      fatherName,
      className,
      docType: String(docType || 'Admission Form').trim(),
      actionType: String(actionType || 'Printed / Saved PDF').trim(),
      refNo: String(extraMeta.refNo || raw.refNo || raw.certificateNo || appId).trim(),
      timestamp: Date.now(),
      printedAt: formattedDate,
      extra: extraMeta
    };

    // 1. Update Per-Application Print History (Retain strictly 3 most recent)
    const historyKey = `${STORAGE_PREFIX_APP_HISTORY}${appId}`;
    let existingHistory = [];
    try {
      const stored = localStorage.getItem(historyKey);
      if (stored) {
        existingHistory = JSON.parse(stored) || [];
      }
    } catch (_) {}

    // Prepend new record and keep max 3
    const updatedHistory = [newRecord, ...existingHistory.filter(r => r.id !== newRecord.id)].slice(0, 3);
    try {
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    } catch (e) {
      console.warn('Failed to save per-app print history to localStorage:', e);
    }

    // 2. Update Central Applications Registry
    try {
      const regRaw = localStorage.getItem(STORAGE_PRINT_REGISTRY_KEY);
      const registry = regRaw ? JSON.parse(regRaw) : {};

      registry[appId] = {
        appId,
        studentName,
        fatherName,
        className,
        lastDocType: newRecord.docType,
        lastActionType: newRecord.actionType,
        lastPrintedAt: formattedDate,
        lastTimestamp: Date.now(),
        totalPrintCount: (registry[appId]?.totalPrintCount || existingHistory.length) + 1,
        recentPrints: updatedHistory
      };

      localStorage.setItem(STORAGE_PRINT_REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      console.warn('Failed to update print registry in localStorage:', e);
    }

    // 3. Log to Admin Activity Logger
    try {
      logAdminActivity({
        actionType: 'print',
        actionTitle: `Printed ${docType}`,
        details: `Printed ${docType} for Form/App #${appId} (${studentName}, Class ${className})`,
        reasonCategory: 'Document Generation',
        metadata: {
          appId,
          studentName,
          docType,
          actionType
        }
      });
    } catch (_) {}

    // 4. Dispatch Event for Live UI Reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hss-application-printed', {
        detail: {
          appId,
          studentName,
          docType,
          records: updatedHistory
        }
      }));
    }

    return updatedHistory;
  } catch (err) {
    console.error('recordApplicationPrint error:', err);
    return [];
  }
}

/**
 * Retrieve the recent print history for a specific application (max 3 entries)
 *
 * @param {string|object} appOrId
 * @returns {Array<object>} Up to 3 recent print records
 */
export function getApplicationPrintHistory(appOrId) {
  const appId = extractApplicationKey(appOrId);
  if (!appId || appId === 'UNKNOWN') return [];

  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX_APP_HISTORY}${appId}`);
    if (stored) {
      const list = JSON.parse(stored) || [];
      return list.slice(0, 3);
    }
  } catch (e) {
    console.warn('Error reading application print history:', e);
  }
  return [];
}

/**
 * Check whether an application has been printed
 *
 * @param {string|object} appOrId
 * @returns {{ printed: boolean, count: number, lastPrintedAt: string|null, recent: Array<object> }}
 */
export function getApplicationPrintStatus(appOrId) {
  const history = getApplicationPrintHistory(appOrId);
  if (history && history.length > 0) {
    return {
      printed: true,
      count: history.length,
      lastPrintedAt: history[0]?.printedAt || null,
      recent: history
    };
  }
  return {
    printed: false,
    count: 0,
    lastPrintedAt: null,
    recent: []
  };
}

/**
 * Get all tracked applications from the central print registry
 *
 * @returns {Array<object>}
 */
export function getAllPrintedApplications() {
  try {
    const raw = localStorage.getItem(STORAGE_PRINT_REGISTRY_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) || {};
    return Object.values(map).sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
  } catch (e) {
    console.warn('Error fetching all printed applications:', e);
    return [];
  }
}

/**
 * Clear print history for a specific application
 */
export function clearApplicationPrintHistory(appOrId) {
  const appId = extractApplicationKey(appOrId);
  if (!appId || appId === 'UNKNOWN') return;

  try {
    localStorage.removeItem(`${STORAGE_PREFIX_APP_HISTORY}${appId}`);
    const regRaw = localStorage.getItem(STORAGE_PRINT_REGISTRY_KEY);
    if (regRaw) {
      const registry = JSON.parse(regRaw) || {};
      delete registry[appId];
      localStorage.setItem(STORAGE_PRINT_REGISTRY_KEY, JSON.stringify(registry));
    }
    window.dispatchEvent(new CustomEvent('hss-application-printed', { detail: { appId, cleared: true } }));
  } catch (e) {
    console.warn('Error clearing application print history:', e);
  }
}
