import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sa = JSON.parse(fs.readFileSync(path.join(__dirname, 'serviceAccount.json'), 'utf8'));

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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d).access_token));
    });
    req.write(postData); req.end();
  });
}

function parseVal(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseVal);
  if ('mapValue' in val) {
    const o = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) o[k] = parseVal(v);
    return o;
  }
  return null;
}

async function run() {
  const token = await getAccessToken();
  const url = 'https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents/admissions/adm_250402';
  const res = await new Promise(r => {
    https.get(url, { headers: { Authorization: 'Bearer ' + token } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    });
  });

  const f = res.fields || {};
  const o = {};
  for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
  console.log('adm_250402 fields:', JSON.stringify(o, null, 2));
}

run().catch(console.error);
