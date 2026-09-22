'use strict';

// Accept the JSON download, a JSON-encoded string, or its base64 encoding.
// Never include credential contents in errors returned to the client.
function parseServiceAccount(raw) {
  try {
    let value = String(raw || '').trim();
    if (!value) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not configured or empty in Netlify');
    }
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"') && value.length > 2)) {
      value = value.slice(1, -1).trim();
    }
    // If not starting with a JSON object bracket '{', attempt base64 decode
    if (!value.startsWith('{')) {
      try {
        const decoded = Buffer.from(value, 'base64').toString('utf8').trim();
        if (decoded.startsWith('{')) {
          value = decoded;
        }
      } catch (_) {
        // Fall back to direct parse
      }
    }
    let account;
    try {
      account = JSON.parse(value);
    } catch (_) {
      // If direct parse fails, handle escaped newlines or literal control chars
      const sanitized = value.replace(/[\r\n]/g, '\\n');
      account = JSON.parse(sanitized);
    }
    if (typeof account === 'string') account = JSON.parse(account);
    if (!account || typeof account !== 'object' || Array.isArray(account) ||
        !account.project_id || !account.client_email || typeof account.private_key !== 'string') {
      const missing = ['project_id', 'client_email', 'private_key'].filter(f => !account || !account[f]);
      throw new Error(`Missing required service account credential fields: ${missing.join(', ')}`);
    }
    account.private_key = account.private_key.trim().replace(/\\n/g, '\n').replace(/\\r/g, '');
    return account;
  } catch (err) {
    console.error('[serviceAccount] Configuration error:', err ? err.message : 'Unknown error');
    const error = new Error('Admission service configuration needs administrator attention. Your form has not been submitted. Please try again after the service is restored.');
    error.status = 503;
    error.code = 'admission/invalid-server-credentials';
    throw error;
  }
}

module.exports = { parseServiceAccount };
