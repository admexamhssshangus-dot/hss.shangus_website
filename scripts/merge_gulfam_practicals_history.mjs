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
          const parsed = body ? JSON.parse(body) : {};
          resolve(parsed);
        } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseFirestoreFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.mapValue !== undefined) res[k] = parseFirestoreFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) {
      res[k] = (v.arrayValue.values || []).map(item => {
        if (item.stringValue !== undefined) return item.stringValue;
        if (item.mapValue !== undefined) return parseFirestoreFields(item.mapValue.fields);
        return item;
      });
    }
  }
  return res;
}

function valueToFirestore(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(valueToFirestore) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = valueToFirestore(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function run() {
  const token = await getAccessToken();
  console.log('✅ Got access token');

  const TARGET_TEACHER_EMAIL = 'socialshiftz@gmail.com';
  const ADMIN_EMAIL = 'e.educational.24@gmail.com';
  const TEACHER_NAME = 'Sheikh Gulfam';

  console.log(`\n🔄 Merging practicals history from ${ADMIN_EMAIL} into ${TARGET_TEACHER_EMAIL}...`);

  // 1. Scan and update practicalsData
  let pageToken = '';
  let updatedPracticalsCount = 0;
  do {
    const url = `/practicalsData?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const resp = await restRequest('GET', url, null, token);
    const docs = resp.documents || [];
    for (const d of docs) {
      const id = d.name.split('/').pop();
      const fields = parseFirestoreFields(d.fields);
      const str = JSON.stringify(fields).toLowerCase();

      const isMatch = str.includes('e.educational') || str.includes('socialshiftz') || str.includes('gulfam') || id.includes('_BO_') || id.includes('_Botany_');

      if (isMatch) {
        console.log(`Updating practicalsData doc: ${id}`);
        // Patch teacherEmail, submittedByEmail, teacherName
        const patchUrl = `/practicalsData/${id}?updateMask.fieldPaths=teacherEmail&updateMask.fieldPaths=submittedByEmail&updateMask.fieldPaths=teacherName`;
        const payload = {
          fields: {
            teacherEmail: valueToFirestore(TARGET_TEACHER_EMAIL),
            submittedByEmail: valueToFirestore(TARGET_TEACHER_EMAIL),
            teacherName: valueToFirestore(TEACHER_NAME)
          }
        };
        await restRequest('PATCH', patchUrl, payload, token);
        updatedPracticalsCount++;
      }
    }
    pageToken = resp.nextPageToken || '';
  } while (pageToken);

  console.log(`✅ Updated ${updatedPracticalsCount} documents in practicalsData to ${TARGET_TEACHER_EMAIL}`);

  // 2. Scan and update practicalsBin
  let binPageToken = '';
  let updatedBinCount = 0;
  try {
    do {
      const url = `/practicalsBin?pageSize=300${binPageToken ? `&pageToken=${binPageToken}` : ''}`;
      const resp = await restRequest('GET', url, null, token);
      const docs = resp.documents || [];
      for (const d of docs) {
        const id = d.name.split('/').pop();
        const fields = parseFirestoreFields(d.fields);
        const str = JSON.stringify(fields).toLowerCase();

        const isMatch = str.includes('e.educational') || str.includes('socialshiftz') || str.includes('gulfam') || id.includes('Botany') || id.includes('_BO_');

        if (isMatch) {
          console.log(`Updating practicalsBin doc: ${id}`);
          const patchUrl = `/practicalsBin/${id}?updateMask.fieldPaths=teacherEmail&updateMask.fieldPaths=submittedByEmail&updateMask.fieldPaths=teacherName`;
          const payload = {
            fields: {
              teacherEmail: valueToFirestore(TARGET_TEACHER_EMAIL),
              submittedByEmail: valueToFirestore(TARGET_TEACHER_EMAIL),
              teacherName: valueToFirestore(TEACHER_NAME)
            }
          };
          await restRequest('PATCH', patchUrl, payload, token);
          updatedBinCount++;
        }
      }
      binPageToken = resp.nextPageToken || '';
    } while (binPageToken);
    console.log(`✅ Updated ${updatedBinCount} documents in practicalsBin to ${TARGET_TEACHER_EMAIL}`);
  } catch (err) {
    console.log('practicalsBin note:', err.message);
  }

  // 3. Ensure adminPracticalsSettings/config has e.educational.24@gmail.com in excludedTeacherEmails
  try {
    const configResp = await restRequest('GET', '/adminPracticalsSettings/config', null, token);
    if (!configResp.error) {
      const configFields = parseFirestoreFields(configResp.fields);
      const existingEx = Array.isArray(configFields.excludedTeacherEmails) ? configFields.excludedTeacherEmails : [];
      if (!existingEx.includes(ADMIN_EMAIL)) {
        existingEx.push(ADMIN_EMAIL);
        const patchConfigUrl = '/adminPracticalsSettings/config?updateMask.fieldPaths=excludedTeacherEmails';
        const payload = {
          fields: {
            excludedTeacherEmails: valueToFirestore(existingEx)
          }
        };
        await restRequest('PATCH', patchConfigUrl, payload, token);
        console.log(`✅ Added ${ADMIN_EMAIL} to excludedTeacherEmails in adminPracticalsSettings/config`);
      } else {
        console.log(`ℹ️ ${ADMIN_EMAIL} is already in excludedTeacherEmails in adminPracticalsSettings/config`);
      }
    }
  } catch (err) {
    console.log('Config update note:', err.message);
  }

  console.log('\n🎉 Practical history merge completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
