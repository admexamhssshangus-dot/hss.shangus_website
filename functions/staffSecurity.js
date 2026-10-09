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
    const url = new URL(process.env.STAFF_PORTAL_ORIGIN || 'https://hssshangus.in');
    if (url.protocol !== 'https:') throw new Error('STAFF_PORTAL_ORIGIN must use HTTPS.');
    return url.origin;
  };
  async function sendSetup(mailer, email, verified) {
    const settings = { url: `${portalOrigin()}/portal/login` };
    const passwordLink = await admin.auth().generatePasswordResetLink(email, settings);
    const verificationLink = verified ? '' : await admin.auth().generateEmailVerificationLink(email, settings);
    await mailer.sendMail({ from: process.env.SMTP_USER, to: email, subject: 'HSS Shangus account setup',
      text: `Set your password:\n${passwordLink}${verificationLink ? `\n\nThen verify your email before staff sign-in:\n${verificationLink}` : ''}` });
  }
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
      // A Standard Admin may manage staff only when explicitly assigned the
      // Staff module.  The checks below keep that delegated authority bounded:
      // no Super Admin target/role and no permission they do not already hold.
      const actor = await requireStaff(db, tokenFor(context), { adminOnly: true, module: 'staff' });
      const actorIsSuperAdmin = roleKey(actor.role) === 'superadmin';
      const actorPerms = Array.isArray(actor.perms) ? actor.perms : [];
      if (!actorIsSuperAdmin && !actorPerms.includes('*') && !actorPerms.includes('staff')) {
        throw Object.assign(new Error('This account is not assigned to staff management.'), { status: 403 });
      }
      const email = String(data.newEmail || data.email || '').trim().toLowerCase();
      const oldEmail = String(data.oldEmail || data.email || email).trim().toLowerCase();
      const action = data.action;
      if (!['create', 'update', 'deactivate', 'reactivate', 'reset'].includes(action) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error('Valid account details are required.');
      const isRoot = (oldEmail === ROOT_EMAIL || email === ROOT_EMAIL);
      if (isRoot && action === 'deactivate') throw new Error('The bootstrap Super Admin cannot be deactivated.');
      let user;
      try { user = await admin.auth().getUserByEmail(oldEmail); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      if (!user && action !== 'create') throw new Error('No authentication account exists for this email.');
      if (user && action === 'create') throw new Error('This account already exists. Use Edit to assign its role.');
      // New profiles are UID-keyed.  Check the legacy email-keyed record too,
      // otherwise a historical Super Admin profile could evade the target-role
      // guard while accounts are being migrated.
      const [uidProfile, emailProfile] = user
        ? await Promise.all([
          db.collection('users').doc(user.uid).get(),
          db.collection('users').doc(oldEmail).get()
        ])
        : [null, null];
      const existingRole = roleKey(uidProfile?.data()?.role || emailProfile?.data()?.role || user?.customClaims?.role);
      const requestedRole = String(data.role || (existingRole === 'admin' ? 'Admin' : 'Teacher'));
      const requestedPerms = [...new Set((Array.isArray(data.perms) ? data.perms : [])
        .filter(p => typeof p === 'string' && /^[a-zA-Z][a-zA-Z0-9*]{0,63}$/.test(p)))].slice(0, 50);
      if (!actorIsSuperAdmin) {
        if (isRoot || existingRole === 'superadmin' || requestedRole === 'SuperAdmin') {
          throw Object.assign(new Error('Only the Super Admin can manage Super Admin access.'), { status: 403 });
        }
        if (action !== 'deactivate' && action !== 'reactivate' && !['Teacher', 'Admin'].includes(requestedRole)) {
          throw Object.assign(new Error('Standard Admins may create or update only Teacher or Admin accounts.'), { status: 403 });
        }
        if (requestedPerms.includes('*') || requestedPerms.some(permission => !actorPerms.includes(permission))) {
          throw Object.assign(new Error('You can assign only modules already assigned to your own account.'), { status: 403 });
        }
      }
      if (action === 'reset') {
        const mailer = transport();
        await sendSetup(mailer, email, user.emailVerified);
        return { success: true, email };
      }
      const role = isRoot ? 'SuperAdmin' : requestedRole;
      const name = String(data.name || uidProfile?.data()?.name || emailProfile?.data()?.name || user?.displayName || '').trim();
      if (action !== 'deactivate' && action !== 'reactivate' && (!['Teacher', 'Admin', 'SuperAdmin'].includes(role) || !name || name.length > 100)) throw new Error('Choose a name and an approved staff role.');
      if (data.password && (typeof data.password !== 'string' || data.password.length < 6 || data.password.length > 128)) throw new Error('Use a password between 6 and 128 characters.');
      const perms = isRoot ? ['*'] : requestedPerms;
      const sendEmail = action === 'create' ? data.sendSetupEmail !== false : data.sendResetEmail === true;
      if (!user) user = await admin.auth().createUser({ email, displayName: name,
        password: data.password || crypto.randomBytes(32).toString('base64url'), disabled: false });
      const profileRef = db.collection('users').doc(user.uid);
      const isDeactivating = action === 'deactivate';
      const isReactivating = action === 'reactivate';

      // Disable on deactivation; re-enable on reactivation
      if (isDeactivating) {
        await profileRef.set({ 
          uid: user.uid, 
          email: oldEmail, 
          active: false, 
          deactivated: true,
          deactivatedAt: new Date().toISOString(),
          deactivatedReason: String(data.reason || 'Transferred / Relieved').trim().slice(0, 200),
          validAfter: Math.floor(Date.now() / 1000) + 1 
        }, { merge: true });
        await admin.auth().revokeRefreshTokens(user.uid);
      } else if (isReactivating) {
        await profileRef.set({ 
          uid: user.uid, 
          email: oldEmail, 
          active: true, 
          deactivated: false,
          deactivatedAt: null,
          deactivatedReason: null,
          validAfter: Math.floor(Date.now() / 1000) + 1 
        }, { merge: true });
      }

      await admin.auth().updateUser(user.uid, { 
        disabled: isDeactivating, 
        ...((!isDeactivating && !isReactivating) ? { email, displayName: name, ...(data.password ? { password: data.password } : {}), ...(email !== oldEmail ? { emailVerified: false } : {}) } : {}) 
      });

      const effectiveRole = isDeactivating ? 'Student' : (role || 'Teacher');
      await admin.auth().setCustomUserClaims(user.uid, {
        role: effectiveRole,
        superadmin: !isDeactivating && isRoot,
        admin: !isDeactivating && (effectiveRole === 'Admin' || isRoot),
        teacher: !isDeactivating && effectiveRole === 'Teacher',
        permissions: isDeactivating ? [] : (isRoot ? ['*'] : perms)
      });

      const profile = {
        uid: user.uid,
        email: isDeactivating || isReactivating ? oldEmail : email,
        name: name || user.displayName || email,
        role: effectiveRole,
        perms: isDeactivating ? [] : (isRoot ? ['*'] : perms),
        active: !isDeactivating,
        deactivated: isDeactivating,
        deactivatedAt: isDeactivating ? new Date().toISOString() : null,
        deactivatedReason: isDeactivating ? String(data.reason || 'Transferred / Relieved').trim().slice(0, 200) : null,
        isStaff: !isDeactivating,
        isAdmin: !isDeactivating && (effectiveRole === 'Admin' || isRoot),
        isSuperAdmin: !isDeactivating && isRoot,
        isTeacher: !isDeactivating && effectiveRole === 'Teacher',
        designation: String(data.designation || uidProfile?.data()?.designation || '').trim().slice(0, 100),
        subject: String(data.subject || uidProfile?.data()?.subject || '').trim().slice(0, 100),
        teachingSubject: String(data.teachingSubject || data.subject || uidProfile?.data()?.teachingSubject || '').trim().slice(0, 100),
        assignedSubjects: Array.isArray(data.assignedSubjects) ? data.assignedSubjects : (uidProfile?.data()?.assignedSubjects || []),
        assignedClasses: [...new Set((Array.isArray(data.assignedClasses) ? data.assignedClasses : (uidProfile?.data()?.assignedClasses || [])).filter(value => ['9th', '10th', '11th', '12th'].includes(value)))],
        tierSubjects: data.tierSubjects || uidProfile?.data()?.tierSubjects || null,
        classSubjectMap: data.classSubjectMap || uidProfile?.data()?.classSubjectMap || null,
        mobile: String(data.mobile || uidProfile?.data()?.mobile || '').trim().slice(0, 20),
        updatedAt: timestamp()
      };

      await db.runTransaction(async tx => {
        const permissionsRef = db.collection('adminSettings').doc('permissions');
        const prior = await tx.get(permissionsRef);
        const priorUsers = prior.data()?.users || [];
        let rows = [...priorUsers];
        const existingIdx = rows.findIndex(item => item.uid === user.uid || [oldEmail, email].includes(String(item.email || '').toLowerCase()));

        if (isDeactivating) {
          const reasonText = String(data.reason || 'Transferred / Relieved').trim().slice(0, 200);
          if (existingIdx >= 0) {
            rows[existingIdx] = {
              ...rows[existingIdx],
              uid: user.uid,
              email: oldEmail,
              active: false,
              deactivated: true,
              deactivatedAt: new Date().toISOString(),
              deactivatedReason: reasonText
            };
          } else {
            rows.push({
              uid: user.uid,
              email: oldEmail,
              name: name || user.displayName || oldEmail,
              role: existingRole === 'admin' ? 'Admin' : 'Teacher',
              active: false,
              deactivated: true,
              deactivatedAt: new Date().toISOString(),
              deactivatedReason: reasonText
            });
          }
        } else if (isReactivating) {
          if (existingIdx >= 0) {
            rows[existingIdx] = {
              ...rows[existingIdx],
              uid: user.uid,
              email: oldEmail,
              active: true,
              deactivated: false,
              deactivatedAt: null,
              deactivatedReason: null
            };
          }
        } else {
          rows = rows.filter(item => item.uid !== user.uid && ![oldEmail, email].includes(String(item.email || '').toLowerCase()));
          rows.push({
            uid: user.uid,
            email,
            name,
            role,
            perms: profile.perms,
            active: true,
            deactivated: false,
            assignedClasses: profile.assignedClasses,
            assignedSubjects: profile.assignedSubjects,
            subject: profile.subject
          });
        }

        tx.set(profileRef, profile, { merge: true });
        tx.set(permissionsRef, { users: rows, updatedAt: timestamp() }, { merge: true });
        tx.delete(db.collection('users').doc(oldEmail));
        if (email !== oldEmail) tx.delete(db.collection('users').doc(email));
        if (isDeactivating) tx.delete(db.collection('adminSessions').doc(user.uid));
        tx.create(db.collection('securityAuditLogs').doc(), { action: `staff_${action}`, targetUid: user.uid, actorUid: context.auth.uid, createdAt: timestamp() });
      });

      // Synchronize deactivated faculty list in adminPracticalsSettings/config so teachers & practicals portal can adopt awards seamlessly
      try {
        const practicalsConfigRef = db.collection('adminPracticalsSettings').doc('config');
        if (isDeactivating) {
          await practicalsConfigRef.set({
            deactivatedTeachers: admin.firestore.FieldValue.arrayUnion(oldEmail)
          }, { merge: true });
        } else if (isReactivating) {
          await practicalsConfigRef.set({
            deactivatedTeachers: admin.firestore.FieldValue.arrayRemove(oldEmail)
          }, { merge: true });
        }
      } catch (pracErr) {
        console.warn('Note: adminPracticalsSettings sync in manageStaffAccount:', pracErr?.message || pracErr);
      }

      let emailSent = false;
      if (sendEmail && !isDeactivating && !isReactivating) {
        try {
          const mailer = transport();
          await sendSetup(mailer, email, user.emailVerified && email === oldEmail);
          emailSent = true;
        } catch (mErr) {
          console.warn('Staff setup email dispatch note:', mErr?.message || mErr);
        }
      }
      return { 
        success: true, 
        email, 
        uid: user.uid, 
        authCreated: action === 'create', 
        emailSent,
        message: isDeactivating 
          ? `Account deactivated and moved to Deactivated / Transferred category.` 
          : isReactivating 
          ? `Account reactivated successfully.` 
          : `Account saved successfully${emailSent ? '; setup email sent' : ''}.` 
      };
    })
  };
};
