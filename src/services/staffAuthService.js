import { doc, getDoc, setDoc } from 'firebase/firestore';
import { staffCallable } from './staffCommand';
import { auth, db } from './firebase';
import { 
  ROLES,
  SUPERADMIN_EMAIL, 
  BOOTSTRAP_ADMINS, 
  isSuperAdminEmail, 
  isStandardAdminEmail,
  isBootstrapAdminEmail, 
  isBootstrapSuperAdminEmail,
  getStrictCanonicalRole,
  enforceStrictRoleAttributes
} from '../utils/authRoles';
import { normalizeTeacherClasses } from '../utils/practicalsSettingsManager';

export { 
  ROLES,
  SUPERADMIN_EMAIL, 
  BOOTSTRAP_ADMINS, 
  isSuperAdminEmail, 
  isStandardAdminEmail,
  isBootstrapAdminEmail, 
  isBootstrapSuperAdminEmail,
  getStrictCanonicalRole,
  enforceStrictRoleAttributes
};

// Fallback staff directory to ensure foundational staff are always recognized with EXACTLY ONE STRICT ROLE
export const FALLBACK_STAFF_PROFILES = {
  'adm.exam.hss.shangus@gmail.com': { 
    name: 'Sheikh Gulfam (SuperAdmin)', 
    role: 'SuperAdmin', 
    isSuperAdmin: true, 
    isAdmin: true, 
    isTeacher: false, 
    isStudent: false, 
    isStaff: true, 
    perms: ['*'] 
  },
  'e.educational.24@gmail.com': { 
    name: 'Sheikh Gulfam', 
    role: 'Admin', 
    isAdmin: true, 
    isSuperAdmin: false, 
    isTeacher: false, 
    isStudent: false, 
    isStaff: true, 
    perms: ['reports'] 
  },
  'ghssshangus74@gmail.com': { 
    name: 'GHSS Shangus (Admin)', 
    role: 'Admin', 
    isAdmin: true, 
    isSuperAdmin: false, 
    isTeacher: false, 
    isStudent: false, 
    isStaff: true, 
    perms: ['reports'] 
  },
  'socialshiftz@gmail.com': { 
    name: 'Sheikh Gulfam', 
    role: 'Teacher', 
    isTeacher: true, 
    isAdmin: false, 
    isSuperAdmin: false, 
    isStudent: false, 
    isStaff: true, 
    subject: 'Botany',
    teachingSubject: 'Botany',
    assignedClasses: ['11th', '12th'],
    perms: ['attendanceMgmt', 'practicals'] 
  },
  'shahnawaz13678@gmail.com': { 
    name: 'Nawaz Ahmad Shah (Admin)', 
    role: 'Admin', 
    isAdmin: true, 
    isSuperAdmin: false, 
    isTeacher: false, 
    isStudent: false, 
    isStaff: true, 
    perms: ['reports'] 
  },
  'shahnawaz@gmail.com': { 
    name: 'Nawaz Ahmad Shah (Admin)', 
    role: 'Admin', 
    isAdmin: true, 
    isSuperAdmin: false, 
    isTeacher: false, 
    isStudent: false, 
    isStaff: true, 
    perms: ['reports'] 
  },
  'bilalhcu@gmail.com': { 
    name: 'Bilal Ahmad Khandy (Admin)', 
    role: 'Admin', 
    isAdmin: true, 
    isSuperAdmin: false, 
    isTeacher: false, 
    isStudent: false, 
    isStaff: true, 
    perms: [
      'reports', 'admRegisterSuite', 'analyticsReports', 'directEntry', 'customRoster',
      'officialLetter', 'certStudio', 'idCards', 'gkTest', 'controls', 'curriculum',
      'practicals', 'attendanceMgmt', 'rollNo', 'mergeStudio', 'automations', 'funds',
      'accounts', 'cms', 'boardSync', 'activityAudit', 'googleContacts', 'staff',
      'quickCellEdit', 'bulkToolsAction'
    ]
  },
  'majidhassannajar@gmail.com': { 
    name: 'Majid Hassan Najar (Admin)', 
    role: 'Admin', 
    isAdmin: true, 
    isSuperAdmin: false, 
    isTeacher: false, 
    isStudent: false, 
    isStaff: true, 
    perms: ['reports'] 
  },
  'hajimir91@gmail.com': {
    name: 'Javid Ahmad',
    role: 'Teacher',
    isTeacher: true,
    isAdmin: false,
    isSuperAdmin: false,
    isStudent: false,
    isStaff: true,
    subject: 'Physical Education (PD)',
    teachingSubject: 'Physical Education (PD)',
    assignedClasses: ['11th', '12th'],
    perms: ['attendanceMgmt', 'practicals']
  },
};

// High-speed in-memory cache for resolved staff profiles (0ms resolution across navigations)
const staffProfileMemoryCache = new Map();
const STAFF_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function clearStaffProfileCache(email = null) {
  if (email) {
    const clean = String(email).toLowerCase().trim();
    staffProfileMemoryCache.delete(clean);
    try {
      sessionStorage.removeItem(`hss_staff_profile_${clean}`);
    } catch (_) {}
  } else {
    staffProfileMemoryCache.clear();
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('hss_staff_profile_')) sessionStorage.removeItem(k);
      });
    } catch (_) {}
  }
}

/**
 * Authoritatively resolves staff role and permissions for a given user or email.
 * Spark-plan compatible: checks UID doc, email doc, adminSettings/permissions, and fallbacks.
 */
export async function resolveStaffRoleAndPerms(emailOrUser, forceFresh = false) {
  const user = typeof emailOrUser === 'object' && emailOrUser?.uid ? emailOrUser : auth.currentUser;
  let email = '';

  if (typeof emailOrUser === 'string') {
    email = emailOrUser.toLowerCase().trim();
  } else if (user?.email) {
    email = String(user.email).toLowerCase().trim();
  }

  if (!email) return null;

  // 0. Check high-speed in-memory or sessionStorage cache (0ms instant return)
  if (!forceFresh) {
    const memCached = staffProfileMemoryCache.get(email);
    if (memCached && (Date.now() - memCached.cachedAt < STAFF_CACHE_TTL_MS)) {
      return memCached.profile;
    }
    try {
      const rawSession = sessionStorage.getItem(`hss_staff_profile_${email}`);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed && (Date.now() - parsed.cachedAt < STAFF_CACHE_TTL_MS)) {
          staffProfileMemoryCache.set(email, parsed);
          return parsed.profile;
        }
      }
    } catch (_) {}
  }

  // 1. Master Super Admin check (immediate & immune to database errors)
  if (isSuperAdminEmail(email)) {
    const superProfile = {
      uid: user?.uid || null,
      email,
      name: user?.displayName || 'Super Admin',
      role: 'SuperAdmin',
      perms: ['*'],
      isSuperAdmin: true,
      isAdmin: true,
      isTeacher: false,
      isStaff: true,
    };
    if (user?.uid) {
      const syncKey = `hss_uid_synced_${user.uid}`;
      try {
        if (!sessionStorage.getItem(syncKey)) {
          sessionStorage.setItem(syncKey, '1');
          setDoc(doc(db, 'users', user.uid), { ...superProfile, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
        }
      } catch (_) {}
    }
    staffProfileMemoryCache.set(email, { profile: superProfile, cachedAt: Date.now() });
    try {
      sessionStorage.setItem(`hss_staff_profile_${email}`, JSON.stringify({ profile: superProfile, cachedAt: Date.now() }));
    } catch (_) {}
    return superProfile;
  }

  let profile = null;

  // 2. Check Firestore `adminSettings/permissions` (Primary Single Source of Truth managed by SuperAdmin)
  try {
    const permSnap = await getDoc(doc(db, 'adminSettings', 'permissions'));
    if (permSnap.exists() && Array.isArray(permSnap.data()?.users)) {
      const matched = permSnap.data().users.find(u => String(u.email || '').toLowerCase().trim() === email);
      if (matched) {
        profile = {
          ...matched,
          role: matched.role || 'Admin',
          perms: Array.isArray(matched.perms) ? matched.perms : ['reports'],
        };
      }
    }
  } catch (err) {
    console.warn('adminSettings/permissions lookup note:', err?.message || err);
  }

  // 3. Check Firestore `users/{cleanEmail}` (Direct staff profile synchronized by SuperAdmin)
  if (!profile) {
    try {
      const emailSnap = await getDoc(doc(db, 'users', email));
      if (emailSnap.exists()) {
        const data = emailSnap.data();
        const rLower = String(data.role || '').toLowerCase().trim();
        if (rLower && ['teacher', 'faculty', 'admin', 'superadmin'].includes(rLower)) {
          profile = data;
        }
      }
    } catch (err) {
      console.warn('users/{email} lookup note:', err?.message || err);
    }
  }

  // 4. Check Firestore `users/{user.uid}` (Fallback for existing accounts not indexed by email)
  if (!profile && user?.uid) {
    try {
      const uidSnap = await getDoc(doc(db, 'users', user.uid));
      if (uidSnap.exists()) {
        const data = uidSnap.data();
        const rLower = String(data.role || '').toLowerCase().trim();
        if (rLower && ['teacher', 'faculty', 'admin', 'superadmin'].includes(rLower)) {
          profile = data;
        }
      }
    } catch (err) {
      console.warn('users/{uid} lookup note:', err?.message || err);
    }
  }

  // 5. Check Firestore `settings/siteSettings` (adminUsers array)
  if (!profile) {
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'siteSettings'));
      if (settingsSnap.exists() && Array.isArray(settingsSnap.data()?.adminUsers)) {
        const matched = settingsSnap.data().adminUsers.find(u => String(u.email || '').toLowerCase().trim() === email);
        if (matched) {
          profile = {
            ...matched,
            role: matched.role || 'Admin',
            perms: Array.isArray(matched.perms) ? matched.perms : ['reports'],
          };
        }
      }
    } catch (err) {
      console.warn('settings/siteSettings lookup note:', err?.message || err);
    }
  }

  // 6. Check Local Storage fallback `hss_admin_users_permissions_v1`
  if (!profile) {
    try {
      const cached = localStorage.getItem('hss_admin_users_permissions_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const matched = parsed.find(u => String(u.email || '').toLowerCase().trim() === email);
          if (matched) {
            profile = {
              ...matched,
              role: matched.role || 'Admin',
              perms: Array.isArray(matched.perms) ? matched.perms : ['reports'],
            };
          }
        }
      }
    } catch (_) {}
  }

  // 7. Check hardcoded fallback staff profiles or bootstrap admin status
  if (!profile && FALLBACK_STAFF_PROFILES[email]) {
    profile = FALLBACK_STAFF_PROFILES[email];
  } else if (!profile && isBootstrapAdminEmail(email)) {
    profile = { name: email.split('@')[0], role: 'Admin', perms: ['reports'] };
  }

  if (!profile) return null;
  if (profile.active === false) throw new Error('This staff account is inactive.');

  // Strict Institutional Rule: EXACTLY ONE STRICT ROLE per email
  // (SuperAdmin, Admin, Teacher, Student)
  const strictRole = getStrictCanonicalRole(email, profile);
  if (![ROLES.SUPER_ADMIN, ROLES.STANDARD_ADMIN, ROLES.TEACHER].includes(strictRole)) {
    return null;
  }

  const isSuper = strictRole === ROLES.SUPER_ADMIN;
  const isTeacher = strictRole === ROLES.TEACHER;

  const cleanClasses = isTeacher
    ? normalizeTeacherClasses(
        Array.isArray(profile.assignedClasses)
          ? profile.assignedClasses
          : (profile.assignedClass ? [profile.assignedClass] : [])
      )
    : [];

  const cleanSubjects = isTeacher
    ? (Array.isArray(profile.assignedSubjects) && profile.assignedSubjects.length > 0
        ? profile.assignedSubjects
        : (profile.subject || profile.teachingSubject || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean))
    : [];

  const resolved = enforceStrictRoleAttributes({
    ...profile,
    uid: user?.uid || profile.uid || null,
    email,
    role: strictRole,
    perms: isSuper
      ? ['*']
      : (Array.isArray(profile.perms) ? profile.perms : (isTeacher ? ['attendanceMgmt', 'practicals'] : ['reports'])),
    name: profile.name || user?.displayName || email.split('@')[0],
    subject: isTeacher ? (cleanSubjects.join(', ') || profile.subject || profile.teachingSubject || '') : '',
    teachingSubject: isTeacher ? (cleanSubjects.join(', ') || profile.teachingSubject || profile.subject || '') : '',
    assignedSubjects: cleanSubjects,
    assignedClasses: cleanClasses,
    classSubjectMap: isTeacher ? (profile.classSubjectMap || null) : null,
    tierSubjects: isTeacher ? (profile.tierSubjects || null) : null,
    google2StepVerified: Boolean(profile.google2StepVerified),
    last2StepVerificationDate: profile.last2StepVerificationDate || null,
  });

  // Synchronize UID document in Firestore if not already synchronized in this session
  if (user?.uid) {
    const syncKey = `hss_uid_synced_${user.uid}_${email}`;
    try {
      if (!sessionStorage.getItem(syncKey)) {
        sessionStorage.setItem(syncKey, '1');
        setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email,
          name: resolved.name,
          role: resolved.role,
          perms: resolved.perms,
          isStaff: true,
          isTeacher: resolved.isTeacher,
          isAdmin: resolved.isAdmin,
          isSuperAdmin: resolved.isSuperAdmin,
          isStudent: false,
          subject: resolved.subject,
          teachingSubject: resolved.teachingSubject,
          assignedSubjects: resolved.assignedSubjects,
          assignedClasses: resolved.assignedClasses,
          classSubjectMap: resolved.classSubjectMap,
          tierSubjects: resolved.tierSubjects,
          google2StepVerified: resolved.google2StepVerified,
          last2StepVerificationDate: resolved.last2StepVerificationDate,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});

        setDoc(doc(db, 'users', email), { uid: user.uid }, { merge: true }).catch(() => {});
      }
    } catch (_) {}
  }

  staffProfileMemoryCache.set(email, { profile: resolved, cachedAt: Date.now() });
  try {
    sessionStorage.setItem(`hss_staff_profile_${email}`, JSON.stringify({ profile: resolved, cachedAt: Date.now() }));
  } catch (_) {}

  return resolved;
}

/**
 * Validates that an active admin session exists.
 * Gracefully compatible with Spark plan: verifies active auth user and admin role.
 */
export async function requireVerifiedAdminSession(user = auth.currentUser) {
  if (!user) throw new Error('Please sign in again.');
  const profile = await resolveStaffRoleAndPerms(user);
  if (!profile?.isAdmin) {
    const error = new Error('Complete administrator verification to access this function.');
    error.code = 'staff/verification-required';
    throw error;
  }
  const token = await user.getIdTokenResult();
  const session = await getDoc(doc(db, 'adminSessions', user.uid));
  const data = session.exists() ? session.data() : null;
  const expiresAt = data?.expiresAt?.toMillis?.() ?? Number(data?.expiresAt || 0);
  if (!data || Number(data.authTime) !== Number(token.claims?.auth_time) || expiresAt <= Date.now()) {
    const error = new Error('Complete administrator email verification to access this function.');
    error.code = 'staff/verification-required';
    throw error;
  }
}

/**
 * Teacher login telemetry is maintained by the authenticated session workflow.
 */
export const incrementTeacherLoginCount = async () => 1;
export const recordTeacher2StepVerification = async () => {};

/**
 * Begins a server-managed, one-time administrator verification challenge.
 */
export async function createAdminLoginHandshake(email) {
  const signedInEmail = String(auth.currentUser?.email || '').trim().toLowerCase();
  const requestedEmail = String(email || '').trim().toLowerCase();
  if (!auth.currentUser || !signedInEmail || (requestedEmail && requestedEmail !== signedInEmail)) {
    throw new Error('Sign in with the administrator account before requesting verification.');
  }
  const result = await staffCallable('beginAdminVerification')({});
  const handshakeId = result?.data?.handshakeId || result?.handshakeId;
  if (!handshakeId) throw new Error('The secure verification service did not return a challenge.');
  const expiresAt = Date.now() + 10 * 60 * 1000;
  try {
    sessionStorage.setItem('hss_auth_handshake_id', handshakeId);
    localStorage.setItem('hss_pending_admin_login', JSON.stringify({ email: signedInEmail, handshakeId, ts: Date.now(), expiresAt }));
  } catch (_) {}
  return { handshakeId, expiresAt, remainingMs: 10 * 60 * 1000, remainingMinutes: 10, serverManaged: true };
}

/**
 * Approves a signed server challenge when its email proof is opened.
 */
export async function approveAdminLoginHandshake(handshakeId, proof) {
  if (!/^[a-zA-Z0-9]{20}$/.test(handshakeId || '') || !/^[a-zA-Z0-9_-]{43}$/.test(proof || '')) {
    throw new Error('Invalid or expired verification link. Request a fresh link from the sign-in screen.');
  }
  const result = await staffCallable('approveAdminVerification')({ handshakeId, proof });
  return result?.data || result;
}

/**
 * Cancels a pending server challenge when the requester abandons sign-in.
 */
export async function consumeAdminLoginHandshake(handshakeId) {
  if (!handshakeId) return { success: true };
  try {
    const result = await staffCallable('cancelAdminVerification')({ handshakeId });
    return result?.data || result;
  } finally {
    try { sessionStorage.removeItem('hss_auth_handshake_id'); } catch (_) {}
  }
}

/**
 * Kept as an explicit error for obsolete callers; email is sent by the server
 * while creating the challenge, never from the browser.
 */
export async function sendAdminSignInVerificationLink() {
  throw new Error('Verification links are dispatched only by the secure server challenge.');
}

/**
 * Sends a password reset only after the server verifies staff-management scope.
 */
export async function sendStaffPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('A staff email address is required.');
  const result = await staffCallable('manageStaffAccount')({ action: 'reset', email: cleanEmail });
  return result?.data || result;
}

/**
 * Deactivates a staff account through the authoritative server workflow.
 */
export async function deleteStaffAccount(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return { success: false };
  const result = await staffCallable('manageStaffAccount')({ action: 'deactivate', email: cleanEmail });
  clearStaffProfileCache(cleanEmail);
  return result?.data || result;
}

/**
 * Creates a staff account through the authoritative server workflow.
 */
export async function createStaffAccount({
  name,
  email,
  role = 'Admin',
  designation = '',
  perms = ['reports'],
  subject = '',
  assignedSubjects = [],
  assignedClasses = [],
  tierSubjects = null,
  classSubjectMap = null,
  mobile = '',
  password = '',
  sendSetupEmail = true
}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanEmail || !cleanName) throw new Error('Name and valid email are required.');
  const result = await staffCallable('manageStaffAccount')({
    action: 'create', name: cleanName, email: cleanEmail, role, designation,
    perms, subject, assignedSubjects, assignedClasses, tierSubjects,
    classSubjectMap, mobile, password, sendSetupEmail
  });
  clearStaffProfileCache(cleanEmail);
  return result?.data || result;
}

/**
 * Updates an existing staff account.
 */
export async function updateStaffAccount({
  oldEmail,
  newEmail,
  name,
  role = 'Admin',
  designation = '',
  perms = [],
  subject = '',
  assignedSubjects = [],
  assignedClasses = [],
  tierSubjects = null,
  classSubjectMap = null,
  mobile = '',
  password = '',
  sendResetEmail = false
}) {
  const cleanOld = String(oldEmail || '').trim().toLowerCase();
  const cleanNew = String(newEmail || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanNew || !cleanName) throw new Error('Name and valid email are required.');
  const result = await staffCallable('manageStaffAccount')({
    action: 'update', oldEmail: cleanOld, newEmail: cleanNew, name: cleanName,
    role, designation, perms, subject, assignedSubjects, assignedClasses,
    tierSubjects, classSubjectMap, mobile, password, sendResetEmail
  });
  clearStaffProfileCache(cleanOld);
  if (cleanOld !== cleanNew) clearStaffProfileCache(cleanNew);
  return result?.data || result;
}
