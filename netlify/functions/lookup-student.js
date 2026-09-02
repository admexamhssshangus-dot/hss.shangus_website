'use strict';

const crypto = require('crypto');
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

function parseServiceAccount(raw) {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  let str = String(raw).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    try { str = JSON.parse(str); } catch (e) {}
  }
  if (!str.startsWith('{')) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) str = decoded;
    } catch (e) {}
  }
  const sa = typeof str === 'string' ? JSON.parse(str) : str;
  if (sa && typeof sa.private_key === 'string') {
    let pk = sa.private_key.trim();
    if ((pk.startsWith('"') && pk.endsWith('"')) || (pk.startsWith("'") && pk.endsWith("'"))) {
      pk = pk.slice(1, -1);
    }
    pk = pk.replace(/\\n/g, '\n').replace(/\\r/g, '');
    sa.private_key = pk;
  }
  return sa;
}

function getAdminApp() {
  if (getApps().length) return getApp();
  const credential = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  return initializeApp({ credential: cert(credential) });
}

function response(statusCode, body, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

function allowedOrigin(event) {
  const origin = String(event.headers.origin || '');
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map(v => v.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? origin : '';
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

const LOOKUP_FIELDS = Object.freeze({
  regNo: ['boardRegNo', 'regNo', 'Registration No.', 'Registration Number', 'Board Registration No.'],
  formNo: ['formNo', 'FormNo', 'Form Number'],
  rollNo: ['classRollNo', 'rollNo', 'Class Roll No.', 'Class Roll No', 'Roll No.', 'Roll No'],
  certNo: ['certificateNo', 'Certificate No.', 'Certificate Number', 'Bonafide No.'],
});

function firstValue(data, fields) {
  for (const field of fields) {
    const value = data?.[field];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function approvedRecord(data) {
  const status = String(data?.Status || data?.status || data?.applicationStatus || '').trim().toLowerCase();
  return status === 'approved' && data?._deleted !== true && data?._purged !== true;
}

function publicStudentProjection(data) {
  const photo = firstValue(data, ['photoUrl', 'photoURL']);
  return {
    name: firstValue(data, ["Student's Name (as per school records)", "Student's Name", 'studentName', 'name']).slice(0, 100),
    fatherName: firstValue(data, ["Father's Name", 'fatherName']).slice(0, 100),
    className: firstValue(data, ['classCanonical', 'Admission sought for class', 'Class', 'className']).slice(0, 30),
    classRollNo: firstValue(data, LOOKUP_FIELDS.rollNo).slice(0, 30),
    session: firstValue(data, ['sessionCanonical', 'Session', 'session']).slice(0, 20),
    boardRegNo: firstValue(data, LOOKUP_FIELDS.regNo).slice(0, 64),
    formNo: firstValue(data, LOOKUP_FIELDS.formNo).slice(0, 32),
    certificateNo: firstValue(data, LOOKUP_FIELDS.certNo).slice(0, 64),
    photoUrl: /^https:\/\//i.test(photo) ? photo.slice(0, 2048) : null,
  };
}

function candidateValues(rawValue) {
  const raw = String(rawValue || '').trim();
  const values = new Set([raw, normalize(raw)]);
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isSafeInteger(numeric)) values.add(numeric);
  }
  return Array.from(values).filter(value => value !== '');
}

async function findApprovedApplication(db, type, rawQuery) {
  const matches = new Map();
  for (const field of LOOKUP_FIELDS[type]) {
    for (const value of candidateValues(rawQuery)) {
      const snapshot = await db.collection('admissions').where(field, '==', value).limit(3).get();
      snapshot.docs.forEach(doc => {
        if (approvedRecord(doc.data())) matches.set(doc.id, doc);
      });
    }
    if (matches.size) break;
  }
  return matches.values().next().value || null;
}

async function writeVerificationIndexes(db, indexSecret, student, sourceApplicationId) {
  const identifiers = {
    regNo: student.boardRegNo,
    formNo: student.formNo,
    certNo: student.certificateNo,
  };
  const batch = db.batch();
  let writes = 0;
  Object.entries(identifiers).forEach(([type, value]) => {
    const normalized = normalize(value);
    if (!normalized) return;
    const indexId = crypto.createHmac('sha256', indexSecret).update(`${type}:${normalized}`).digest('hex');
    batch.set(db.collection('studentVerificationIndex').doc(indexId), {
      ...student,
      sourceApplicationId,
      refreshedAt: Timestamp.now(),
    }, { merge: true });
    writes += 1;
  });
  if (writes) await batch.commit();
}

async function consumeRateLimit(db, ipHash) {
  const ref = db.collection('securityRateLimits').doc(`student_lookup_${ipHash}`);
  const now = Date.now();
  const windowMs = Math.max(10000, Number(process.env.LOOKUP_RATE_WINDOW_MS || 60000));
  const max = Math.min(20, Math.max(1, Number(process.env.LOOKUP_RATE_MAX || 8)));
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prior = snap.exists ? snap.data() : {};
    const resetAt = Number(prior.resetAt || 0);
    const count = resetAt > now ? Number(prior.count || 0) + 1 : 1;
    const nextReset = resetAt > now ? resetAt : now + windowMs;
    tx.set(ref, { count, resetAt: nextReset, expiresAt: Timestamp.fromMillis(nextReset + 86400000) });
    return count <= max;
  });
}

exports.handler = async function handler(event) {
  const origin = allowedOrigin(event);
  if (!origin) return response(403, { error: 'Request origin is not allowed.' });
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed.' }, origin);
  if (Buffer.byteLength(event.body || '', 'utf8') > 2048) return response(413, { error: 'Request too large.' }, origin);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return response(400, { error: 'Invalid request.' }, origin); }

  const type = body.type;
  const rawQuery = String(body.query || '').trim();
  const value = normalize(rawQuery);
  if (!['regNo', 'formNo', 'certNo'].includes(type) || value.length < 4 || value.length > 64 || !/^[a-z0-9/_.-]+$/.test(value)) {
    return response(400, { error: 'Invalid lookup value.' }, origin);
  }

  try {
    getAdminApp();
    const db = getFirestore(getAdminApp());
    const rateSecret = process.env.LOOKUP_RATE_SECRET;
    const indexSecret = process.env.LOOKUP_INDEX_SECRET;
    if (!rateSecret || rateSecret.length < 32 || !indexSecret || indexSecret.length < 32) {
      throw new Error('Lookup secrets are not securely configured');
    }
    const forwarded = String(event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ipHash = crypto.createHmac('sha256', rateSecret).update(forwarded || 'unknown').digest('hex').slice(0, 40);
    if (!(await consumeRateLimit(db, ipHash))) return response(429, { error: 'Too many requests. Try again later.' }, origin);

    const indexId = crypto.createHmac('sha256', indexSecret).update(`${type}:${value}`).digest('hex');
    const indexRef = db.collection('studentVerificationIndex').doc(indexId);
    const snap = await indexRef.get();
    const indexData = snap.exists ? (snap.data() || {}) : null;
    const refreshedAt = indexData?.refreshedAt?.toMillis?.() || 0;
    const indexIsFresh = refreshedAt > Date.now() - 24 * 60 * 60 * 1000;
    let student = indexIsFresh ? publicStudentProjection(indexData) : null;

    if (!student?.name) {
      const approvedApplication = await findApprovedApplication(db, type, rawQuery);
      if (!approvedApplication) {
        if (snap.exists) await indexRef.delete();
        return response(404, { error: 'No matching approved record was found.' }, origin);
      }
      student = publicStudentProjection(approvedApplication.data());
      await writeVerificationIndexes(db, indexSecret, student, approvedApplication.id);
    }
    return response(200, { student }, origin);
  } catch (error) {
    console.error('Student lookup failed:', error.message);
    if (error.status === 409) return response(409, { error: error.message }, origin);
    return response(503, { error: 'Lookup service is temporarily unavailable.' }, origin);
  }
};
