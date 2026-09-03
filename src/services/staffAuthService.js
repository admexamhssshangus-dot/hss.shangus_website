import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendPasswordResetEmail,
  sendSignInLinkToEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
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

/**
 * Resolves whether an email/user belongs to Staff (SuperAdmin, Admin, Teacher)
 * by checking Firestore users collection, Firestore adminSettings/permissions, and fallback Bootstrap list.
 */
export async function resolveStaffRoleAndPerms(emailOrUser) {
  if (!emailOrUser) return null;
  const email = (typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email || '').trim().toLowerCase();
  if (!email) return null;

  // 1. Sole Super Admin check: ONLY adm.exam.hss.shangus@gmail.com
  if (isSuperAdminEmail(email)) {
    return {
      role: 'SuperAdmin',
      perms: ['*'],
      isSuperAdmin: true,
      isAdmin: true,
      isTeacher: false,
      isStaff: true,
      name: 'Super Admin',
      email,
    };
  }

  // 2. Check Firestore 'users' collection (where Super Admin explicitly provisions staff & teachers)
  try {
    const userSnap = await getDoc(doc(db, 'users', email));
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const rawRole = String(uData.role || '').trim();
      const roleLower = rawRole.toLowerCase();
      if (roleLower.includes('admin') || roleLower === 'teacher' || roleLower === 'faculty' || roleLower === 'staff') {
        const isSuper = roleLower === 'superadmin' || roleLower === 'super admin';
        const isAdmin = roleLower === 'admin' || isSuper;
        const isTeacher = roleLower === 'teacher' || roleLower === 'faculty';
        return {
          role: isSuper ? 'SuperAdmin' : isAdmin ? 'Admin' : 'Teacher',
          perms: isSuper ? ['*'] : (uData.perms || []),
          isSuperAdmin: isSuper,
          isAdmin,
          isTeacher,
          isStaff: true,
          name: uData.name || uData.displayName || email.split('@')[0],
          subject: uData.subject || uData.teachingSubject || '',
          mobile: uData.mobile || uData.phone || '',
          teacherLoginCount: typeof uData.teacherLoginCount === 'number' ? uData.teacherLoginCount : 0,
          last2StepVerificationDate: uData.last2StepVerificationDate || null,
          email,
        };
      }
    }
  } catch (err) {
    console.warn('resolveStaffRoleAndPerms users doc lookup note:', err);
  }

  // 2. Check Firestore permissions document (for Admin & SuperAdmin roles)
  try {
    const permSnap = await getDoc(doc(db, 'adminSettings', 'permissions'));
    if (permSnap.exists()) {
      const data = permSnap.data();
      const usersList = Array.isArray(data.users) ? data.users : [];
      const found = usersList.find(u => String(u.email || '').trim().toLowerCase() === email);
      if (found) {
        const isSuper = found.role === 'SuperAdmin' || (Array.isArray(found.perms) && found.perms.includes('*'));
        const isAdmin = found.role === 'Admin' || isSuper;
        const isTeacher = found.role === 'Teacher' || found.role === 'Faculty';
        return {
          role: found.role || (isSuper ? 'SuperAdmin' : 'Admin'),
          perms: isSuper ? ['*'] : (found.perms || []),
          isSuperAdmin: isSuper,
          isAdmin,
          isTeacher,
          isStaff: true,
          name: found.name || email.split('@')[0],
          subject: found.subject || '',
          mobile: found.mobile || '',
          email,
        };
      }
    }
  } catch (err) {
    if (err?.code !== 'permission-denied' && !String(err?.message || '').includes('insufficient permissions')) {
      console.warn('resolveStaffRoleAndPerms permissions lookup note:', err);
    }
  }

  // 4. Institutional Bootstrap Admins fallback (Admin role, NOT SuperAdmin)
  if (BOOTSTRAP_ADMINS.includes(email)) {
    return {
      role: 'Admin',
      perms: ['reports', 'controls', 'subjects', 'directEntry', 'bulkTools'],
      isSuperAdmin: false,
      isAdmin: true,
      isTeacher: false,
      isStaff: true,
      name: email.split('@')[0],
      email,
    };
  }

  return null;
}

/**
 * Increments teacher email/password login counter in Firestore.
 */
export async function incrementTeacherLoginCount(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return 1;
  try {
    const userRef = doc(db, 'users', cleanEmail);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const curCount = typeof snap.data().teacherLoginCount === 'number' ? snap.data().teacherLoginCount : 0;
      await setDoc(userRef, {
        teacherLoginCount: curCount + 1,
        lastLoginAt: new Date().toISOString()
      }, { merge: true });
      return curCount + 1;
    }
  } catch (err) {
    console.warn('incrementTeacherLoginCount note:', err);
  }
  return 1;
}

/**
 * Records successful 2-step verification for a teacher in Firestore and increments login count.
 */
export async function recordTeacher2StepVerification(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    const userRef = doc(db, 'users', cleanEmail);
    const snap = await getDoc(userRef);
    const curCount = (snap.exists() && typeof snap.data().teacherLoginCount === 'number') ? snap.data().teacherLoginCount : 0;
    await setDoc(userRef, {
      teacherLoginCount: curCount + 1,
      last2StepVerificationDate: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('recordTeacher2StepVerification note:', err);
  }
}

/**
 * Creates a new staff account (Admin, SuperAdmin, or Teacher).
 * Uses a secondary Firebase App instance so the active Super Admin session is NOT disrupted.
 */
export async function createStaffAccount({ name, email, role = 'Admin', perms = [], subject = '', mobile = '', password = '', sendSetupEmail = true }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanEmail || !cleanName) {
    throw new Error('Name and valid email address are required.');
  }

  let createdUid = null;
  let authCreated = false;

  // 1. If password provided, attempt secondary Firebase Auth user creation
  if (password && password.length >= 6) {
    const secondaryAppName = `StaffProvisioningApp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let secondaryApp = null;
    try {
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      createdUid = userCred.user.uid;
      await updateProfile(userCred.user, { displayName: cleanName }).catch(() => {});
      authCreated = true;
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        // User already exists in Auth, which is fine - we will configure Firestore
        console.log('Firebase Auth user already exists for', cleanEmail);
      } else {
        console.warn('Secondary auth user creation warning:', authErr);
      }
    } finally {
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (_) {}
      }
    }
  }

  // 2. If requested, or if no password provided, dispatch password reset / setup link
  if (sendSetupEmail || !password) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false
      });
    } catch (emailErr) {
      console.warn('Password setup email dispatch note:', emailErr);
    }
  }

  // 3. Write/merge user demographic and role profile in Firestore `users/{cleanEmail}`
  const userPayload = {
    email: cleanEmail,
    name: cleanName,
    role,
    perms: role === 'SuperAdmin' ? ['*'] : perms,
    subject: subject.trim(),
    mobile: mobile.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (createdUid) userPayload.uid = createdUid;

  await setDoc(doc(db, 'users', cleanEmail), userPayload, { merge: true });
  if (createdUid) {
    await setDoc(doc(db, 'users', createdUid), userPayload, { merge: true }).catch(() => {});
  }

  // 4. If Admin or SuperAdmin, also update Firestore `adminSettings/permissions`
  if (role === 'Admin' || role === 'SuperAdmin') {
    try {
      const permDocRef = doc(db, 'adminSettings', 'permissions');
      const permSnap = await getDoc(permDocRef);
      let currentUsers = [];
      if (permSnap.exists() && Array.isArray(permSnap.data().users)) {
        currentUsers = permSnap.data().users;
      }
      
      const existingIdx = currentUsers.findIndex(u => String(u.email || '').trim().toLowerCase() === cleanEmail);
      const newAdminEntry = {
        name: cleanName,
        email: cleanEmail,
        role,
        perms: role === 'SuperAdmin' ? ['*'] : perms,
        subject: subject.trim(),
        mobile: mobile.trim(),
      };

      if (existingIdx >= 0) {
        currentUsers[existingIdx] = newAdminEntry;
      } else {
        currentUsers.push(newAdminEntry);
      }

      await setDoc(permDocRef, { users: currentUsers, updatedAt: new Date().toISOString() }, { merge: true });
      try {
        localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(currentUsers));
      } catch (_) {}
    } catch (fsErr) {
      console.warn('adminSettings/permissions write note:', fsErr);
    }
  }

  return {
    success: true,
    email: cleanEmail,
    authCreated,
    message: authCreated 
      ? `Account for ${cleanName} created with password. Firestore permissions configured.`
      : `Account profile configured in database. Password setup link sent to ${cleanEmail}.`
  };
}

/**
 * Updates an existing staff account (including changing their Email ID).
 */
export async function updateStaffAccount({ oldEmail, newEmail, name, role = 'Admin', perms = [], subject = '', mobile = '', sendResetEmail = false }) {
  const cleanOld = oldEmail.trim().toLowerCase();
  const cleanNew = newEmail.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanNew || !cleanName) {
    throw new Error('Name and valid email address are required.');
  }

  // 1. Update Firestore `adminSettings/permissions`
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
        if (role === 'Teacher' || role === 'Faculty') {
          // If demoted/changed to teacher, remove from admin permissions array
          users.splice(matchIdx, 1);
        } else {
          users[matchIdx] = updatedEntry;
        }
      } else if (role === 'Admin' || role === 'SuperAdmin') {
        users.push(updatedEntry);
      }

      await setDoc(permDocRef, { users, updatedAt: new Date().toISOString() }, { merge: true });
      try {
        localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(users));
      } catch (_) {}
    }
  } catch (fsErr) {
    console.warn('Update permissions doc note:', fsErr);
  }

  // 2. Write new document in Firestore `users/{cleanNew}`
  const userPayload = {
    email: cleanNew,
    name: cleanName,
    role,
    perms: role === 'SuperAdmin' ? ['*'] : perms,
    subject: subject.trim(),
    mobile: mobile.trim(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', cleanNew), userPayload, { merge: true });

  // 3. If email changed, delete old email document from `users/{cleanOld}`
  if (cleanOld !== cleanNew) {
    try {
      await deleteDoc(doc(db, 'users', cleanOld));
    } catch (_) {}
  }

  // 4. If requested, send password reset / setup link to the new email
  if (sendResetEmail) {
    try {
      await sendPasswordResetEmail(auth, cleanNew, {
        url: `${window.location.origin}/portal/login`,
        handleCodeInApp: false
      });
    } catch (emailErr) {
      console.warn('Password reset dispatch note:', emailErr);
    }
  }

  return { success: true, email: cleanNew };
}

/**
 * Sends a password reset / setup email to any staff member.
 */
export async function sendStaffPasswordReset(email) {
  const cleanEmail = email.trim().toLowerCase();
  await sendPasswordResetEmail(auth, cleanEmail, {
    url: `${window.location.origin}/portal/login`,
    handleCodeInApp: false
  });
  return { success: true };
}

/**
 * Creates a unique one-time login handshake for cross-window / cross-device 2-step verification.
 */
export async function createAdminLoginHandshake(email) {
  const cleanEmail = email.trim().toLowerCase();
  const handshakeId = 'hsk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 12);
  const handshakeData = {
    id: handshakeId,
    email: cleanEmail,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };

  try {
    await setDoc(doc(db, 'adminAuthHandshakes', handshakeId), handshakeData);
  } catch (err) {
    console.warn('Error creating admin auth handshake document:', err);
  }

  try {
    sessionStorage.setItem('hss_auth_handshake_id', handshakeId);
  } catch (_) {}

  return handshakeId;
}

/**
 * Approves a login handshake when the email link is clicked and verified.
 */
export async function approveAdminLoginHandshake(handshakeId, email, firebaseUser) {
  if (!handshakeId) return;
  const cleanEmail = email.trim().toLowerCase();
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
 * Consumes / deletes a login handshake after successful login.
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
 * Sends a 2-step verification email sign-in link to an Admin's email inbox with optional handshakeId.
 */
export async function sendAdminSignInVerificationLink(email, handshakeId = '') {
  const cleanEmail = email.trim().toLowerCase();
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
 * Revokes / deletes an admin or teacher account from Firestore permissions.
 */
export async function deleteStaffAccount(email) {
  const cleanEmail = email.trim().toLowerCase();
  
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

  // 2. Remove or deactivate user in Firestore `users/{cleanEmail}`
  try {
    await deleteDoc(doc(db, 'users', cleanEmail));
  } catch (_) {}

  return { success: true };
}
