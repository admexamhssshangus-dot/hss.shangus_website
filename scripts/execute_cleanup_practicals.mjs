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

async function cleanPracticalsData() {
  const token = await getAccessToken();
  console.log('🚀 Starting practicalsData cleanup...');

  const pracDocs = await fetchCollectionDocs('practicalsData', token);
  console.log(`Found ${pracDocs.length} practicals documents.`);

  let totalCleanedDocs = 0;
  let totalKeysPurged = 0;

  for (const doc of pracDocs) {
    const docId = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const fieldKeys = Object.keys(fields);

    const slopKeys = fieldKeys.filter(k => !VALID_PRACTICALS_KEYS.has(k) && !VALID_PRACTICALS_KEYS.has(k.toLowerCase()));

    if (slopKeys.length === 0) continue;

    const cleanFields = {};
    for (const [k, v] of Object.entries(fields)) {
      if (VALID_PRACTICALS_KEYS.has(k) || VALID_PRACTICALS_KEYS.has(k.toLowerCase())) {
        cleanFields[k] = v;
      }
    }

    // Safety check: ensure records exists and has items if original had items
    const origRecCount = fields.records?.arrayValue?.values?.length || fields.students?.arrayValue?.values?.length || 0;
    const cleanRecCount = cleanFields.records?.arrayValue?.values?.length || cleanFields.students?.arrayValue?.values?.length || 0;
    if (origRecCount !== cleanRecCount) {
      console.error(`❌ ABORTING for ${docId}: records count mismatch (${origRecCount} vs ${cleanRecCount})!`);
      continue;
    }

    // Overwrite document in Firestore without the slop keys
    const endpoint = `/practicalsData/${encodeURIComponent(docId)}`;
    await restRequest('PATCH', endpoint, { fields: cleanFields }, token);

    totalCleanedDocs++;
    totalKeysPurged += slopKeys.length;
    console.log(`✅ Cleaned ${docId}: stripped ${slopKeys.length} redundant keys (retained ${cleanRecCount} student records)`);
  }

  console.log(`\n🎉 Successfully cleaned ${totalCleanedDocs} documents in practicalsData!`);
  console.log(`Total redundant keys purged: ${totalKeysPurged}`);
}

cleanPracticalsData().catch(console.error);
