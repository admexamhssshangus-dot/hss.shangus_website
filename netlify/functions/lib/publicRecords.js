'use strict';
const crypto = require('crypto');
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { parseServiceAccount } = require('./serviceAccount');
const { isStudentAdmissionApproved } = require('../../../functions/admissionStatus');
const normalize = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
const classKey = value => String(value || '').match(/\d+/)?.[0] || '';
const sessionKey = value => {
  const text = String(value || ''); const match = text.match(/(20\d{2})\s*[-/]\s*(\d{2,4})/);
  if (match) return `${match[1]}-${match[2].slice(-2)}`;
  if (/^20\d{2}$/.test(text)) return `${Number(text) - 1}-${text.slice(-2)}`;
  return normalize(text);
};
const first = (data, keys) => keys.map(key => data?.[key]).find(value => value !== undefined && value !== null && !/^(\s*|[-—]+|n\/?a|null|undefined)$/i.test(String(value))) || '';
const FIELDS = {
  formNo: ['formNo', 'Form Number', 'Form No.', 'FormNo'],
  regNo: [
    'boardRegNo', 'regNo', 'Board Registration Number', 'Board Reg. No.',
    'Board Registration No. (Class 11th)', 'Board Registration No. (Class 10th)',
    'Board Registration No. (Class 9th)', 'DIET Registration No.',
    'Registration No. (allotted by JKBOSE)', 'Registration No. (allotted by JKBOSE )',
    'Registration No.', 'Reg. No.'
  ],
  rollNo: ['classRollNo', 'Class Roll No', 'Class Roll No.', 'rollNo', 'examRollNo']
};
function studentProjection(data) {
  return {
    name: first(data, ["Student's Name (as per school records)", "Student's Name", 'studentName', 'name']),
    fatherName: first(data, ["Father's/Guardian's Name (as per school records)", "Father's Name", 'fatherName']),
    formNo: first(data, FIELDS.formNo), boardRegNo: first(data, FIELDS.regNo), classRollNo: first(data, FIELDS.rollNo),
    className: first(data, ['classCanonical', 'Admission sought for class', 'Class', 'className', 'class']),
    session: first(data, ['sessionCanonical', 'Session', 'session', 'Academic Session']),
    stream: first(data, ['Stream', 'stream', 'Stream for Class 11th', 'Stream for Class 12th'])
  };
}
function approved(data) {
  return data && !data._deleted && !data._purged && !data.archivedAt && isStudentAdmissionApproved(data);
}
async function findStudent(db, body) {
  const matches = new Map();
  const types = body.type ? [body.type] : ['regNo', 'formNo', 'rollNo'];
  for (const type of types) {
    for (const field of FIELDS[type] || []) {
      const values = [...new Set([String(body.query).trim(), normalize(body.query), String(body.query).trim().toUpperCase()])];
      for (const value of values) {
        let query = db.collection('admissions').where(new FieldPath(field), '==', value);
        const page = await query.limit(20).get();
        if (page.size === 20) throw Object.assign(new Error('Use a unique form or registration number.'), { status: 409 });
        for (const snap of page.docs) {
          const data = snap.data(), student = studentProjection(data);
          if (approved(data) && (!body.className || classKey(student.className) === classKey(body.className)) &&
            (!body.session || sessionKey(student.session) === sessionKey(body.session))) matches.set(snap.id, { id: snap.id, data, student });
        }
      }
    }
  }
  if (matches.size !== 1) throw Object.assign(new Error(matches.size ? 'More than one matching record exists. Contact the school.' : 'No matching approved student was found.'), { status: matches.size ? 409 : 404 });
  return [...matches.values()][0];
}
function documentType(value) {
  const text = String(value || '').replace(/\s*\([^)]*\)/g, '').trim().slice(0, 32).toLowerCase();
  return /discharge|transfer|tc\s*\/\s*dc|character.*discharg/.test(text) ? 'tc-dc' : text;
}
function issueKey(certNo, type, reg) { return crypto.createHash('sha256').update(`${normalize(certNo)}::${documentType(type)}::${normalize(reg)}`).digest('hex'); }
async function loadSource(db, sourceDocument, identity, followedArchive = false) {
  if (!/^(admissions|masterRegisters)\/[^/]{1,256}$/.test(sourceDocument || '')) return null;
  const snap = await db.doc(sourceDocument).get(); if (!snap.exists) return null;
  const data = snap.data();
  if (data._archivedTo) {
    if (followedArchive || !sourceDocument.startsWith('admissions/') ||
      !/^masterRegisters\/archive_[^/]+$/.test(data._archivedTo)) return null;
    return loadSource(db, data._archivedTo, identity, true);
  }
  const records = ['items', 'students', 'records', 'data'].map(key => data[key]).find(Array.isArray);
  if (!records) {
    const student = studentProjection(data);
    if ((identity.session && sessionKey(student.session) !== sessionKey(identity.session)) ||
        (identity.className && classKey(student.className) !== classKey(identity.className))) return null;
    return data;
  }
  const matches = records.filter(record => normalize(first(record, FIELDS.regNo)) === normalize(identity.regNo) &&
    (!identity.session || sessionKey(studentProjection({ ...data, ...record }).session) === sessionKey(identity.session)) &&
    (!identity.className || classKey(studentProjection({ ...data, ...record }).className) === classKey(identity.className)));
  return matches.length === 1 ? { Session: data.session || data.Session, Class: data.class || data.Class, ...matches[0] } : null;
}
function createHandler(operation) {
  return async event => {
    const requestedOrigin = event.headers?.origin || '';
    const allowed = [process.env.URL, process.env.DEPLOY_PRIME_URL, 'https://hssshangus.netlify.app', 'https://admexamhssshangus.web.app', 'https://hsssdb.web.app', ...String(process.env.ALLOWED_ORIGINS || '').split(',')].filter(Boolean);
    const origin = allowed.includes(requestedOrigin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestedOrigin) ? requestedOrigin : '';
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) };
    const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
    if (requestedOrigin && !origin) return respond(403, { error: 'Origin is not allowed.' });
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
    if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed.' });
    if (Buffer.byteLength(event.body || '') > 2048) return respond(413, { error: 'Request too large.' });
    let body; try { body = JSON.parse(event.body || '{}'); } catch (_) { return respond(400, { error: 'Invalid request.' }); }
    if (!body || Array.isArray(body) || typeof body !== 'object') return respond(400, { error: 'Invalid request.' });
    try {
      const secret = process.env.LOOKUP_RATE_SECRET;
      if (!secret || secret.length < 32) throw new Error('Lookup rate limiting is not configured.');
      const app = getApps().length ? getApp() : initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
      const db = getFirestore(app);
      const ip = event.headers?.['x-nf-client-connection-ip'] || 'unknown';
      const id = crypto.createHmac('sha256', secret).update(ip).digest('hex');
      const ref = db.collection('securityRateLimits').doc(`public_${id}`);
      const allowedRequest = await db.runTransaction(async tx => {
        const snap = await tx.get(ref); const now = Date.now();
        const old = snap.data() || {}; const resetAt = old.resetAt > now ? old.resetAt : now + 60000;
        const count = old.resetAt > now ? old.count + 1 : 1;
        tx.set(ref, { resetAt, count, expiresAt: Timestamp.fromMillis(resetAt + 86400000) });
        return count <= 12;
      });
      if (!allowedRequest) return respond(429, { error: 'Too many lookups. Try again in a minute.' });
      return respond(200, await operation(db, body));
    } catch (error) {
      if (!error.status) console.error('Public lookup unavailable:', error.message);
      return respond(error.status || 503, { error: error.status ? error.message : 'The lookup service is temporarily unavailable.' });
    }
  };
}
module.exports = { normalize, classKey, sessionKey, first, FIELDS, approved, findStudent, studentProjection, documentType, issueKey, loadSource, createHandler };
