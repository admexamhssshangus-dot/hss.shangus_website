import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  sendSignInLinkToEmail, 
  sendPasswordResetEmail, 
  getAuth, 
  createUserWithEmailAndPassword, 
  updatePassword, 
  updateEmail, 
  signOut as secondarySignOut 
} from 'firebase/auth';
import { staffCallable } from './staffCommand';
import { auth, db, firebaseConfig } from './firebase';
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
    perms: ['reports'] 
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
}

/**
 * Direct client-side and Spark-compatible staff management.
 */
export const incrementTeacherLoginCount = async () => 1;
export const recordTeacher2StepVerification = async () => {};

/**
 * Creates a unique one-time login handshake for cross-window / cross-device 2-step verification.
 * Runs 100% on the Spark plan by creating a Firestore document in `adminAuthHandshakes`.
 */
export async function createAdminLoginHandshake(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const handshakeDocId = 'hsk_' + cleanEmail.replace(/[^a-z0-9]/g, '_');

  // Check if an unexpired active pending handshake already exists for this admin
  try {
    const existingSnap = await getDoc(doc(db, 'adminAuthHandshakes', handshakeDocId));
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      const expiresAt = Number(data.expiresAt) || 0;
      if (data.status === 'pending' && expiresAt > Date.now()) {
        const remainingMs = expiresAt - Date.now();
        try {
          sessionStorage.setItem('hss_auth_handshake_id', handshakeDocId);
          localStorage.setItem('hss_pending_admin_login', JSON.stringify({ email: cleanEmail, handshakeId: handshakeDocId, ts: Date.now(), expiresAt }));
        } catch (_) {}
        return {
          handshakeId: handshakeDocId,
          isExisting: true,
          remainingMs,
          expiresAt,
          remainingMinutes: Math.ceil(remainingMs / 60000)
        };
      }
    }
  } catch (checkErr) {
    console.warn('Note checking existing active handshake:', checkErr);
  }

  // Otherwise, create a fresh handshake with strict 15-minute validity
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const handshakeData = {
    id: handshakeDocId,
    email: cleanEmail,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt, // 15 minutes validity
  };

  try {
    await setDoc(doc(db, 'adminAuthHandshakes', handshakeDocId), handshakeData);
  } catch (err) {
    console.warn('Error writing admin auth handshake document:', err);
  }

  try {
    sessionStorage.setItem('hss_auth_handshake_id', handshakeDocId);
    localStorage.setItem('hss_pending_admin_login', JSON.stringify({ email: cleanEmail, handshakeId: handshakeDocId, ts: Date.now(), expiresAt }));
  } catch (_) {}

  return {
    handshakeId: handshakeDocId,
    isExisting: false,
    remainingMs: 15 * 60 * 1000,
    expiresAt,
    remainingMinutes: 15
  };
}

/**
 * Approves a login handshake when the email verification link is opened.
 */
export async function approveAdminLoginHandshake(handshakeId, email, firebaseUser) {
  if (!handshakeId) return;
  const cleanEmail = String(email || '').trim().toLowerCase();
  const nowIso = new Date().toISOString();
  try {
    await setDoc(doc(db, 'adminAuthHandshakes', handshakeId), {
      status: 'approved',
      email: cleanEmail,
      verifiedAt: nowIso,
      uid: firebaseUser?.uid || null,
    }, { merge: true });
  } catch (err) {
    console.warn('Error approving admin auth handshake:', err);
  }

  const verificationPayload = {
    google2StepVerified: true,
    last2StepVerificationDate: nowIso,
    updatedAt: nowIso,
  };

  if (firebaseUser?.uid) {
    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), verificationPayload, { merge: true });
    } catch (_) {}
  }
  if (cleanEmail) {
    try {
      await setDoc(doc(db, 'users', cleanEmail), verificationPayload, { merge: true });
      localStorage.setItem('hss_admin_google_verified_' + cleanEmail, 'true');
    } catch (_) {}
  }
}

/**
 * Consumes / deletes a login handshake after successful sign-in.
 */
export async function consumeAdminLoginHandshake(handshakeId) {
  if (!handshakeId) return;
  try {
    await deleteDoc(doc(db, 'adminAuthHandshakes', handshakeId));
  } catch (_) {}
  try {
    sessionStorage.removeItem('hss_auth_handshake_id');
  } catch (_) {}
}

/**
 * Sends a native Firebase Auth email sign-in link to an Admin's email inbox.
 * Completely free, built into Firebase Authentication, and runs on the Spark plan.
 */
export async function sendAdminSignInVerificationLink(email, handshakeId = '') {
  const cleanEmail = String(email || '').trim().toLowerCase();
  let effectiveHandshake = handshakeId;
  if (!effectiveHandshake) {
    try {
      effectiveHandshake = sessionStorage.getItem('hss_auth_handshake_id') || '';
    } catch (_) {}
  }

  const actionCodeSettings = {
    url: `${window.location.origin}/portal/login?email_link_verify=1&admin_email=${encodeURIComponent(cleanEmail)}${effectiveHandshake ? `&handshake=${encodeURIComponent(effectiveHandshake)}` : ''}`,
    handleCodeInApp: true,
  };

  await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);

  try {
    localStorage.setItem('emailForSignIn', cleanEmail);
    localStorage.setItem('hss_pending_admin_login', JSON.stringify({ email: cleanEmail, handshakeId: effectiveHandshake, ts: Date.now() }));
  } catch (_) {}

  return { success: true, handshakeId: effectiveHandshake };
}

/**
 * Sends a password reset email to a staff member using native Firebase Auth.
 */
export async function sendStaffPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://hssshangus.in';
  await sendPasswordResetEmail(auth, cleanEmail, {
    url: `${origin}/portal/auth/action`,
    handleCodeInApp: false,
  });
  return { success: true, message: `✨ Password reset email successfully sent to ${cleanEmail}.` };
}

/**
 * Deletes or revokes a staff account.
 * Updates Firestore permissions and removes user documents directly.
 */
export async function deleteStaffAccount(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return { success: false };

  // 1. Remove from adminSettings/permissions
  try {
    const permDocRef = doc(db, 'adminSettings', 'permissions');
    const permSnap = await getDoc(permDocRef);
    if (permSnap.exists() && Array.isArray(permSnap.data().users)) {
      const filtered = permSnap.data().users.filter(u => String(u.email || '').trim().toLowerCase() !== cleanEmail);
      await setDoc(permDocRef, { users: filtered, updatedAt: new Date().toISOString() }, { merge: true });
      try {
        localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(filtered));
      } catch (_) {}
    }
  } catch (fsErr) {
    console.warn('Delete admin from permissions note:', fsErr);
  }

  // 2. Remove from users/{cleanEmail} and purge any matching users/{uid}
  try {
    await deleteDoc(doc(db, 'users', cleanEmail));
    const userQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const userSnaps = await getDocs(userQuery);
    for (const snap of userSnaps.docs) {
      await deleteDoc(snap.ref);
    }
  } catch (userErr) {
    console.warn('Purge user documents note:', userErr);
  }

  // 3. Optional background invocation to staff-command if backend is reachable
  try {
    staffCallable('manageStaffAccount')({ email: cleanEmail, action: 'deactivate' }).catch(() => {});
  } catch (_) {}

  clearStaffProfileCache(cleanEmail);
  return { success: true };
}

/**
 * Creates a staff account on the Spark plan.
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

  const cleanClasses = normalizeTeacherClasses(assignedClasses);

  const cleanSubjects = Array.isArray(assignedSubjects) && assignedSubjects.length > 0
    ? assignedSubjects.map(s => String(s || '').trim()).filter(Boolean)
    : (String(subject || '').trim() ? [String(subject).trim()] : []);
  const primarySubject = cleanSubjects.join(', ') || String(subject || '').trim();
  const isSuper = isSuperAdminEmail(cleanEmail);
  const strictRole = isSuper 
    ? ROLES.SUPER_ADMIN 
    : (String(role).toLowerCase() === 'teacher' ? ROLES.TEACHER : ROLES.STANDARD_ADMIN);
  const isStdAdmin = strictRole === ROLES.STANDARD_ADMIN;
  const isTeacher = strictRole === ROLES.TEACHER;

  const newAdminEntry = {
    name: cleanName,
    email: cleanEmail,
    role: strictRole,
    isAdmin: isSuper || isStdAdmin,
    isSuperAdmin: isSuper,
    isTeacher: isTeacher,
    isStudent: false,
    isStaff: true,
    designation: String(designation || '').trim(),
    perms: isSuper ? ['*'] : (isTeacher ? (perms.length ? perms : ['attendanceMgmt', 'practicals']) : perms),
    subject: isTeacher ? primarySubject : '',
    teachingSubject: isTeacher ? primarySubject : '',
    assignedSubjects: isTeacher ? cleanSubjects : [],
    assignedClasses: isTeacher ? cleanClasses : [],
    tierSubjects: isTeacher ? (tierSubjects || null) : null,
    classSubjectMap: isTeacher ? (classSubjectMap || null) : null,
    mobile: mobile.trim(),
    active: true,
  };

  // 1. If an initial password is provided (>= 6 chars), create the Firebase Auth account
  // using a temporary secondary app instance so the current active admin is not logged out!
  let createdAuthUid = null;
  if (password && password.length >= 6) {
    try {
      const secondaryAppName = `StaffCreationApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      createdAuthUid = userCredential.user.uid;
      await secondarySignOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp).catch(() => {});
    } catch (authErr) {
      if (authErr?.code === 'auth/email-already-in-use') {
        console.log('Account exists in Auth; updating credentials via backend callable...');
        try {
          await staffCallable('manageStaffAccount')({
            action: 'update',
            email: cleanEmail,
            oldEmail: cleanEmail,
            name: cleanName,
            role: strictRole,
            password,
            perms: newAdminEntry.perms,
            subject: isTeacher ? primarySubject : '',
            assignedSubjects: isTeacher ? cleanSubjects : [],
            assignedClasses: isTeacher ? cleanClasses : [],
            mobile
          });
        } catch (bErr) {
          console.warn('Backend password sync error for existing Auth account:', bErr?.message || bErr);
        }
      } else {
        console.warn('Direct Auth user creation note (may already exist in Auth):', authErr?.message || authErr);
      }
    }
  }

  // 2. Update adminSettings/permissions
  try {
    const permDocRef = doc(db, 'adminSettings', 'permissions');
    const permSnap = await getDoc(permDocRef);
    let users = permSnap.exists() && Array.isArray(permSnap.data().users) ? [...permSnap.data().users] : [];
    const idx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === cleanEmail);
    if (idx >= 0) {
      users[idx] = newAdminEntry;
    } else {
      users.push(newAdminEntry);
    }
    await setDoc(permDocRef, { users, updatedAt: new Date().toISOString() }, { merge: true });
    try {
      localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(users));
    } catch (_) {}
  } catch (err) {
    console.warn('Error saving to adminSettings/permissions:', err);
  }

  // 3. Update users/{cleanEmail}
  try {
    await setDoc(doc(db, 'users', cleanEmail), {
      ...newAdminEntry,
      uid: createdAuthUid || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving to users/{cleanEmail}:', err);
  }

  // 4. Also initialize users/{createdAuthUid} if UID is available
  if (createdAuthUid) {
    try {
      await setDoc(doc(db, 'users', createdAuthUid), {
        ...newAdminEntry,
        uid: createdAuthUid,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('Error saving to users/{uid}:', err);
    }
  }

  // 5. Send setup/reset link if requested (or if no password was provided)
  if (sendSetupEmail || !password) {
    try {
      const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://hssshangus.in';
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: `${origin}/portal/auth/action`,
        handleCodeInApp: false,
      });
    } catch (e) {
      console.warn('Password reset dispatch note:', e);
    }
  }

  clearStaffProfileCache(cleanEmail);
  return { 
    success: true, 
    email: cleanEmail,
    message: password 
      ? `Staff account for ${cleanName} created with login credentials!` 
      : `Staff account for ${cleanName} registered! Password setup link sent to ${cleanEmail}.`
  };
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

  const isSuper = isSuperAdminEmail(cleanNew);
  const strictRole = isSuper 
    ? ROLES.SUPER_ADMIN 
    : (String(role).toLowerCase() === 'teacher' ? ROLES.TEACHER : ROLES.STANDARD_ADMIN);
  const isStdAdmin = strictRole === ROLES.STANDARD_ADMIN;
  const isTeacher = strictRole === ROLES.TEACHER;

  const cleanClasses = isTeacher ? normalizeTeacherClasses(assignedClasses) : [];

  const cleanSubjects = isTeacher
    ? (Array.isArray(assignedSubjects) && assignedSubjects.length > 0
        ? assignedSubjects.map(s => String(s || '').trim()).filter(Boolean)
        : (subject ? String(subject).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []))
    : [];
  const primarySubject = cleanSubjects.join(', ') || String(subject || '').trim();

  const updatedEntry = {
    name: cleanName,
    email: cleanNew,
    role: strictRole,
    isAdmin: isSuper || isStdAdmin,
    isSuperAdmin: isSuper,
    isTeacher: isTeacher,
    isStudent: false,
    isStaff: true,
    designation: String(designation || '').trim(),
    perms: isSuper ? ['*'] : (isTeacher ? (perms.length ? perms : ['attendanceMgmt', 'practicals']) : perms),
    subject: isTeacher ? primarySubject : '',
    teachingSubject: isTeacher ? primarySubject : '',
    assignedSubjects: isTeacher ? cleanSubjects : [],
    assignedClasses: isTeacher ? cleanClasses : [],
    tierSubjects: isTeacher ? (tierSubjects || null) : null,
    classSubjectMap: isTeacher ? (classSubjectMap || null) : null,
    mobile: mobile.trim(),
    active: true,
  };

  // 1. Update adminSettings/permissions
  try {
    const permDocRef = doc(db, 'adminSettings', 'permissions');
    const permSnap = await getDoc(permDocRef);
    if (permSnap.exists() && Array.isArray(permSnap.data().users)) {
      let users = [...permSnap.data().users];
      const matchIdx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === cleanOld);
      if (matchIdx >= 0) {
        users[matchIdx] = updatedEntry;
      } else {
        users.push(updatedEntry);
      }
      await setDoc(permDocRef, { users, updatedAt: new Date().toISOString() }, { merge: true });
      try {
        localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(users));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Update permissions doc note:', err);
  }

  // 2. Update users/{cleanNew}
  try {
    await setDoc(doc(db, 'users', cleanNew), {
      ...updatedEntry,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    if (cleanOld !== cleanNew) {
      await deleteDoc(doc(db, 'users', cleanOld));
    }
  } catch (err) {
    console.warn('Update users document note:', err);
  }

  // 3. If password was set, update it in Firebase Auth so user can immediately log in
  let passwordUpdatedInAuth = false;
  if (password && password.length >= 6) {
    const isCurrentActiveUser = Boolean(
      auth.currentUser &&
      [cleanOld, cleanNew].includes(String(auth.currentUser.email || '').toLowerCase().trim())
    );

    // 3a. If the account being edited is the active logged-in user, update password directly via client SDK
    if (isCurrentActiveUser && auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, password);
        passwordUpdatedInAuth = true;
        console.log('Firebase Auth password updated directly for active user.');
      } catch (clientErr) {
        console.warn('Direct updatePassword note:', clientErr?.message || clientErr);
      }
      if (cleanOld !== cleanNew) {
        try {
          await updateEmail(auth.currentUser, cleanNew);
        } catch (_) {}
      }
    }

    // 3b. Call backend manageStaffAccount to update password for any staff/admin in Firebase Auth via Admin SDK
    try {
      await staffCallable('manageStaffAccount')({
        action: 'update',
        email: cleanNew,
        oldEmail: cleanOld,
        name: cleanName,
        role,
        password,
        perms: updatedEntry.perms,
        subject: primarySubject,
        assignedSubjects: cleanSubjects,
        assignedClasses: cleanClasses,
        mobile
      });
      passwordUpdatedInAuth = true;
      console.log('Firebase Auth password synchronized via backend manageStaffAccount.');
    } catch (backendErr) {
      console.warn('Backend manageStaffAccount update note:', backendErr?.message || backendErr);
    }

    // 3c. If account did not exist in Firebase Auth yet, provision it now
    if (!passwordUpdatedInAuth) {
      try {
        const secondaryAppName = `StaffUpdateApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, cleanNew, password);
        await secondarySignOut(secondaryAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
        passwordUpdatedInAuth = true;
      } catch (authErr) {
        if (authErr?.code === 'auth/email-already-in-use') {
          if (!isCurrentActiveUser) {
            sendResetEmail = true;
          }
        } else {
          console.warn('Secondary auth user update note:', authErr?.message || authErr);
        }
      }
    }
  }

  if (sendResetEmail) {
    try {
      const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://hssshangus.in';
      await sendPasswordResetEmail(auth, cleanNew, {
        url: `${origin}/portal/auth/action`,
        handleCodeInApp: false,
      });
    } catch (e) {
      console.warn('Password reset dispatch note:', e);
    }
  }

  clearStaffProfileCache(cleanOld);
  if (cleanOld !== cleanNew) {
    clearStaffProfileCache(cleanNew);
  }
  return { success: true, email: cleanNew };
}
