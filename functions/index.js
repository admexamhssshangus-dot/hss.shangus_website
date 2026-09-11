'use strict';

const crypto = require('crypto');
// This backend intentionally uses the stable 1st-gen function signatures.
const functions = require('firebase-functions/v1');
const admin = require('./firebaseAdmin');
const nodemailer = require('nodemailer');

if (!admin.getApps().length) admin.initializeApp();
const { requireStaff } = require('./access');
exports.staffDirectory = require('./staffDirectory')({ functions, admin, requireAppCheck });
exports.submitAcademicRecord = require('./academicRecords')({ functions, admin, requireAppCheck });
exports.mutateFundDistribution = require('./fundLedger')({ functions, admin, requireAppCheck });
exports.manageIssuedDocument = require('./issuedDocuments')({ functions, admin, requireAppCheck });
Object.assign(exports, require('./staffSecurity')({ functions, admin, nodemailer, requireAppCheck }));

const BOOTSTRAP_ADMIN_EMAIL = 'adm.exam.hss.shangus@gmail.com';
const ALLOWED_ROLES = new Set(['Student', 'Teacher', 'Admin', 'SuperAdmin']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function requireAppCheck(context) {
  if (process.env.REQUIRE_APP_CHECK !== 'false' && !context.app) {
    throw new functions.https.HttpsError('failed-precondition', 'A valid App Check token is required.');
  }
}

async function requireAdmin(context, module) {
  requireAppCheck(context);
  try { return await requireStaff(admin.firestore(), { ...context.auth?.token, uid: context.auth?.uid }, { adminOnly: true, module }); }
  catch (error) { throw new functions.https.HttpsError('permission-denied', error.message); }
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
  // A delayed Auth trigger must never overwrite a staff role assigned during
  // account provisioning. Canonical profiles are the authority source.
  const reference = admin.firestore().collection('users').doc(user.uid);
  await admin.firestore().runTransaction(async tx => {
    if ((await tx.get(reference)).exists) return;
    tx.create(reference, { uid: user.uid, email: String(user.email || '').toLowerCase(),
      name: user.displayName || '', role: 'Student', perms: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
});

exports.setUserAccess = functions.https.onCall(async () => {
  throw new functions.https.HttpsError('failed-precondition', 'Use manageStaffAccount so roles, accounts and session revocation stay consistent.');
});

exports.sendPracticalsEmail = functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  try { await requireStaff(admin.firestore(), { ...context.auth?.token, uid: context.auth?.uid }, { module: 'practicals' }); }
  catch (error) { throw new functions.https.HttpsError('permission-denied', error.message); }

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
  await requireAdmin(context, 'certStudio');
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
