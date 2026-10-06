'use strict';
const ROOT_EMAIL = 'adm.exam.hss.shangus@gmail.com';
const BOOTSTRAP_STAFF_EMAILS = new Set([
  'adm.exam.hss.shangus@gmail.com',
  'e.educational.24@gmail.com',
  'ghssshangus74@gmail.com',
  'majidhassannajar@gmail.com',
  'bilalhcu@gmail.com',
  'shahnawaz13678@gmail.com',
  'shahnawaz@gmail.com',
  'socialshiftz@gmail.com',
  'hajimir91@gmail.com'
]);
const roleKey = value => String(value || '').toLowerCase().replace(/\s+/g, '');
function authority(token, profile) {
  const emailLower = String(token?.email || '').toLowerCase().trim();
  const isBootstrap = BOOTSTRAP_STAFF_EMAILS.has(emailLower);
  if (!token?.uid || (!isBootstrap && token.email_verified !== true) || profile?.active === false ||
      Number(token.auth_time || 0) < Number(profile?.validAfter || 0)) return null;
  const root = emailLower === ROOT_EMAIL;
  const role = root ? 'SuperAdmin' : (profile?.role || (BOOTSTRAP_STAFF_EMAILS.has(emailLower) ? 'Admin' : null));
  if (!['teacher', 'admin', 'superadmin'].includes(roleKey(role))) return null;
  return { ...profile, uid: token.uid, email: token.email, role, perms: root ? ['*'] : (profile?.perms || (isBootstrap ? ['reports'] : [])) };
}
function hasAdminSession(token, session, now = Date.now()) {
  const expires = session?.expiresAt?.toMillis?.() ?? Number(session?.expiresAt || 0);
  return session?.authTime === token.auth_time && expires > now;
}
async function requireStaff(db, token, { module, adminOnly = false, challenge = false } = {}) {
  let profileData = null;
  if (token?.uid) {
    const profile = await db.collection('users').doc(token.uid).get();
    if (profile.exists) profileData = profile.data();
  }
  const emailLower = String(token?.email || '').toLowerCase().trim();
  if (!profileData && emailLower) {
    const emailSnap = await db.collection('users').doc(emailLower).get();
    if (emailSnap.exists) profileData = emailSnap.data();
  }
  if (!profileData && emailLower) {
    try {
      const permSnap = await db.collection('adminSettings').doc('permissions').get();
      if (permSnap.exists && Array.isArray(permSnap.data()?.users)) {
        const matched = permSnap.data().users.find(u => String(u.email || '').toLowerCase().trim() === emailLower);
        if (matched) profileData = matched;
      }
    } catch (_) {}
  }
  if (!profileData && emailLower) {
    const FALLBACKS = {
      'adm.exam.hss.shangus@gmail.com': { name: 'Sheikh Gulfam (SuperAdmin)', role: 'SuperAdmin', perms: ['*'] },
      'e.educational.24@gmail.com': { name: 'Sheikh Gulfam', role: 'Admin', perms: ['reports'] },
      'ghssshangus74@gmail.com': { name: 'GHSS Shangus (Admin)', role: 'Admin', perms: ['reports'] },
      'majidhassannajar@gmail.com': { name: 'Majid Hassan Najar (Admin)', role: 'Admin', perms: ['reports'] },
      'bilalhcu@gmail.com': { name: 'Bilal Ahmad Khandy (Admin)', role: 'Admin', perms: ['reports'] },
      'shahnawaz13678@gmail.com': { name: 'Nawaz Ahmad Shah (Admin)', role: 'Admin', perms: ['reports'] },
      'shahnawaz@gmail.com': { name: 'Nawaz Ahmad Shah (Admin)', role: 'Admin', perms: ['reports'] },
      'socialshiftz@gmail.com': { name: 'Sheikh Gulfam', role: 'Teacher', perms: ['attendanceMgmt', 'practicals'] },
      'hajimir91@gmail.com': { name: 'Javid Ahmad', role: 'Teacher', perms: ['attendanceMgmt', 'practicals'] }
    };
    if (FALLBACKS[emailLower]) profileData = FALLBACKS[emailLower];
  }
  const staff = authority(token, profileData);
  const isAdmin = staff && ['admin', 'superadmin'].includes(roleKey(staff.role));
  if (!staff || (adminOnly && !isAdmin)) throw Object.assign(new Error('Verified, active staff access is required.'), { status: 403 });
  if (isAdmin && !challenge) {
    const session = await db.collection('adminSessions').doc(token.uid).get();
    if (!hasAdminSession(token, session.exists ? session.data() : null)) {
      throw Object.assign(new Error('Complete email verification for this administrator sign-in.'), { status: 403 });
    }
  }
  if (module && isAdmin && roleKey(staff.role) !== 'superadmin' && !staff.perms.includes('*') && !staff.perms.includes(module)) {
    throw Object.assign(new Error('This account is not assigned to this module.'), { status: 403 });
  }
  return staff;
}
module.exports = { ROOT_EMAIL, roleKey, authority, hasAdminSession, requireStaff };
