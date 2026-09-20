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

const VALID_PRACTICALS_KEYS = new Set([
  'docId', 'canonicalDocId', 'className', 'Class', 'subject', 'Subject', 'subjectName',
  'subjectCode', 'practicalType', 'evaluationType', 'yearSuffix', 'sessionText', 'session',
  'records', 'students', 'status', 'isDraft', 'maxMarks', 'minMarks',
  'submittedByEmail', 'teacherEmail', 'submittedByName', 'teacherName',
  'teacherRegisteredSubject', 'isCrossSubject', 'isOverwrite', 'submittedAt', 'updatedAt',
  'lockedOtherTeacherAward', 'totalCandidates', 'stats', 'title', 'assessmentName'
]);

async function analyze() {
  const token = await getAccessToken();

  console.log('=== 1. ANALYZING PRACTICALS DATA SLOP ===');
  const pracDocs = await fetchCollectionDocs('practicalsData', token);
  let totalPracDocs = pracDocs.length;
  let totalKeysRemovedCount = 0;
  let totalBytesSaved = 0;

  pracDocs.forEach(d => {
    const docId = d.name.split('/').pop();
    const fields = d.fields || {};
    const fieldKeys = Object.keys(fields);
    const slopKeys = fieldKeys.filter(k => !VALID_PRACTICALS_KEYS.has(k) && !VALID_PRACTICALS_KEYS.has(k.toLowerCase()));
    if (slopKeys.length > 0) {
      let bytes = 0;
      slopKeys.forEach(k => {
        bytes += JSON.stringify(fields[k]).length + k.length;
      });
      totalKeysRemovedCount += slopKeys.length;
      totalBytesSaved += bytes;
      console.log(`  - ${docId}: has ${slopKeys.length} redundant top-level keys (~${Math.round(bytes/1024)} KB)`);
    }
  });

  console.log(`Total redundant keys in practicalsData: ${totalKeysRemovedCount} across ${totalPracDocs} documents.`);
  console.log(`Estimated raw payload savings in practicalsData: ~${Math.round(totalBytesSaved / 1024)} KB (~${(totalBytesSaved/(1024*1024)).toFixed(2)} MB)`);
  console.log(`Plus eliminating ~${totalKeysRemovedCount * 2} single-field index entries!\n`);

  console.log('=== 2. ANALYZING ADMISSIONS LEGACY BASE64 PHOTOS ===');
  const admDocs = await fetchCollectionDocs('admissions', token);
  let admPhotosWithBase64 = 0;
  let admBase64Bytes = 0;
  admDocs.forEach(d => {
    const f = d.fields || {};
    ['photo_id', 'Student Photo', 'photo', 'photoUrl'].forEach(key => {
      if (f[key]?.stringValue && f[key].stringValue.startsWith('data:image')) {
        admPhotosWithBase64++;
        admBase64Bytes += f[key].stringValue.length;
      }
    });
  });
  console.log(`Admissions docs with inline base64 photos: ${admPhotosWithBase64}, total ~${Math.round(admBase64Bytes / 1024)} KB`);

  console.log('\n=== 3. ANALYZING MASTER REGISTERS LEGACY BASE64 PHOTOS ===');
  const mrDocs = await fetchCollectionDocs('masterRegisters', token);
  let mrPhotosWithBase64 = 0;
  let mrBase64Bytes = 0;
  mrDocs.forEach(d => {
    const f = d.fields || {};
    ['photo_id', 'photoData', 'photo'].forEach(key => {
      if (f[key]?.stringValue && f[key].stringValue.startsWith('data:image')) {
        mrPhotosWithBase64++;
        mrBase64Bytes += f[key].stringValue.length;
      }
    });
  });
  console.log(`MasterRegisters docs with inline base64 photos: ${mrPhotosWithBase64}, total ~${Math.round(mrBase64Bytes / 1024)} KB`);
}

analyze().catch(console.error);
