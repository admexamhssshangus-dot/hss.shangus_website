import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

const SA_PATH = 'scripts/serviceAccount.json';
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const PROJECT_ID = sa.project_id || 'hsssdb';

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(header + '.' + claim);
    const sig = signer.sign(sa.private_key, 'base64url');
    const jwt = header + '.' + claim + '.' + sig;
    const postData = 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt;

    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error('Token error: ' + body));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function restRequest(method, endpoint, payload, token) {
  return new Promise((resolve, reject) => {
    const u = new URL('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents' + endpoint);
    const data = payload ? JSON.stringify(payload) : null;

    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve({ error: e.message, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function decodeValue(val) {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(decodeValue);
  if (val.mapValue !== undefined) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = decodeValue(v);
    }
    return res;
  }
  return null;
}

function decodeDoc(doc) {
  if (!doc || !doc.fields) return null;
  const res = { id: doc.name ? doc.name.split('/').pop() : '' };
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = decodeValue(v);
  }
  return res;
}

async function inspectBinDocs() {
  const token = await getAccessToken();

  const bin1 = decodeDoc(await restRequest('GET', '/practicalsBin/bin_11th_Political%20Science_Pre-Board%20Test_2025-26_1789801388911', null, token));
  const bin2 = decodeDoc(await restRequest('GET', '/practicalsBin/bin_11th_Political%20Science_Pre-Board%20Test_2025-26_1789810806714', null, token));

  console.log('Bin 1 info:', {
    id: bin1.id,
    reason: bin1.reason,
    timestamp: bin1.timestamp,
    status: bin1.status,
    recordsCount: (bin1.records || []).length
  });

  console.log('Bin 2 info:', {
    id: bin2.id,
    reason: bin2.reason,
    timestamp: bin2.timestamp,
    status: bin2.status,
    recordsCount: (bin2.records || []).length
  });
}

inspectBinDocs().catch(console.error);
