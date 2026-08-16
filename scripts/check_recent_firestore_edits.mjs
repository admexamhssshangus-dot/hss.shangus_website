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
  if (!doc || !doc.fields) return {};
  const res = { _docId: doc.name.split('/').pop(), _createTime: doc.createTime, _updateTime: doc.updateTime };
  for (const [k, v] of Object.entries(doc.fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.mapValue !== undefined) res[k] = parseFirestoreDoc(v.mapValue);
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(item => item.stringValue || item);
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
    if (res.documents) {
      docs.push(...res.documents.map(parseFirestoreDoc));
    }
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function checkRecentChanges() {
  const token = await getAccessToken();
  
  console.log('📡 Checking recent documents in admissions...');
  const admissions = await fetchCollectionDocs('admissions', token);
  console.log(`Total admissions docs: ${admissions.length}`);

  // Sort by updateTime descending
  admissions.sort((a, b) => (b._updateTime || '').localeCompare(a._updateTime || ''));

  console.log('\nTop 15 most recently modified documents in admissions:');
  admissions.slice(0, 15).forEach(d => {
    console.log(`DocID: ${d._docId} | Form: ${d['Form Number'] || d['Form No.'] || d.formNo} | Name: ${d["Student's Name (as per school records)"] || d["Student's Name"] || d.studentName} | RegNo: ${d['Board Registration Number'] || d.boardRegNo || d.regNo} | Status: ${d.Status || d.status} | Updated: ${d._updateTime}`);
  });

  // Check form numbers: 250218, 250398, 250407, 250558, 250271
  const checkForms = ['250218', '250398', '250407', '250558', '250271', '250570'];
  console.log('\n🔍 Detailed check for the 5 forms mentioned by user:');
  for (const f of checkForms) {
    const matches = admissions.filter(d => {
      const fNo = String(d['Form Number'] || d['Form No.'] || d.formNo || d._docId || '');
      return fNo.includes(f);
    });
    console.log(`\n--- Matches for Form ${f} (Count: ${matches.length}) ---`);
    matches.forEach(m => {
      console.log(JSON.stringify({
        _docId: m._docId,
        formNumber: m['Form Number'],
        formNo: m['Form No.'],
        name: m["Student's Name (as per school records)"] || m["Student's Name"] || m.studentName,
        regNo: m['Board Registration Number'] || m.boardRegNo || m.regNo,
        class: m['Class'] || m['Admission Class'],
        session: m['Session'] || m['selectedSession'],
        status: m.Status || m.status,
        created: m._createTime,
        updated: m._updateTime
      }, null, 2));
    });
  }
}

checkRecentChanges().catch(e => console.error(e));
