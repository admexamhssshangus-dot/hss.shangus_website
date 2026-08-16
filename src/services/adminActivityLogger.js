import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Log Admin Action into the canonical Firestore 'activityLogs' collection.
 * Tracks: actionType (delete/update/bulk_import/manual_entry/export/download/photo_upload/cell_clear)
 * who performed it, when, details, predefined reason, custom reason, and metadata.
 */
export async function logAdminActivity({
  actionType = 'update',
  actionTitle = 'Admin Activity',
  details = '',
  reasonCategory = 'Routine Administration',
  customReason = '',
  metadata = {}
}) {
  try {
    const adminUser = JSON.parse(sessionStorage.getItem('hss_admin_user') || localStorage.getItem('hss_admin_user') || '{}');
    const adminEmail = adminUser.email || 'adm.exam.hss.shangus@gmail.com';
    const adminName = adminUser.name || adminUser.displayName || 'Admin';

    const logEntry = {
      actionType,
      actionTitle,
      details,
      reasonCategory: reasonCategory || 'Routine Administration',
      customReason: customReason || '',
      adminEmail,
      adminName,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      metadata
    };

    // Also store in local session log buffer for instant admin UI audit
    try {
      const recentLogs = JSON.parse(sessionStorage.getItem('hss_recent_admin_logs') || '[]');
      recentLogs.unshift(logEntry);
      sessionStorage.setItem('hss_recent_admin_logs', JSON.stringify(recentLogs.slice(0, 100)));
    } catch (_) {}

    // Keep one canonical audit record. The previous mirror doubled writes and
    // storage while no screen consumed adminActivityLogs.
    try {
      await addDoc(collection(db, 'activityLogs'), logEntry);
    } catch (_) {}

    return true;
  } catch (err) {
    // Fail silently without clogging browser console
    return false;
  }
}
