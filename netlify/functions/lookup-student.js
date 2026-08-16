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
  const value = normalize(body.query);
  if (!['regNo', 'formNo'].includes(type) || value.length < 4 || value.length > 64 || !/^[a-z0-9/_.-]+$/.test(value)) {
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
    const snap = await db.collection('studentVerificationIndex').doc(indexId).get();
    if (!snap.exists) return response(404, { error: 'No matching record was found.' }, origin);
    const data = snap.data() || {};
    const student = {
      name: String(data.name || '').slice(0, 100),
      fatherName: String(data.fatherName || '').slice(0, 100),
      className: String(data.className || '').slice(0, 30),
      classRollNo: String(data.classRollNo || '').slice(0, 30),
      session: String(data.session || '').slice(0, 20),
      boardRegNo: String(data.boardRegNo || '').slice(0, 64),
      formNo: String(data.formNo || '').slice(0, 32),
      photoUrl: typeof data.photoUrl === 'string' && /^https:\/\//.test(data.photoUrl) ? data.photoUrl.slice(0, 2048) : null,
    };
    return response(200, { student }, origin);
  } catch (error) {
    console.error('Student lookup failed:', error.message);
    return response(503, { error: 'Lookup service is temporarily unavailable.' }, origin);
  }
};
