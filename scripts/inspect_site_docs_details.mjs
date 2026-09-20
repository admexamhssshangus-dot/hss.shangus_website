import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';

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

async function check() {
  const token = await getAccessToken();
  for (const docId of ['slideshow', 'faculty']) {
    const u = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/site/${docId}`);
    const res = await fetch(u, { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    console.log(`\n=== site/${docId} ===`);
    console.log('Doc size bytes:', JSON.stringify(json).length);
    console.log('Fields:', Object.keys(json.fields || {}));
    if (json.fields?.items?.arrayValue?.values) {
      console.log('items count:', json.fields.items.arrayValue.values.length);
      const items = json.fields.items.arrayValue.values;
      let imgCount = 0;
      let imgBytes = 0;
      items.forEach(item => {
        const itemFields = item.mapValue?.fields || {};
        for (const [k, v] of Object.entries(itemFields)) {
          if (v.stringValue && (v.stringValue.startsWith('data:image') || v.stringValue.length > 500)) {
            imgCount++;
            imgBytes += v.stringValue.length;
          }
        }
      });
      console.log(`Large strings/Base64 in items: count=${imgCount}, totalBytes=${imgBytes} (~${Math.round(imgBytes/1024)} KB)`);
    }
  }

  console.log(`\n=== attendance/11th_2026-08-12_BO ===`);
  const uAtt = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/attendance/11th_2026-08-12_BO`);
  const resAtt = await fetch(uAtt, { headers: { Authorization: 'Bearer ' + token } });
  const jsonAtt = await resAtt.json();
  const keysAtt = Object.keys(jsonAtt.fields || {});
  console.log('Total keys on doc:', keysAtt.length);
  console.log('Sample keys (first 20):', keysAtt.slice(0, 20));
  if (jsonAtt.fields?.records) {
    console.log('records size bytes:', JSON.stringify(jsonAtt.fields.records).length);
  }
}

check().catch(console.error);
