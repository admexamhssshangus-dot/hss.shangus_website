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

async function fetchCollectionDocs(collName, token, limit = 5000) {
  let docs = [];
  let pageToken = null;
  do {
    const endpoint = `/${collName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await restRequest('GET', endpoint, null, token);
    if (res.documents) docs.push(...res.documents);
    pageToken = res.nextPageToken;
    if (docs.length >= limit) break;
  } while (pageToken);
  return docs;
}

async function analyzeCollection(name, token) {
  console.log(`\n========================================`);
  console.log(`🔍 ANALYZING: ${name}`);
  console.log(`========================================`);
  const docs = await fetchCollectionDocs(name, token);
  console.log(`Total docs: ${docs.length}`);

  let totalRawBytes = 0;
  const fieldSizes = {};
  const fieldCounts = {};
  let base64Count = 0;
  let base64Bytes = 0;
  const largeDocs = [];

  for (const doc of docs) {
    const rawLen = JSON.stringify(doc).length;
    totalRawBytes += rawLen;
    const docId = doc.name.split('/').pop();
    if (rawLen > 50 * 1024) { // > 50KB
      largeDocs.push({ docId, sizeKb: Math.round(rawLen / 1024) });
    }

    if (!doc.fields) continue;
    for (const [k, v] of Object.entries(doc.fields)) {
      const vStr = JSON.stringify(v);
      const vLen = vStr.length;
      fieldSizes[k] = (fieldSizes[k] || 0) + vLen;
      fieldCounts[k] = (fieldCounts[k] || 0) + 1;

      if (v.stringValue && (v.stringValue.startsWith('data:image') || (v.stringValue.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(v.stringValue.slice(0, 100))))) {
        base64Count++;
        base64Bytes += v.stringValue.length;
      }
    }
  }

  console.log(`Total size: ${Math.round(totalRawBytes / 1024)} KB (${(totalRawBytes / (1024 * 1024)).toFixed(2)} MB)`);
  if (base64Count > 0) {
    console.log(`⚠️ BASE64 IMAGES FOUND: ${base64Count} occurrences, total ${(base64Bytes / (1024 * 1024)).toFixed(2)} MB`);
  }
  if (largeDocs.length > 0) {
    console.log(`Top large docs (>50KB):`, largeDocs.sort((a, b) => b.sizeKb - a.sizeKb).slice(0, 10));
  }

  // Top fields by size
  const sortedFields = Object.entries(fieldSizes).sort((a, b) => b[1] - a[1]);
  console.log(`Top 10 largest fields by payload size:`);
  sortedFields.slice(0, 10).forEach(([f, size]) => {
    console.log(`  - "${f}": ${Math.round(size / 1024)} KB (present in ${fieldCounts[f]}/${docs.length} docs)`);
  });
}

async function run() {
  const token = await getAccessToken();
  await analyzeCollection('studentPhotos', token);
  await analyzeCollection('masterRegisters', token);
  await analyzeCollection('admissions', token);
  await analyzeCollection('site', token);
  await analyzeCollection('practicalsData', token);
  await analyzeCollection('generatedDocumentHistory', token);
  await analyzeCollection('attendance', token);
}

run().catch(console.error);
