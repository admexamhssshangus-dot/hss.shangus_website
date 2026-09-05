const test = require('node:test');
const assert = require('node:assert/strict');
const { parseServiceAccount } = require('../netlify/functions/lib/serviceAccount');
const credential = { project_id: 'test', client_email: 'test@example.invalid', private_key: 'test\\nkey' };
const json = JSON.stringify(credential);
for (const [name, value] of Object.entries({ raw: json, quoted: JSON.stringify(json), shell: `'${json}'`, base64: Buffer.from(json).toString('base64') })) {
  test(`accepts ${name} credential representation`, () => {
    assert.equal(parseServiceAccount(value).private_key, 'test\nkey');
  });
}
for (const value of ['', '{"project_id":"test",}', '{}', 'null', '[]']) {
  test(`rejects invalid credentials safely: ${value}`, () => {
    assert.throws(() => parseServiceAccount(value), error => error.status === 503 && error.code === 'admission/invalid-server-credentials' && !error.message.includes('JSON'));
  });
}
