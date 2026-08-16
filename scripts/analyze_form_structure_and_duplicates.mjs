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

async function fetchCollectionDocs(collName, token) {
  let docs = [];
  let pageToken = null;
  do {
    const endpoint = `/${collName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
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

async function run() {
  const token = await getAccessToken();

  console.log('=== 1. FORM STRUCTURE DUPLICATE & REDUNDANCY ANALYSIS ===');
  const formDocs = await fetchCollectionDocs('formStructure', token);
  const normalizedMap = new Map();
  const duplicateFields = [];

  formDocs.forEach(d => {
    const docId = d.name.split('/').pop();
    const data = parseFirestoreFields(d.fields);
    const rawName = data.fieldName || data['Field Name'] || docId;
    const norm = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (normalizedMap.has(norm)) {
      duplicateFields.push({
        existing: normalizedMap.get(norm),
        duplicate: { docId, rawName, data }
      });
    } else {
      normalizedMap.set(norm, { docId, rawName, data });
    }
  });

  console.log(`Found ${duplicateFields.length} duplicate/overlapping field definitions in formStructure:`);
  duplicateFields.forEach((dup, i) => {
    console.log(`\n  Duplicate #${i + 1}:`);
    console.log(`    Original : [${dup.existing.docId}] -> "${dup.existing.rawName}"`);
    console.log(`    Duplicate: [${dup.duplicate.docId}] -> "${dup.duplicate.rawName}"`);
  });

  console.log('\n=== 2. RECYCLE BIN & OTHER POTENTIAL ORPHAN RECORDS ===');
  const trashDocs = await fetchCollectionDocs('recycleBin', token);
  console.log(`Recycle Bin items (${trashDocs.length}):`);
  trashDocs.forEach(d => {
    const docId = d.name.split('/').pop();
    const data = parseFirestoreFields(d.fields);
    console.log(`- Trash Doc [${docId}]: FormNo: ${data.formNo || data.formNumber || data['Form Number']}, Name: ${data.name || data.studentName || data["Student's Name"]}, DeletedAt: ${data.deletedAt || data.timestamp}`);
  });

  const rateLimitDocs = await fetchCollectionDocs('securityRateLimits', token);
  console.log(`\nSecurity rate limit records (${rateLimitDocs.length}):`);
  rateLimitDocs.forEach(d => {
    console.log(`- ${d.name.split('/').pop()}`);
  });
}

run().catch(e => console.error(e));
