/**
 * Lightweight, zero-dependency role constants and validation helpers.
 * Used across client entry points (e.g. App.js RoleGuard) without pulling in
 * full Firebase Auth/Firestore administrative modules into the critical main bundle.
 */

export const SUPERADMIN_EMAIL = 'adm.exam.hss.shangus@gmail.com';

export const BOOTSTRAP_ADMINS = [
  'ghssshangus74@gmail.com',
  'e.educational.24@gmail.com',
  'socialshiftz@gmail.com',
];

export function isSuperAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase() === SUPERADMIN_EMAIL;
}

export function isBootstrapAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return clean === SUPERADMIN_EMAIL || BOOTSTRAP_ADMINS.includes(clean);
}

// Backward-compat alias for components expecting isBootstrapSuperAdminEmail
export const isBootstrapSuperAdminEmail = isSuperAdminEmail;
