'use strict';
const ROOT_EMAIL = 'adm.exam.hss.shangus@gmail.com';
const roleKey = value => String(value || '').toLowerCase().replace(/\s+/g, '');
function authority(token, profile) {
  if (!token?.uid || token.email_verified !== true || profile?.active === false ||
      Number(token.auth_time || 0) < Number(profile?.validAfter || 0)) return null;
  const root = String(token.email || '').toLowerCase() === ROOT_EMAIL;
  const role = root ? 'SuperAdmin' : profile?.role;
  if (!['teacher', 'admin', 'superadmin'].includes(roleKey(role))) return null;
  return { ...profile, uid: token.uid, email: token.email, role, perms: root ? ['*'] : (profile?.perms || []) };
}
function hasAdminSession(token, session, now = Date.now()) {
  const expires = session?.expiresAt?.toMillis?.() ?? Number(session?.expiresAt || 0);
  return session?.authTime === token.auth_time && expires > now;
}
async function requireStaff(db, token, { module, adminOnly = false, challenge = false } = {}) {
  const profile = token?.uid ? await db.collection('users').doc(token.uid).get() : null;
  const staff = authority(token, profile?.exists ? profile.data() : null);
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
