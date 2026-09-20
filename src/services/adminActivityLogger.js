import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Resolve the current actor from browser session, active Firebase Auth, and storage.
 * All administrative school activities default strictly to Super Admin (adm.exam.hss.shangus@gmail.com).
 */
function resolveCurrentActor(explicitActor = {}) {
  let actorType = explicitActor.actorType || null;
  let actorEmail = explicitActor.actorEmail || null;
  let actorName = explicitActor.actorName || null;
  let actorRole = explicitActor.actorRole || null;
  let actorUid = explicitActor.actorUid || null;

  // 1. Check Active Firebase Auth (Highest Authority)
  try {
    const fbUser = auth?.currentUser;
    if (fbUser && fbUser.email) {
      const fbEmail = fbUser.email.toLowerCase().trim();
      actorEmail = actorEmail || fbEmail;
      actorName = actorName || fbUser.displayName || (fbEmail.includes('admin') ? 'Admin' : 'Administrator');
      actorUid = actorUid || fbUser.uid || '';
      if (
        fbEmail.includes('admin') || 
        fbEmail.includes('adm.exam.hss.shangus') || 
        fbEmail.includes('ghssshangus')
      ) {
        actorType = actorType || 'admin';
        actorRole = actorRole || 'Super Admin';
      }
    }
  } catch (_) {}

  // 2. Check Primary Portal User Session (sessionManager & legacy admin storage)
  try {
    const portalUser = JSON.parse(
      sessionStorage.getItem('hss_session_user') || 
      localStorage.getItem('hss_session_user') || 
      sessionStorage.getItem('adminUser') || 
      localStorage.getItem('adminUser') || 
      sessionStorage.getItem('hss_admin_user') || 
      localStorage.getItem('hss_admin_user') || 
      '{}'
    );
    if (portalUser.email) {
      const rLower = String(portalUser.role || '').toLowerCase();
      if (rLower.includes('admin') || rLower.includes('super')) {
        actorType = actorType || 'admin';
        actorRole = actorRole || 'Super Admin';
      } else if (rLower.includes('teacher') || rLower.includes('faculty')) {
        actorType = actorType || 'teacher';
        actorRole = actorRole || 'Teacher';
      } else if (rLower.includes('student')) {
        actorType = actorType || 'student';
        actorRole = actorRole || 'Student';
      } else {
        actorType = actorType || 'admin';
        actorRole = actorRole || 'Admin';
      }
      actorEmail = actorEmail || portalUser.email;
      actorName = actorName || portalUser.name || portalUser.displayName || 'Admin';
      actorUid = actorUid || portalUser.uid || '';
    }
  } catch (_) {}

  // 3. Check Teacher session
  if (!actorEmail) {
    try {
      const teacherUser = JSON.parse(
        sessionStorage.getItem('hss_teacher_auth') || 
        sessionStorage.getItem('hss_teacher_user') || 
        localStorage.getItem('hss_teacher_user') || 
        '{}'
      );
      if (teacherUser.email) {
        actorType = actorType || 'teacher';
        actorEmail = actorEmail || teacherUser.email;
        actorName = actorName || teacherUser.name || teacherUser.displayName || 'Teacher / Faculty';
        actorRole = actorRole || teacherUser.role || 'Teacher';
        actorUid = actorUid || teacherUser.uid || '';
      }
    } catch (_) {}
  }

  // 4. Check Student session
  if (!actorEmail) {
    try {
      const studentUser = JSON.parse(
        sessionStorage.getItem('hss_student_auth') || 
        sessionStorage.getItem('student_user') || 
        localStorage.getItem('student_user') || 
        '{}'
      );
      if (studentUser.email || studentUser.formNo || studentUser.phone) {
        actorType = actorType || 'student';
        actorEmail = actorEmail || studentUser.email || `${studentUser.formNo || 'student'}@hss.student`;
        actorName = actorName || studentUser.name || studentUser.studentName || 'Student';
        actorRole = actorRole || 'Student';
        actorUid = actorUid || studentUser.uid || studentUser.formNo || '';
      }
    } catch (_) {}
  }

  // 5. Canonical Admin Fallback (all school administrative actions belong to Super Admin)
  return {
    actorType: actorType || 'admin',
    actorEmail: actorEmail || 'adm.exam.hss.shangus@gmail.com',
    actorName: actorName || 'Admin',
    actorRole: actorRole || 'Super Admin',
    actorUid: actorUid || ''
  };
}

/**
 * Universal Activity Logger.
 * Records tamper-proof audit trails for dispute resolution in Firestore `activityLogs`.
 * 
 * Supports:
 * - Object signature: logActivity({ actionType, actionTitle, details, ... })
 * - Legacy two-argument signature: logActivity('Action Title', 'Details')
 */
export async function logActivity(param1, param2, param3) {
  try {
    let config = {};

    if (typeof param1 === 'string') {
      config = {
        actionTitle: param1,
        details: typeof param2 === 'string' ? param2 : '',
        metadata: typeof param2 === 'object' ? param2 : (param3 || {})
      };
    } else if (param1 && typeof param1 === 'object') {
      config = { ...param1 };
    }

    const {
      actionType = 'update',
      actionTitle = 'Activity Logged',
      actionCategory = 'general',
      details = '',
      targetId = '',
      targetType = '',
      reasonCategory = 'Routine Action',
      customReason = '',
      metadata = {},
      actorType: explicitActorType,
      actorEmail: explicitActorEmail,
      actorName: explicitActorName,
      actorRole: explicitActorRole,
      actorUid: explicitActorUid
    } = config;

    const actor = resolveCurrentActor({
      actorType: explicitActorType,
      actorEmail: explicitActorEmail,
      actorName: explicitActorName,
      actorRole: explicitActorRole,
      actorUid: explicitActorUid
    });

    const now = new Date();
    const logEntry = {
      actionType,
      actionTitle,
      actionCategory: actionCategory || 'general',
      details: details || actionTitle,
      targetId: String(targetId || ''),
      targetType: String(targetType || ''),
      reasonCategory: reasonCategory || 'Routine Administration',
      customReason: customReason || '',
      actorType: actor.actorType,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      actorUid: actor.actorUid,
      timestamp: now.toISOString(),
      createdAt: serverTimestamp(),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      deviceInfo: {
        userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent || '').slice(0, 150) : '',
        platform: typeof navigator !== 'undefined' ? (navigator.platform || '') : ''
      }
    };

    // Store in local session buffer for instant local-audit UI feedback
    try {
      const recentLogs = JSON.parse(sessionStorage.getItem('hss_recent_admin_logs') || '[]');
      recentLogs.unshift(logEntry);
      sessionStorage.setItem('hss_recent_admin_logs', JSON.stringify(recentLogs.slice(0, 100)));
    } catch (_) {}

    // Persist to Firestore canonical immutable activityLogs collection
    try {
      await addDoc(collection(db, 'activityLogs'), logEntry);
    } catch (_) {}

    return true;
  } catch (err) {
    // Fail silently without breaking active UX workflows
    return false;
  }
}

/**
 * Backward-compatible alias for all existing admin activity calls throughout codebase
 */
export const logAdminActivity = logActivity;

/**
 * Specialized helper for Teacher actions (marks submission, attendance, evaluations)
 */
export async function logTeacherActivity({
  actionType = 'submit',
  actionTitle = 'Teacher Evaluation',
  details = '',
  subject = '',
  className = '',
  targetId = '',
  metadata = {}
}) {
  return logActivity({
    actionType,
    actionTitle,
    actionCategory: 'examinations',
    details,
    targetId: targetId || `${className}_${subject}`,
    targetType: 'award_roll',
    actorType: 'teacher',
    metadata: {
      subject,
      className,
      ...metadata
    }
  });
}

/**
 * Specialized helper for Student actions (admissions, upgrades, scorecard views)
 */
export async function logStudentActivity({
  actionType = 'submit',
  actionTitle = 'Student Application Action',
  details = '',
  formNo = '',
  className = '',
  metadata = {}
}) {
  return logActivity({
    actionType,
    actionTitle,
    actionCategory: 'admissions',
    details,
    targetId: formNo,
    targetType: 'admission_application',
    actorType: 'student',
    metadata: {
      formNo,
      className,
      ...metadata
    }
  });
}
