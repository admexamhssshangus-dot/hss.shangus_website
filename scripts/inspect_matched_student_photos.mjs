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

function restRequest(method, path, payload, token) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents${path}`;
    const u = new URL(url);
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

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const res = { _docId: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else res[k] = v;
  }
  return res;
}

async function fetchCollectionDocs(collName, token) {
  let docs = [];
  let pageToken = '';
  do {
    const url = `/${collName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await restRequest('GET', url, null, token);
    if (res.documents) docs.push(...res.documents.map(parseFirestoreDoc));
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function inspect() {
  const token = await getAccessToken();
  const spDocs = await fetchCollectionDocs('studentPhotos', token);

  console.log('--- ALL STUDENT PHOTOS RELATING TO MALIKA, WANHAR, UZMA, SHEEZA, HANAN ---');
  const queries = ['malika', 'wanhar', 'uzma', 'sheeza', 'hanan', '2301010000900057', '2401000000610005', '2401015001220006', '2401010001010072', '2401003000610024', '250218', '250398', '250407', '250558', '250271'];
  
  const matched = [];
  for (const d of spDocs) {
    const str = JSON.stringify(d).toLowerCase();
    for (const q of queries) {
      if (str.includes(q.toLowerCase())) {
        if (!matched.some(m => m._docId === d._docId)) {
          matched.push(d);
        }
      }
    }
  }

  for (const m of matched) {
    console.log(`Doc ID: ${m._docId}`);
    console.log(`  studentName: ${m.studentName || m.name}`);
    console.log(`  regNo: ${m.regNo || m.boardRegNo}`);
    console.log(`  selectedClass: ${m.selectedClass} | session: ${m.selectedSession}`);
    console.log(`  updatedAt: ${m.updatedAt || m.timestamp}`);
    const p = m.photo_id || m.photoData || m.photo || '';
    console.log(`  photo prefix: ${p.substring(0, 40)}... (length: ${p.length})`);
    console.log('--------------------------------------------------');
  }
}

inspect().catch(console.error);
