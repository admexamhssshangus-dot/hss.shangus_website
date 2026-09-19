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

async function inspectPoliticalScience() {
  const token = await getAccessToken();

  const psRaw = await restRequest('GET', '/practicalsData/11th_Political Science_Pre-Board Test_2025-26', null, token);
  const ps = decodeDoc(psRaw);

  const records = ps.records || [];
  const scored = [];
  const absent = [];
  const blank = [];

  for (const r of records) {
    const m = r.totalMarks ?? r.practicalMarks;
    if (m === 'AB' || m === 'A' || String(m).toLowerCase() === 'absent') {
      absent.push(r);
    } else if (m === '' || m === null || m === undefined) {
      blank.push(r);
    } else {
      scored.push(r);
    }
  }

  console.log(`Total: ${records.length}, Scored: ${scored.length}, Absent: ${absent.length}, Blank: ${blank.length}`);
  console.log('\n--- 31 ABSENT STUDENTS ---');
  for (const r of absent) {
    console.log(`Roll ${r.rollNo} | Form ${r.formNo} | Reg ${r.regNo} | Name: ${r.name} | Marks: ${r.totalMarks}`);
  }

  console.log('\n--- SCORED STUDENTS SAMPLE ---');
  for (const r of scored.slice(0, 10)) {
    console.log(`Roll ${r.rollNo} | Form ${r.formNo} | Reg ${r.regNo} | Name: ${r.name} | Marks: ${r.totalMarks}`);
  }

  // Check if Tamana is in absent or scored:
  const tamana = records.find(r => String(r.name).toLowerCase().includes('tamana') || String(r.regNo).includes('2401010000200028'));
  console.log('\nTamana in records:', tamana);
}

inspectPoliticalScience().catch(console.error);
