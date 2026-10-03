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

async function run() {
  const token = await getAccessToken();
  console.log('Got access token');

  console.log('\n--- 1. Querying practicalsData ---');
  let pageToken = '';
  const practicalDocs = [];
  do {
    const url = `/practicalsData?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const resp = await restRequest('GET', url, null, token);
    const docs = resp.documents || [];
    for (const d of docs) {
      const id = d.name.split('/').pop();
      const data = parseFirestoreFields(d.fields);
      practicalDocs.push({ id, ...data, rawName: d.name });
    }
    pageToken = resp.nextPageToken || '';
  } while (pageToken);

  console.log(`Total practicalsData docs: ${practicalDocs.length}`);
  const matchingPracticals = practicalDocs.filter(d => {
    const str = JSON.stringify(d).toLowerCase();
    return str.includes('e.educational') || str.includes('socialshiftz') || str.includes('gulfam');
  });

  console.log(`Matching practicalsData docs: ${matchingPracticals.length}`);
  matchingPracticals.forEach(d => {
    console.log(`- ID: ${d.id}`);
    console.log(`  teacherEmail: ${d.teacherEmail}`);
    console.log(`  submittedByEmail: ${d.submittedByEmail}`);
    console.log(`  teacherName: ${d.teacherName}`);
    console.log(`  practicalType: ${d.practicalType}`);
    console.log(`  subject: ${d.subject || d.subjectCode}`);
    console.log(`  class: ${d.className || d.Class}`);
    console.log(`  records count: ${(d.records || []).length}`);
  });

  console.log('\n--- 2. Querying practicalsBin ---');
  let binPageToken = '';
  const binDocs = [];
  try {
    do {
      const url = `/practicalsBin?pageSize=300${binPageToken ? `&pageToken=${binPageToken}` : ''}`;
      const resp = await restRequest('GET', url, null, token);
      const docs = resp.documents || [];
      for (const d of docs) {
        const id = d.name.split('/').pop();
        const data = parseFirestoreFields(d.fields);
        binDocs.push({ id, ...data, rawName: d.name });
      }
      binPageToken = resp.nextPageToken || '';
    } while (binPageToken);
    console.log(`Total practicalsBin docs: ${binDocs.length}`);
    const matchingBin = binDocs.filter(d => {
      const str = JSON.stringify(d).toLowerCase();
      return str.includes('e.educational') || str.includes('socialshiftz') || str.includes('gulfam');
    });
    console.log(`Matching practicalsBin docs: ${matchingBin.length}`);
    matchingBin.forEach(d => {
      console.log(`- Bin ID: ${d.id}, teacherEmail: ${d.teacherEmail}, submittedByEmail: ${d.submittedByEmail}, teacherName: ${d.teacherName}, targetDocId: ${d.docId || d.targetDocId}`);
    });
  } catch (err) {
    console.log('Error reading practicalsBin:', err.message);
  }

  console.log('\n--- 3. Querying users collection ---');
  try {
    const userDoc1 = await restRequest('GET', `/users/e.educational.24@gmail.com`, null, token);
    console.log('users/e.educational.24@gmail.com:', userDoc1.error ? 'NOT FOUND' : parseFirestoreFields(userDoc1.fields));
  } catch (e) { console.log('user1 err:', e.message); }

  try {
    const userDoc2 = await restRequest('GET', `/users/socialshiftz@gmail.com`, null, token);
    console.log('users/socialshiftz@gmail.com:', userDoc2.error ? 'NOT FOUND' : parseFirestoreFields(userDoc2.fields));
  } catch (e) { console.log('user2 err:', e.message); }

  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
