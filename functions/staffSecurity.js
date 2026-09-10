'use strict';
const crypto = require('crypto');
const { ROOT_EMAIL, roleKey, requireStaff } = require('./access');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
module.exports = function staffSecurity({ functions, admin, nodemailer, requireAppCheck }) {
  const db = admin.firestore();
  const timestamp = () => admin.firestore.FieldValue.serverTimestamp();
  const call = handler => functions.https.onCall(async (data, context) => {
    requireAppCheck(context);
    try { return await handler(data || {}, context); }
    catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error('Staff operation failed:', error.code || error.message);
      throw new functions.https.HttpsError(error.status === 403 ? 'permission-denied' : 'failed-precondition', error.message);
    }
  });
  const tokenFor = context => ({ ...context.auth?.token, uid: context.auth?.uid });
  function transport() {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Email service is not configured.');
    return nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
  const portalOrigin = () => {
    const url = new URL(process.env.STAFF_PORTAL_ORIGIN || 'https://admexamhssshangus.web.app');
    if (url.protocol !== 'https:') throw new Error('STAFF_PORTAL_ORIGIN must use HTTPS.');
    return url.origin;
  };
  return {
    beginAdminVerification: call(async (_, context) => {
      const token = tokenFor(context);
      await requireStaff(db, token, { adminOnly: true, challenge: true });
      const mailer = transport();
      const secret = crypto.randomBytes(32).toString('base64url');
      const challenge = db.collection('adminAuthHandshakes').doc();
      const rate = db.collection('securityRateLimits').doc(`staff_verification_${token.uid}`);
      const expiresAt = Date.now() + 10 * 60000;
      await db.runTransaction(async tx => {
        const previous = await tx.get(rate);
        if (previous.exists && Date.now() - previous.data().lastSent < 60000) throw new Error('Wait one minute before requesting another link.');
        tx.set(rate, { lastSent: Date.now(), expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt) });
        tx.create(challenge, { uid: token.uid, email: token.email, authTime: token.auth_time,
          status: 'pending', createdAt: timestamp(), expiresAt });
        tx.create(db.collection('adminAuthSecrets').doc(challenge.id), { proofHash: hash(secret), expiresAt });
      });
      // Only the inbox receives the random proof; the requesting browser gets an ID.
      const link = `${portalOrigin()}/portal/login#staff_challenge=${challenge.id}&proof=${secret}`;
      try {
        await mailer.sendMail({ from: process.env.SMTP_USER, to: token.email,
          subject: 'Confirm your HSS Shangus administrator sign-in',
          text: `Confirm the sign-in you just requested using this one-time link (valid for 10 minutes):\n${link}\n\nIf you did not request this, do not approve it.` });
      } catch (error) {
        await challenge.update({ status: 'failed' });
        throw new Error('The verification email could not be sent. Please retry.');
      }
      return { handshakeId: challenge.id };
    }),
    approveAdminVerification: call(async data => {
      if (!/^[a-zA-Z0-9]{20}$/.test(data.handshakeId || '') || !/^[a-zA-Z0-9_-]{43}$/.test(data.proof || '')) throw new Error('Invalid verification link.');
      const ref = db.collection('adminAuthHandshakes').doc(data.handshakeId);
      const secretRef = db.collection('adminAuthSecrets').doc(data.handshakeId);
      return db.runTransaction(async tx => {
        const [challenge, secret] = await Promise.all([tx.get(ref), tx.get(secretRef)]);
        const item = challenge.data();
        if (!challenge.exists || !secret.exists || item.status !== 'pending' || item.expiresAt <= Date.now() ||
            !crypto.timingSafeEqual(Buffer.from(secret.data().proofHash, 'hex'), Buffer.from(hash(data.proof), 'hex'))) throw new Error('This verification link is invalid, expired or already used.');
        const profile = await tx.get(db.collection('users').doc(item.uid));
        if (profile.data()?.active === false || Number(profile.data()?.validAfter || 0) > item.authTime) throw new Error('This account no longer has access.');
        tx.set(db.collection('adminSessions').doc(item.uid), { authTime: item.authTime,
          verifiedAt: timestamp(), expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 8 * 3600000) });
        tx.update(ref, { status: 'approved', verifiedAt: timestamp() });
        tx.delete(secretRef);
        return { success: true, email: item.email };
      });
    }),
    cancelAdminVerification: call(async (data, context) => {
      if (!context.auth || !/^[a-zA-Z0-9]{20}$/.test(data.handshakeId || '')) throw new Error('Sign in again.');
      const ref = db.collection('adminAuthHandshakes').doc(data.handshakeId);
      await db.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (!current.exists || current.data().uid !== context.auth.uid) throw new Error('Invalid challenge.');
        if (current.data().status === 'pending') tx.update(ref, { status: 'cancelled' });
      });
      return { success: true };
    }),
    manageStaffAccount: call(async (data, context) => {
      const actor = await requireStaff(db, tokenFor(context), { adminOnly: true });
      if (roleKey(actor.role) !== 'superadmin') throw Object.assign(new Error('Only the Super Admin can manage staff access.'), { status: 403 });
      const email = String(data.newEmail || data.email || '').trim().toLowerCase();
      const oldEmail = String(data.oldEmail || data.email || email).trim().toLowerCase();
      const action = data.action;
      if (!['create', 'update', 'deactivate', 'reset'].includes(action) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error('Valid account details are required.');
      if ((oldEmail === ROOT_EMAIL || email === ROOT_EMAIL) && action !== 'reset') throw new Error('The bootstrap Super Admin cannot be changed through staff management.');
      let user;
      try { user = await admin.auth().getUserByEmail(oldEmail); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      if (!user && action !== 'create') throw new Error('No authentication account exists for this email.');
      if (user && action === 'create') throw new Error('This account already exists. Use Edit to assign its role.');
      if (action === 'reset') {
        const mailer = transport();
        const link = await admin.auth().generatePasswordResetLink(email, { url: `${portalOrigin()}/portal/login` });
        await mailer.sendMail({ from: process.env.SMTP_USER, to: email, subject: 'HSS Shangus password setup', text: `Set your password using this link:\n${link}` });
        return { success: true, email };
      }
      const role = data.role || 'Teacher';
      const name = String(data.name || '').trim();
      if (action !== 'deactivate' && (!['Teacher', 'Admin'].includes(role) || !name || name.length > 100)) throw new Error('Choose a name and an approved staff role.');
      const perms = [...new Set((Array.isArray(data.perms) ? data.perms : []).filter(p => typeof p === 'string' && /^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(p)))].slice(0, 50);
      const sendEmail = action === 'create' ? data.sendSetupEmail !== false : data.sendResetEmail === true;
      const mailer = sendEmail ? transport() : null; // fail before changing an account when SMTP is unavailable
      if (!user) user = await admin.auth().createUser({ email, displayName: name,
        password: data.password || crypto.randomBytes(32).toString('base64url'), disabled: true });
      const profileRef = db.collection('users').doc(user.uid);
      // Disable first: old ID tokens cannot retain authority during a partial failure.
      await profileRef.set({ uid: user.uid, email: oldEmail, active: false, validAfter: Math.floor(Date.now() / 1000) + 1 }, { merge: true });
      await admin.auth().revokeRefreshTokens(user.uid);
      await admin.auth().updateUser(user.uid, { disabled: action === 'deactivate', ...(action !== 'deactivate' ? { email, displayName: name, ...(email !== oldEmail ? { emailVerified: false } : {}) } : {}) });
      await admin.auth().setCustomUserClaims(user.uid, { role: action === 'deactivate' ? 'Student' : role,
        admin: action !== 'deactivate' && role === 'Admin', teacher: action !== 'deactivate' && role === 'Teacher', permissions: perms });
      const profile = { uid: user.uid, email, name: name || user.displayName || email, role: action === 'deactivate' ? 'Student' : role,
        perms: action === 'deactivate' ? [] : perms, active: action !== 'deactivate', subject: String(data.subject || '').trim().slice(0, 100),
        mobile: String(data.mobile || '').trim().slice(0, 20), updatedAt: timestamp() };
      await db.runTransaction(async tx => {
        const permissionsRef = db.collection('adminSettings').doc('permissions');
        const prior = await tx.get(permissionsRef);
        const rows = (prior.data()?.users || []).filter(item => item.uid !== user.uid && ![oldEmail, email].includes(String(item.email || '').toLowerCase()));
        if (profile.active && role === 'Admin') rows.push({ uid: user.uid, email, name, role, perms });
        tx.set(profileRef, profile, { merge: true });
        tx.set(permissionsRef, { users: rows, updatedAt: timestamp() }, { merge: true });
        tx.delete(db.collection('users').doc(oldEmail));
        if (email !== oldEmail) tx.delete(db.collection('users').doc(email));
        tx.delete(db.collection('adminSessions').doc(user.uid));
        tx.create(db.collection('securityAuditLogs').doc(), { action: `staff_${action}`, targetUid: user.uid, actorUid: context.auth.uid, createdAt: timestamp() });
      });
      let emailSent = false;
      if (mailer && action !== 'deactivate') {
        try {
          const link = await admin.auth().generatePasswordResetLink(email, { url: `${portalOrigin()}/portal/login` });
          await mailer.sendMail({ from: process.env.SMTP_USER, to: email, subject: 'HSS Shangus password setup', text: `Set your password using this link:\n${link}` });
          emailSent = true;
        } catch (_) { return { success: true, email, uid: user.uid, emailSent: false, message: 'Account saved. Setup email failed; use Send password reset to retry.' }; }
      }
      return { success: true, email, uid: user.uid, authCreated: action === 'create', emailSent,
        message: `Account ${action === 'deactivate' ? 'deactivated and sessions revoked' : 'saved'}${emailSent ? '; setup email sent' : ''}.` };
    })
  };
};
