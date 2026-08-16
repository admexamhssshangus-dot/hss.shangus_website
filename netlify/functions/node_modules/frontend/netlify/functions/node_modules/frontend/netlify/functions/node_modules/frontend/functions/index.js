'use strict';

const crypto = require('crypto');
// This backend intentionally uses the stable 1st-gen function signatures.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const BOOTSTRAP_ADMIN_EMAIL = 'adm.exam.hss.shangus@gmail.com';
const ALLOWED_ROLES = new Set(['Student', 'Teacher', 'Admin', 'SuperAdmin']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function requireAppCheck(context) {
  if (process.env.REQUIRE_APP_CHECK !== 'false' && !context.app) {
    throw new functions.https.HttpsError('failed-precondition', 'A valid App Check token is required.');
  }
}

function isAdminContext(context) {
  if (!context.auth) return false;
  const token = context.auth.token || {};
  if (token.email_verified !== true) return false;
  const role = String(token.role || '').toLowerCase();
  return token.admin === true || ['admin', 'superadmin', 'super admin'].includes(role) ||
    token.email === BOOTSTRAP_ADMIN_EMAIL;
}

function isStaffContext(context) {
  if (!context.auth) return false;
  if (context.auth.token?.email_verified !== true) return false;
  const role = String(context.auth.token?.role || '').toLowerCase();
  return isAdminContext(context) || context.auth.token?.teacher === true ||
    ['teacher', 'faculty'].includes(role);
}

function requireAdmin(context) {
  requireAppCheck(context);
  if (!isAdminContext(context)) {
    throw new functions.https.HttpsError('permission-denied', 'Verified administrator privileges are required.');
  }
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function sanitizeEmailHtml(value) {
  return String(value || '')
    .slice(0, 100000)
    .replace(/<\s*(script|iframe|object|embed|form|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|link)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

exports.initializeUserClaims = functions.auth.user().onCreate(async (user) => {
  const isBootstrap = user.emailVerified && user.email === BOOTSTRAP_ADMIN_EMAIL;
  const claims = isBootstrap
    ? { role: 'SuperAdmin', admin: true, permissions: ['*'] }
    : { role: 'Student', admin: false, teacher: false, permissions: [] };
  await admin.auth().setCustomUserClaims(user.uid, claims);
  const profileId = String(user.email || user.uid).toLowerCase();
  await admin.firestore().collection('users').doc(profileId).set({
    uid: user.uid,
    email: String(user.email || '').toLowerCase(),
    name: user.displayName || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
});

exports.setUserAccess = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  const uid = cleanText(data?.uid, 128);
  const role = cleanText(data?.role, 32);
  const permissions = Array.isArray(data?.permissions)
    ? [...new Set(data.permissions.map(v => cleanText(v, 64)).filter(Boolean))].slice(0, 50)
    : [];
  if (!uid || !ALLOWED_ROLES.has(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid UID and approved role are required.');
  }

  await admin.auth().setCustomUserClaims(uid, {
    role,
    admin: role === 'Admin' || role === 'SuperAdmin',
    teacher: role === 'Teacher',
    permissions,
  });
  await admin.firestore().collection('securityAuditLogs').add({
    action: 'set_user_access',
    targetUid: uid,
    role,
    permissions,
    actorUid: context.auth.uid,
    actorEmail: context.auth.token.email || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.sendPracticalsEmail = functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  if (!isStaffContext(context) || context.auth.token.email_verified !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Verified staff privileges are required.');
  }

  const recipients = (Array.isArray(data?.to) ? data.to : [data?.to])
    .map(v => cleanText(v, 254).toLowerCase()).filter(v => EMAIL_RE.test(v));
  const uniqueRecipients = [...new Set(recipients)].slice(0, 25);
  const subject = cleanText(data?.subject, 160);
  const html = sanitizeEmailHtml(data?.htmlBody);
  const plainText = cleanText(data?.plainTextBody, 100000);
  if (!uniqueRecipients.length || !subject || (!html && !plainText)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid recipients, subject and message are required.');
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    throw new functions.https.HttpsError('failed-precondition', 'Email service is not configured.');
  }
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
  await transport.sendMail({
    from: `"HSS Shangus" <${smtpUser}>`,
    to: uniqueRecipients,
    replyTo: smtpUser,
    subject,
    text: plainText || 'Please view this email in an HTML-compatible client.',
    html: html || undefined,
  });
  await admin.firestore().collection('emailLogs').add({
    recipientCount: uniqueRecipients.length,
    subject,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    sentByUid: context.auth.uid,
    sentByEmail: context.auth.token.email || null,
  });
  return { success: true };
});

exports.signStudentVerification = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  const reg = cleanText(data?.reg, 64);
  const roll = cleanText(data?.roll, 64);
  const formNo = cleanText(data?.formNo, 64);
  const secret = process.env.VERIFICATION_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new functions.https.HttpsError('failed-precondition', 'Verification signing is not configured.');
  }
  const signature = crypto.createHmac('sha256', secret)
    .update(`${reg}::${roll}::${formNo}`)
    .digest('base64url');
  return { signature };
});
