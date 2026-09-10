import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase';
import { isSuperAdminEmail } from '../utils/authRoles';
export { SUPERADMIN_EMAIL, BOOTSTRAP_ADMINS, isSuperAdminEmail, isBootstrapAdminEmail, isBootstrapSuperAdminEmail } from '../utils/authRoles';

export async function resolveStaffRoleAndPerms(emailOrUser) {
  const user = typeof emailOrUser === 'object' && emailOrUser?.uid ? emailOrUser : auth.currentUser;
  if (!user || !user.emailVerified) return null;
  const email = String(user.email || '').toLowerCase();
  if (typeof emailOrUser === 'string' && emailOrUser.toLowerCase() !== email) return null;
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  const profile = snapshot.exists() ? snapshot.data() : {};
  if (profile.active === false) throw new Error('This staff account is inactive.');
  const root = isSuperAdminEmail(email);
  const role = root ? 'SuperAdmin' : profile.role;
  if (!['Teacher', 'Admin', 'SuperAdmin'].includes(role)) return null;
  return { ...profile, uid: user.uid, email, role, perms: root ? ['*'] : (profile.perms || []),
    isSuperAdmin: role === 'SuperAdmin', isAdmin: role !== 'Teacher', isTeacher: role === 'Teacher', isStaff: true,
    name: profile.name || user.displayName || email.split('@')[0] };
}
export async function requireVerifiedAdminSession(user = auth.currentUser) {
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdTokenResult();
  const snapshot = await getDoc(doc(db, 'adminSessions', user.uid));
  const session = snapshot.exists() ? snapshot.data() : null;
  if (!session || session.authTime !== token.claims.auth_time || session.expiresAt.toMillis() <= Date.now()) {
    const error = new Error('Complete the email verification for this administrator sign-in.');
    error.code = 'staff/verification-required'; throw error;
  }
}
const manage = async data => (await httpsCallable(functions, 'manageStaffAccount')(data)).data;
export const createStaffAccount = data => manage({ ...data, action: 'create' });
export const updateStaffAccount = data => manage({ ...data, action: 'update' });
export const deleteStaffAccount = email => manage({ email, action: 'deactivate' });
export const sendStaffPasswordReset = email => manage({ email, action: 'reset' });
export const incrementTeacherLoginCount = async () => 1;
export const recordTeacher2StepVerification = async () => {};
export async function createAdminLoginHandshake(email) {
  const response = await httpsCallable(functions, 'beginAdminVerification')({});
  const handshakeId = response.data.handshakeId;
  sessionStorage.setItem('hss_auth_handshake_id', handshakeId);
  localStorage.setItem('hss_pending_admin_login', JSON.stringify({ email, handshakeId, ts: Date.now() }));
  return handshakeId;
}
export async function approveAdminLoginHandshake(handshakeId, proof) {
  return (await httpsCallable(functions, 'approveAdminVerification')({ handshakeId, proof })).data;
}
export async function consumeAdminLoginHandshake(handshakeId) {
  await httpsCallable(functions, 'cancelAdminVerification')({ handshakeId });
  sessionStorage.removeItem('hss_auth_handshake_id');
}
export async function sendAdminSignInVerificationLink(email, handshakeId) {
  if (!handshakeId) throw new Error('Request a new verification link.');
  return { success: true, handshakeId };
}
