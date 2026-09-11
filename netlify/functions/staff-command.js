'use strict';
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getAppCheck } = require('firebase-admin/app-check');
const { parseServiceAccount } = require('./lib/serviceAccount');

// Only these callable business operations are exposed. Auth triggers and legacy
// role/signing endpoints are deliberately absent.
const COMMANDS = new Set(['beginAdminVerification', 'approveAdminVerification',
  'cancelAdminVerification', 'manageStaffAccount', 'staffDirectory',
  'submitAcademicRecord', 'mutateFundDistribution', 'manageIssuedDocument', 'sendPracticalsEmail']);
const STATUS = { 'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403,
  'not-found': 404, 'already-exists': 409, 'failed-precondition': 412,
  'resource-exhausted': 429, unavailable: 503 };
function createHandler(dependencies = {}) {
  return async event => {
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const origin = headers.origin || '';
    const allowed = new Set(['https://hssshangus.netlify.app', 'https://admexamhssshangus.web.app',
      'https://hsssdb.web.app', ...String(process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim())]);
    const originAllowed = allowed.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const response = (statusCode, body) => ({ statusCode, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(originAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck',
    }, body: JSON.stringify(body) });
    if (!originAllowed) return response(403, { error: 'Origin not allowed.' });
    if (event.httpMethod === 'OPTIONS') return response(204, null);
    if (event.httpMethod !== 'POST') return response(405, { error: 'Use POST.' });
    if (!/^application\/json(?:;|$)/i.test(headers['content-type'] || '')) return response(415, { error: 'Use JSON.' });
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
    if (Buffer.byteLength(raw) > 1000000) return response(413, { error: 'Request too large.' });
    let body;
    try { body = JSON.parse(raw); } catch (_) { return response(400, { error: 'Invalid JSON.' }); }
    if (!body || !COMMANDS.has(body.command) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return response(400, { error: 'Invalid staff command.' });
    }
    try {
      let services = dependencies;
      if (!services.verifyAppCheck) {
        const app = getApps().length ? getApp() : initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
        const businessAdmin = require('../../functions/firebaseAdmin');
        if (!businessAdmin.getApps().length) {
          businessAdmin.initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
        }
        services = { verifyAppCheck: token => getAppCheck(app).verifyToken(token),
          verifyAuth: token => getAuth(app).verifyIdToken(token, true),
          run: (name, data, context) => require('../../functions/index')[name].run(data, context) };
      }
      if (!headers['x-firebase-appcheck']) return response(401, { error: 'App verification is required.' });
      let appToken;
      try { appToken = await services.verifyAppCheck(headers['x-firebase-appcheck']); }
      catch (_) { return response(401, { error: 'App verification failed. Check the App Check configuration.' }); }
      let auth;
      if (headers.authorization) {
        if (!headers.authorization.startsWith('Bearer ')) return response(401, { error: 'Invalid authentication.' });
        try { const token = await services.verifyAuth(headers.authorization.slice(7)); auth = { uid: token.uid, token }; }
        catch (_) { return response(401, { error: 'Your session has expired. Sign in again.' }); }
      }
      if (!auth && body.command !== 'approveAdminVerification') return response(401, { error: 'Sign in first.' });
      const data = await services.run(body.command, body.data, { auth, app: appToken });
      return response(200, { data });
    } catch (error) {
      const status = STATUS[error.code] || (error.status === 403 ? 403 : 503);
      return response(status, { error: status === 503 ? 'The staff service is unavailable. Check server configuration.' : error.message,
        code: error.code || 'unavailable' });
    }
  };
}
exports.handler = createHandler();
exports.createHandler = createHandler;
