'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../netlify/functions/admission-workflow.js'), 'utf8');
async function check(code, expectedStatus) {
  const context = {
    exports: {}, Buffer, process: { env: {} }, console: { error() {} },
    require(name) {
      if (name === 'crypto') return require(name);
      if (name === './lib/serviceAccount') return { parseServiceAccount: () => ({}) };
      if (name === 'firebase-admin/app') return {
        getApps: () => [], cert: () => { throw Object.assign(new Error('Test service failure'), { code }); },
      };
      return {};
    },
  };
  vm.runInNewContext(source, context);
  const result = await context.exports.handler({ httpMethod: 'POST', headers: { origin: 'https://hssshangus.netlify.app' }, body: '{"action":"load"}' });
  assert.equal(result.statusCode, expectedStatus);
  assert(!result.body.includes('startsWith'));
  if (code === 8) assert.equal(JSON.parse(result.body).code, 'admission/quota-exhausted');
}
(async () => {
  await check(8, 503);
  await check(7, 500);
  await check('auth/id-token-expired', 401);
  const form = fs.readFileSync(require('node:path').join(__dirname, '../src/portal/student/AdmissionForm.jsx'), 'utf8');
  assert(!form.includes('checkDuplicateMobileInSession'), 'Student form must not scan other applicants');
  console.log('Admission error handler and student privacy checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
