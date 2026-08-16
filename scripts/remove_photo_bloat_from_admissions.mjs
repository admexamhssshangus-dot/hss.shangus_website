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

async function fetchAllAdmissions(token) {
  let docs = [];
  let pageToken = null;
  do {
    const endpoint = `/admissions?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await restRequest('GET', endpoint, null, token);
    if (res.documents) docs.push(...res.documents);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return docs;
}

function parseFirestoreFields(fields) {
  const obj = {};
  if (!fields) return obj;
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) obj[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.mapValue !== undefined) obj[k] = parseFirestoreFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) obj[k] = (v.arrayValue.values || []).map(item => parseFirestoreFields({ x: item }).x);
    else if (v.nullValue !== undefined) obj[k] = null;
  }
  return obj;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: String(v) };
      else fields[k] = { doubleValue: v };
    } else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) {
      if (v.length === 0) continue;
      fields[k] = { arrayValue: { values: v.map(item => toFirestoreFields({ x: item }).x).filter(Boolean) } };
    } else if (typeof v === 'object') {
      const sub = toFirestoreFields(v);
      if (Object.keys(sub).length > 0) fields[k] = { mapValue: { fields: sub } };
    }
  }
  return fields;
}

const PHOTO_KEYS_TO_STRIP = [
  'photo_id', 'Student Photo', 'Student Photograph', 'Student Photo URL',
  'photoUrl', 'photoId', 'photo', 'Photo', 'studentPhoto', 'studentPhotoUrl',
  'photoPath', 'photo_source_filename', 'photo_synced_at'
];

async function run() {
  console.log('🚀 STRIPPING REDUNDANT PHOTO DATA & EMPTY FIELDS FROM ADMISSION DOCUMENTS...\n');

  const token = await getAccessToken();
  const rawDocs = await fetchAllAdmissions(token);
  console.log(`📥 Fetched ${rawDocs.length} admission documents.`);

  let strippedCount = 0;
  const writeCommits = [];

  for (const d of rawDocs) {
    const docPath = d.name.replace(`projects/${PROJECT_ID}/databases/(default)/documents/`, '');
    const data = parseFirestoreFields(d.fields);

    const cleanData = {};
    let hadPhoto = false;

    for (const [k, v] of Object.entries(data)) {
      if (PHOTO_KEYS_TO_STRIP.includes(k)) {
        hadPhoto = true;
        continue; // do NOT include photo payload in admissions doc
      }
      if (v === '' || v === null || v === undefined) {
        continue; // strip empty fields
      }
      cleanData[k] = v;
    }

    if (hadPhoto) strippedCount++;

    writeCommits.push({
      docPath,
      fields: toFirestoreFields(cleanData)
    });
  }

  console.log(`\n📊 Strip summary: ${strippedCount} documents had embedded photo fields that will be removed.`);
  console.log('💾 Executing batch updates...');

  const BATCH_SIZE = 50;
  for (let i = 0; i < writeCommits.length; i += BATCH_SIZE) {
    const batch = writeCommits.slice(i, i + BATCH_SIZE);
    const writes = batch.map(item => ({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/${item.docPath}`,
        fields: item.fields
      }
    }));

    const res = await restRequest('POST', ':commit', { writes }, token);
    if (res.error) {
      console.error(`❌ Batch error at ${i}:`, res.error);
    } else {
      console.log(`  ⚡ Cleaned batch ${i + 1} to ${Math.min(i + BATCH_SIZE, writeCommits.length)} of ${writeCommits.length}...`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n🎉 ALL ADMISSIONS DOCUMENTS ARE NOW LIGHTWEIGHT AND FREE OF REDUNDANT PHOTO DATA!');
}

run().catch(e => console.error(e));
