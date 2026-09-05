'use strict';

// Accept the JSON download, a JSON-encoded string, or its base64 encoding.
// Never include credential contents in errors returned to the client.
function parseServiceAccount(raw) {
  try {
    let value = String(raw || '').trim();
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).trim();
    if (!value.startsWith('{') && !value.startsWith('"')) {
      value = Buffer.from(value, 'base64').toString('utf8').trim();
    }
    let account = JSON.parse(value);
    if (typeof account === 'string') account = JSON.parse(account);
    if (!account || typeof account !== 'object' || Array.isArray(account) ||
        !account.project_id || !account.client_email || typeof account.private_key !== 'string') {
      throw new Error('Missing credential fields');
    }
    account.private_key = account.private_key.trim().replace(/\\n/g, '\n').replace(/\\r/g, '');
    return account;
  } catch (_) {
    const error = new Error('Admission service configuration needs administrator attention. Your form has not been submitted. Please try again after the service is restored.');
    error.status = 503;
    error.code = 'admission/invalid-server-credentials';
    throw error;
  }
}

module.exports = { parseServiceAccount };
