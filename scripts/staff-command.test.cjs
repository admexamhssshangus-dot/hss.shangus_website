'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../netlify/functions/staff-command');
const request = (command = 'staffDirectory', overrides = {}) => ({ httpMethod: 'POST',
  headers: { origin: 'http://localhost:3000', 'content-type': 'application/json',
    'x-firebase-appcheck': 'attestation', authorization: 'Bearer id-token' },
  body: JSON.stringify({ command, data: {} }), ...overrides });
const valid = { verifyAppCheck: async () => ({ appId: 'app' }),
  verifyAuth: async () => ({ uid: 'staff', email_verified: true }),
  run: async () => ({ success: true }) };
test('unknown operations and background triggers cannot be dispatched', async () => {
  for (const command of ['initializeUserClaims', 'setUserAccess', '__proto__']) {
    assert.equal((await createHandler(valid)(request(command))).statusCode, 400);
  }
});
test('verified credentials form the server context; client context is ignored', async () => {
  const handler = createHandler({ ...valid, run: async (name, data, context) => {
    assert.equal(context.auth.uid, 'staff'); assert.equal(context.app.appId, 'app'); return {};
  } });
  const r = request(); r.body = JSON.stringify({command:'staffDirectory',data:{auth:{uid:'forged'}}});
  assert.equal((await handler(r)).statusCode, 200);
});
test('invalid attestation or revoked authentication blocks operations', async () => {
  for (const key of ['verifyAppCheck', 'verifyAuth']) {
    let ran = false;
    const handler = createHandler({ ...valid, [key]: async () => { throw Error('invalid'); }, run: async () => { ran = true; } });
    assert.equal((await handler(request())).statusCode, 401); assert.equal(ran, false);
  }
});
test('only inbox-proof approval can reach business validation without a login token', async () => {
  const r = request('approveAdminVerification'); delete r.headers.authorization;
  assert.equal((await createHandler(valid)(r)).statusCode, 200);
  r.body = JSON.stringify({command:'beginAdminVerification',data:{}});
  assert.equal((await createHandler(valid)(r)).statusCode, 401);
});
test('rejects hostile origins and oversized input', async () => {
  const r = request(); r.headers.origin = 'https://evil.example';
  assert.equal((await createHandler(valid)(r)).statusCode, 403);
  assert.equal((await createHandler(valid)(request('staffDirectory',{body:'x'.repeat(1000001)}))).statusCode, 413);
});
test('business authorization failures retain their status', async () => {
  const handler = createHandler({...valid,run:async()=>{throw Object.assign(Error('Not assigned'),{code:'permission-denied'});}});
  assert.equal((await handler(request())).statusCode,403);
});
