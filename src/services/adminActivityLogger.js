import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Log Admin Action into Firestore 'adminActivityLogs' and 'activityLogs'
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

    // Log to adminActivityLogs collection in Firestore
    await addDoc(collection(db, 'adminActivityLogs'), logEntry);
    
    // Mirror to activityLogs collection
    try {
      await addDoc(collection(db, 'activityLogs'), logEntry);
    } catch (e) {}

    return true;
  } catch (err) {
    console.warn('Failed to commit admin activity log to Firestore:', err);
    return false;
  }
}
