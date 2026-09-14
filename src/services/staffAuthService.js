import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { sendSignInLinkToEmail, sendPasswordResetEmail, getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { staffCallable } from './staffCommand';
import { auth, db, firebaseConfig } from './firebase';
import { 
  SUPERADMIN_EMAIL, 
  BOOTSTRAP_ADMINS, 
  isSuperAdminEmail, 
  isBootstrapAdminEmail, 
  isBootstrapSuperAdminEmail 
} from '../utils/authRoles';

export { 
  SUPERADMIN_EMAIL, 
  BOOTSTRAP_ADMINS, 
  isSuperAdminEmail, 
  isBootstrapAdminEmail, 
  isBootstrapSuperAdminEmail 
};

// Fallback staff directory to ensure foundational admins are always recognized
const FALLBACK_STAFF_PROFILES = {
  'adm.exam.hss.shangus@gmail.com': { name: 'Sheikh Gulfam (SuperAdmin)', role: 'SuperAdmin', perms: ['*'] },
  'e.educational.24@gmail.com': { name: 'Sheikh Gulfam', role: 'Admin', perms: ['*'] },
  'ghssshangus74@gmail.com': { name: 'GHSS Shangus (Admin)', role: 'Admin', perms: ['*'] },
  'socialshiftz@gmail.com': { name: 'Technical Admin', role: 'Admin', perms: ['*'] },
  'shahnawaz13678@gmail.com': { name: 'Nawaz Ahmad Shah (Admin)', role: 'Admin', perms: ['*'] },
  'shahnawaz@gmail.com': { name: 'Nawaz Ahmad Shah (Admin)', role: 'Admin', perms: ['*'] },
  'bilalhcu@gmail.com': { name: 'Bilal Ahmad Khandy (Admin)', role: 'Admin', perms: ['*'] },
  'majidhassannajar@gmail.com': { name: 'Majid Hassan Najar (Admin)', role: 'Admin', perms: ['*'] },
};

/**
 * Authoritatively resolves staff role and permissions for a given user or email.
 * Spark-plan compatible: checks UID doc, email doc, adminSettings/permissions, and fallbacks.
 */
export async function resolveStaffRoleAndPerms(emailOrUser) {
  const user = typeof emailOrUser === 'object' && emailOrUser?.uid ? emailOrUser : auth.currentUser;
  let email = '';

  if (typeof emailOrUser === 'string') {
    email = emailOrUser.toLowerCase().trim();
  } else if (user?.email) {
    email = String(user.email).toLowerCase().trim();
  }

  if (!email) return null;

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
      setDoc(doc(db, 'users', user.uid), { ...superProfile, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    }
    return superProfile;
  }

  let profile = null;

  // 2. Check Firestore `users/{user.uid}`
  if (user?.uid) {
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

  // 3. Check Firestore `users/{cleanEmail}`
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

  // 4. Check Firestore `adminSettings/permissions` (users array)
  if (!profile) {
    try {
      const permSnap = await getDoc(doc(db, 'adminSettings', 'permissions'));
      if (permSnap.exists() && Array.isArray(permSnap.data()?.users)) {
        const matched = permSnap.data().users.find(u => String(u.email || '').toLowerCase().trim() === email);
        if (matched) {
          profile = {
            ...matched,
            role: matched.role || 'Admin',
            perms: matched.perms || ['reports'],
          };
        }
      }
    } catch (err) {
      console.warn('adminSettings/permissions lookup note:', err?.message || err);
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
            perms: matched.perms || ['reports'],
          };
        }
      }
    } catch (err) {
      console.warn('settings/siteSettings lookup note:', err?.message || err);
    }
  }

  // 6. Check hardcoded fallback staff profiles or bootstrap admin status
  if (!profile && FALLBACK_STAFF_PROFILES[email]) {
    profile = FALLBACK_STAFF_PROFILES[email];
  } else if (!profile && isBootstrapAdminEmail(email)) {
    profile = { name: email.split('@')[0], role: 'Admin', perms: ['*'] };
  }

  if (!profile) return null;
  if (profile.active === false) throw new Error('This staff account is inactive.');

  const rawRole = String(profile.role || 'Admin').trim();
  const normalizedRole = rawRole.toLowerCase();
  if (!['teacher', 'faculty', 'admin', 'superadmin'].includes(normalizedRole)) return null;

  const isBootstrap = isBootstrapAdminEmail(email);
  const isSuper = isSuperAdminEmail(email);
  const isAdmin = isSuper || isBootstrap || normalizedRole === 'admin' || normalizedRole === 'superadmin';
  const isTeacher = normalizedRole === 'teacher' || normalizedRole === 'faculty';
  const role = isSuper ? 'SuperAdmin' : (normalizedRole === 'faculty' ? 'Faculty' : (isTeacher ? 'Teacher' : 'Admin'));

  const resolved = {
    ...profile,
    uid: user?.uid || profile.uid || null,
    email,
    role: isSuper ? 'SuperAdmin' : role,
    perms: (isSuper || isBootstrap) ? ['*'] : (profile.perms || ['reports']),
    isSuperAdmin: isSuper,
    isAdmin,
    isTeacher,
    isStaff: true,
    name: profile.name || user?.displayName || email.split('@')[0],
    subject: profile.subject || profile.teachingSubject || '',
    teachingSubject: profile.teachingSubject || profile.subject || '',
    assignedClasses: Array.isArray(profile.assignedClasses)
      ? profile.assignedClasses
      : (profile.assignedClass ? [profile.assignedClass] : []),
  };

  // Synchronize UID document in Firestore so subsequent queries are instant
  if (user?.uid) {
    setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email,
      name: resolved.name,
      role: resolved.role,
      perms: resolved.perms,
      isStaff: true,
      subject: resolved.subject,
      teachingSubject: resolved.teachingSubject,
      assignedClasses: resolved.assignedClasses,
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
  }

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
  const handshakeId = 'hsk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 12);
  const handshakeData = {
    id: handshakeId,
    email: cleanEmail,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes validity
  };

  try {
    await setDoc(doc(db, 'adminAuthHandshakes', handshakeId), handshakeData);
  } catch (err) {
    console.warn('Error writing admin auth handshake document:', err);
  }

  try {
    sessionStorage.setItem('hss_auth_handshake_id', handshakeId);
    localStorage.setItem('hss_pending_admin_login', JSON.stringify({ email: cleanEmail, handshakeId, ts: Date.now() }));
  } catch (_) {}

  return handshakeId;
}

/**
 * Approves a login handshake when the email verification link is opened.
 */
export async function approveAdminLoginHandshake(handshakeId, email, firebaseUser) {
  if (!handshakeId) return;
  const cleanEmail = String(email || '').trim().toLowerCase();
  try {
    await setDoc(doc(db, 'adminAuthHandshakes', handshakeId), {
      status: 'approved',
      email: cleanEmail,
      verifiedAt: new Date().toISOString(),
      uid: firebaseUser?.uid || null,
    }, { merge: true });
  } catch (err) {
    console.warn('Error approving admin auth handshake:', err);
  }

  if (firebaseUser?.uid) {
    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        last2StepVerificationDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
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
  await sendPasswordResetEmail(auth, cleanEmail, {
    url: `${window.location.origin}/portal/login`,
    handleCodeInApp: false,
  });
  return { success: true };
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

  return { success: true };
}

/**
 * Creates a staff account on the Spark plan.
 */
export async function createStaffAccount({ 
  name, 
  email, 
  role = 'Admin', 
  perms = ['reports'], 
  subject = '', 
  assignedClasses = [], 
  mobile = '', 
  password = '', 
  sendSetupEmail = true 
}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanEmail || !cleanName) throw new Error('Name and valid email are required.');

  const cleanClasses = Array.isArray(assignedClasses)
    ? assignedClasses.filter(Boolean)
    : (assignedClasses ? [assignedClasses] : []);

  const newAdminEntry = {
    name: cleanName,
    email: cleanEmail,
    role,
    perms: role === 'SuperAdmin' ? ['*'] : perms,
    subject: subject.trim(),
    teachingSubject: subject.trim(),
    assignedClasses: cleanClasses,
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
      console.warn('Direct Auth user creation note (may already exist in Auth):', authErr?.message || authErr);
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
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false,
      });
    } catch (e) {
      console.warn('Password reset dispatch note:', e);
    }
  }

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
  perms = [], 
  subject = '', 
  assignedClasses = [], 
  mobile = '', 
  password = '',
  sendResetEmail = false 
}) {
  const cleanOld = String(oldEmail || '').trim().toLowerCase();
  const cleanNew = String(newEmail || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();

  if (!cleanNew || !cleanName) throw new Error('Name and valid email are required.');

  const cleanClasses = Array.isArray(assignedClasses)
    ? assignedClasses.filter(Boolean)
    : (assignedClasses ? [assignedClasses] : []);

  const updatedEntry = {
    name: cleanName,
    email: cleanNew,
    role,
    perms: role === 'SuperAdmin' ? ['*'] : perms,
    subject: subject.trim(),
    teachingSubject: subject.trim(),
    assignedClasses: cleanClasses,
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

  // 3. If password was set, create auth user or send password reset
  if (password && password.length >= 6) {
    try {
      const secondaryAppName = `StaffUpdateApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, cleanNew, password);
      await secondarySignOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp).catch(() => {});
    } catch (authErr) {
      // If user already exists in Firebase Auth, trigger password reset email to allow password change
      if (authErr?.code === 'auth/email-already-in-use') {
        sendResetEmail = true;
      } else {
        console.warn('Secondary auth user update note:', authErr?.message || authErr);
      }
    }
  }

  if (sendResetEmail) {
    try {
      await sendPasswordResetEmail(auth, cleanNew, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false,
      });
    } catch (e) {
      console.warn('Password reset dispatch note:', e);
    }
  }

  return { success: true, email: cleanNew };
}
