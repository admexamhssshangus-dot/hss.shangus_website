import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { sendSignInLinkToEmail, sendPasswordResetEmail } from 'firebase/auth';
import { staffCallable } from './staffCommand';
import { auth, db } from './firebase';
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

// Fallback staff directory to ensure foundational admins (like bilalhcu@gmail.com) are always recognized
const FALLBACK_STAFF_PROFILES = {
  'adm.exam.hss.shangus@gmail.com': { name: 'Sheikh Gulfam (SuperAdmin)', role: 'SuperAdmin', perms: ['*'] },
  'e.educational.24@gmail.com': { name: 'Sheikh Gulfam (SuperAdmin)', role: 'SuperAdmin', perms: ['*'] },
  'shahnawaz@gmail.com': { name: 'Nawaz Ahmad Shah (Admin)', role: 'Admin', perms: ['reports'] },
  'bilalhcu@gmail.com': { name: 'Bilal Ahmad Khandy', role: 'Admin', perms: ['reports'] },
  'majidhassannajar@gmail.com': { name: 'Majid Hassan Najar', role: 'Admin', perms: ['reports'] },
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
        if (data.role && ['Teacher', 'Faculty', 'Admin', 'SuperAdmin'].includes(data.role)) {
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
        if (data.role && ['Teacher', 'Faculty', 'Admin', 'SuperAdmin'].includes(data.role)) {
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

  // 6. Check hardcoded fallback staff profiles (e.g. bilalhcu@gmail.com)
  if (!profile && FALLBACK_STAFF_PROFILES[email]) {
    profile = FALLBACK_STAFF_PROFILES[email];
  }

  if (!profile) return null;
  if (profile.active === false) throw new Error('This staff account is inactive.');

  const role = profile.role || 'Admin';
  if (!['Teacher', 'Faculty', 'Admin', 'SuperAdmin'].includes(role)) return null;

  const isSuper = role === 'SuperAdmin' || isSuperAdminEmail(email);
  const isAdmin = isSuper || role === 'Admin';
  const isTeacher = role === 'Teacher' || role === 'Faculty';

  const resolved = {
    ...profile,
    uid: user?.uid || profile.uid || null,
    email,
    role: isSuper ? 'SuperAdmin' : role,
    perms: isSuper ? ['*'] : (profile.perms || ['reports']),
    isSuperAdmin: isSuper,
    isAdmin,
    isTeacher,
    isStaff: true,
    name: profile.name || user?.displayName || email.split('@')[0],
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
export async function createStaffAccount({ name, email, role = 'Admin', perms = ['reports'], subject = '', mobile = '', sendSetupEmail = true }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanEmail || !cleanName) throw new Error('Name and valid email are required.');

  const newAdminEntry = {
    name: cleanName,
    email: cleanEmail,
    role,
    perms: role === 'SuperAdmin' ? ['*'] : perms,
    subject: subject.trim(),
    mobile: mobile.trim(),
  };

  // 1. Update adminSettings/permissions
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
  } catch (err) {
    console.warn('Error saving to adminSettings/permissions:', err);
  }

  // 2. Update users/{cleanEmail}
  try {
    await setDoc(doc(db, 'users', cleanEmail), {
      ...newAdminEntry,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving to users/{cleanEmail}:', err);
  }

  // 3. Send setup/reset link if requested
  if (sendSetupEmail) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false,
      });
    } catch (e) {
      console.warn('Password reset dispatch note:', e);
    }
  }

  return { success: true, email: cleanEmail };
}

/**
 * Updates an existing staff account.
 */
export async function updateStaffAccount({ oldEmail, newEmail, name, role = 'Admin', perms = [], subject = '', mobile = '', sendResetEmail = false }) {
  const cleanOld = String(oldEmail || '').trim().toLowerCase();
  const cleanNew = String(newEmail || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();

  if (!cleanNew || !cleanName) throw new Error('Name and valid email are required.');

  // 1. Update adminSettings/permissions
  try {
    const permDocRef = doc(db, 'adminSettings', 'permissions');
    const permSnap = await getDoc(permDocRef);
    if (permSnap.exists() && Array.isArray(permSnap.data().users)) {
      let users = [...permSnap.data().users];
      const matchIdx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === cleanOld);
      const updatedEntry = {
        name: cleanName,
        email: cleanNew,
        role,
        perms: role === 'SuperAdmin' ? ['*'] : perms,
        subject: subject.trim(),
        mobile: mobile.trim(),
      };
      if (matchIdx >= 0) {
        users[matchIdx] = updatedEntry;
      } else {
        users.push(updatedEntry);
      }
      await setDoc(permDocRef, { users, updatedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (err) {
    console.warn('Update permissions doc note:', err);
  }

  // 2. Update users/{cleanNew}
  try {
    await setDoc(doc(db, 'users', cleanNew), {
      name: cleanName,
      email: cleanNew,
      role,
      perms: role === 'SuperAdmin' ? ['*'] : perms,
      subject: subject.trim(),
      mobile: mobile.trim(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    if (cleanOld !== cleanNew) {
      await deleteDoc(doc(db, 'users', cleanOld));
    }
  } catch (err) {
    console.warn('Update users document note:', err);
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
