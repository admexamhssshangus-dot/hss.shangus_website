import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SA_PATH = path.join(__dirname, 'serviceAccount.json');
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
          else reject(new Error(`Token error: ${body}`));
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
    const u = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents${endpoint}`);
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

async function search() {
  const token = await getAccessToken();
  console.log('Access token acquired.');

  const docIds = [
    'practicalsData/11th_Political Science_Pre-Board Test_2025-26',
    'practicalsData/pending_11th_Political Science_Pre-Board Test_2025-26',
    'practicalsData/11th_Political%20Science_Pre-Board%20Test_2025-26',
    'practicalsData/pending_11th_Political%20Science_Pre-Board%20Test_2025-26'
  ];

  for (const p of docIds) {
    const raw = await restRequest('GET', `/${p}`, null, token);
    if (raw && raw.fields) {
      const decoded = decodeDoc(raw);
      console.log(`\nChecked doc: ${decoded.id}`);
      if (Array.isArray(decoded.records)) {
        const found = decoded.records.filter(r => 
          String(r.regNo || '').includes('2401010000200028') || 
          String(r.name || '').toLowerCase().includes('tamana')
        );
        console.log(`Found in ${decoded.id}:`, JSON.stringify(found, null, 2));
      }
    }
  }

  // Check practicalsBin
  console.log('\nChecking practicalsBin...');
  const binRaw = await restRequest('GET', `/practicalsBin?pageSize=100`, null, token);
  if (binRaw && binRaw.documents) {
    for (const d of binRaw.documents) {
      const decoded = decodeDoc(d);
      const recs = decoded.records || (decoded.data && decoded.data.records);
      if (Array.isArray(recs)) {
        const found = recs.filter(r => 
          String(r.regNo || '').includes('2401010000200028') || 
          String(r.name || '').toLowerCase().includes('tamana')
        );
        if (found.length > 0) {
          console.log(`Found in practicalsBin doc: ${decoded.id} (reason: ${decoded.reason}, time: ${decoded.timestamp}):`, JSON.stringify(found, null, 2));
        }
      }
    }
  }

  // Check activityLogs for any mention of tamana or political science
  console.log('\nChecking recent activityLogs for Political Science...');
  const logsRaw = await restRequest('GET', `/activityLogs?pageSize=100`, null, token);
  if (logsRaw && logsRaw.documents) {
    for (const d of logsRaw.documents) {
      const decoded = decodeDoc(d);
      const str = JSON.stringify(decoded).toLowerCase();
      if (str.includes('political') || str.includes('tamana') || str.includes('2401010000200028')) {
        console.log(`Log ${decoded.id}:`, decoded.activityType, decoded.subject, decoded.className, decoded.timestamp || decoded.createdAt);
      }
    }
  }
}

search().catch(console.error);
