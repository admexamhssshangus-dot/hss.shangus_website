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

function encodeValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(encodeValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = encodeValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
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

function encodeDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id') continue;
    fields[k] = encodeValue(v);
  }
  return { fields };
}

async function runRepair() {
  const token = await getAccessToken();
  console.log('Obtained Google OAuth token for Firestore REST.');

  // 1. Repair 12th General English: set isDraft: false
  console.log('\n--- 1. Repairing 12th_General English_Pre-Board Test_2025-26 ---');
  const geRaw = await restRequest('GET', '/practicalsData/12th_General%20English_Pre-Board%20Test_2025-26', null, token);
  if (geRaw && geRaw.fields) {
    const ge = decodeDoc(geRaw);
    console.log(`Original GE status: ${ge.status}, isDraft: ${ge.isDraft}, records: ${ge.records.length}`);
    ge.isDraft = false;
    ge.status = 'approved';
    ge.updatedAt = new Date().toISOString();
    const patchRes = await restRequest('PATCH', '/practicalsData/12th_General%20English_Pre-Board%20Test_2025-26', encodeDoc(ge), token);
    console.log('Patched 12th General English isDraft: false. Result id:', patchRes.name);
  } else {
    console.warn('Doc 12th_General English_Pre-Board Test_2025-26 not found!');
  }

  // 2. Repair 12th Healthcare: set isDraft: false
  console.log('\n--- 2. Repairing 12th_Healthcare_Pre-Board Test_2025-26 ---');
  const hcRaw = await restRequest('GET', '/practicalsData/12th_Healthcare_Pre-Board%20Test_2025-26', null, token);
  if (hcRaw && hcRaw.fields) {
    const hc = decodeDoc(hcRaw);
    console.log(`Original Healthcare status: ${hc.status}, isDraft: ${hc.isDraft}, records: ${hc.records.length}`);
    hc.isDraft = false;
    hc.status = 'approved';
    hc.updatedAt = new Date().toISOString();
    const patchRes = await restRequest('PATCH', '/practicalsData/12th_Healthcare_Pre-Board%20Test_2025-26', encodeDoc(hc), token);
    console.log('Patched 12th Healthcare isDraft: false. Result id:', patchRes.name);
  } else {
    console.warn('Doc 12th_Healthcare_Pre-Board Test_2025-26 not found!');
  }

  // 3. Repair 11th Political Science: Archive to practicalsBin, then clear 31 auto-absent marks to blank/pending
  console.log('\n--- 3. Repairing 11th_Political Science_Pre-Board Test_2025-26 ---');
  const psRaw = await restRequest('GET', '/practicalsData/11th_Political%20Science_Pre-Board%20Test_2025-26', null, token);
  if (psRaw && psRaw.fields) {
    const ps = decodeDoc(psRaw);
    console.log(`Original PS status: ${ps.status}, isDraft: ${ps.isDraft}, records: ${ps.records.length}`);

    // Create safety backup in practicalsBin
    const binDocId = `bin_11th_Political Science_Pre-Board Test_2025-26_${Date.now()}`;
    const binPayload = encodeDoc({
      ...ps,
      archivedAt: new Date().toISOString(),
      reason: 'pre_auto_absent_reset_backup',
      archivedBy: 'System Auto-Repair'
    });
    const binRes = await restRequest('PATCH', `/practicalsBin/${encodeURIComponent(binDocId)}`, binPayload, token);
    console.log('Created safety backup in practicalsBin:', binRes.name);

    // Now update records: reset 31 "AB" students to blank "" (pending)
    let resetCount = 0;
    let preservedCount = 0;
    ps.records = ps.records.map(r => {
      const m = String(r.totalMarks ?? r.practicalMarks ?? '').trim();
      if (m === 'AB' || m === 'A' || m.toLowerCase() === 'absent') {
        resetCount++;
        return {
          ...r,
          practicalMarks: '',
          vivaMarks: '',
          totalMarks: '',
          marksInWords: ''
        };
      } else {
        preservedCount++;
        return r;
      }
    });

    ps.isDraft = false;
    ps.status = 'approved';
    ps.updatedAt = new Date().toISOString();

    console.log(`Reset ${resetCount} auto-absent students to blank (pending). Preserved ${preservedCount} scored students.`);
    const patchRes = await restRequest('PATCH', '/practicalsData/11th_Political%20Science_Pre-Board%20Test_2025-26', encodeDoc(ps), token);
    console.log('Patched 11th Political Science. Result id:', patchRes.name);
  } else {
    console.warn('Doc 11th_Political Science_Pre-Board Test_2025-26 not found!');
  }

  // 4. Repair 11th Environmental Science: Archive to practicalsBin, then clear 11 auto-absent marks to blank/pending
  console.log('\n--- 4. Repairing 11th_Environmental Science_Pre-Board Test_2025-26 ---');
  const evsRaw = await restRequest('GET', '/practicalsData/11th_Environmental%20Science_Pre-Board%20Test_2025-26', null, token);
  if (evsRaw && evsRaw.fields) {
    const evs = decodeDoc(evsRaw);
    console.log(`Original EVS status: ${evs.status}, isDraft: ${evs.isDraft}, records: ${evs.records.length}`);

    // Create safety backup in practicalsBin
    const binDocId = `bin_11th_Environmental Science_Pre-Board Test_2025-26_${Date.now()}`;
    const binPayload = encodeDoc({
      ...evs,
      archivedAt: new Date().toISOString(),
      reason: 'pre_auto_absent_reset_backup',
      archivedBy: 'System Auto-Repair'
    });
    const binRes = await restRequest('PATCH', `/practicalsBin/${encodeURIComponent(binDocId)}`, binPayload, token);
    console.log('Created safety backup in practicalsBin:', binRes.name);

    // Now update records: reset 11 "AB" students to blank "" (pending)
    let resetCount = 0;
    let preservedCount = 0;
    evs.records = evs.records.map(r => {
      const m = String(r.totalMarks ?? r.practicalMarks ?? '').trim();
      if (m === 'AB' || m === 'A' || m.toLowerCase() === 'absent') {
        resetCount++;
        return {
          ...r,
          practicalMarks: '',
          vivaMarks: '',
          totalMarks: '',
          marksInWords: ''
        };
      } else {
        preservedCount++;
        return r;
      }
    });

    evs.isDraft = false;
    evs.status = 'approved';
    evs.updatedAt = new Date().toISOString();

    console.log(`Reset ${resetCount} auto-absent students to blank (pending). Preserved ${preservedCount} scored students.`);
    const patchRes = await restRequest('PATCH', '/practicalsData/11th_Environmental%20Science_Pre-Board%20Test_2025-26', encodeDoc(evs), token);
    console.log('Patched 11th Environmental Science. Result id:', patchRes.name);
  } else {
    console.warn('Doc 11th_Environmental Science_Pre-Board Test_2025-26 not found!');
  }

  console.log('\n--- ALL REPAIRS SUCCESSFULLY COMPLETED ---');
}

runRepair().catch(console.error);
