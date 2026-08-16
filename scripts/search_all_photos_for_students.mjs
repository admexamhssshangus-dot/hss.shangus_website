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
  const res = { _docId: doc.name.split('/').pop(), _name: doc.name };
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

async function searchAll() {
  const token = await getAccessToken();
  console.log('📡 Fetching masterRegisters...');
  const master = await fetchCollectionDocs('masterRegisters', token);
  console.log(`Total masterRegisters: ${master.length}`);

  const targets = [
    { name: 'Uzma', reg: '2401015001220006', form: '250218' },
    { name: 'Sheeza', reg: '2401010001010072', form: '250398' },
    { name: 'Hanan', reg: '2401003000610024', form: '250407' },
    { name: 'Wanhar', reg: '2401000000610005', form: '250558' },
    { name: 'Malika', reg: '2301010000900057', form: '250271' }
  ];

  for (const t of targets) {
    console.log(`\n🔍 Searching masterRegisters for ${t.name} (Reg: ${t.reg}, Form: ${t.form}):`);
    const found = master.filter(m => {
      const sName = String(m["Student's Name (as per school records)"] || m.name || m.studentName || '').toLowerCase();
      const sReg = String(m['Board Registration Number'] || m['Board Registration No.'] || m.regNo || m.boardRegNo || '').trim();
      const sForm = String(m['Form Number'] || m['Form No.'] || m.formNo || '').trim();
      return sName.includes(t.name.toLowerCase()) || sReg === t.reg || sForm === t.form;
    });

    if (found.length === 0) {
      console.log('  No records in masterRegisters');
    } else {
      for (const f of found) {
        console.log(`  📋 Master record: docId=${f._docId} | Name=${f["Student's Name (as per school records)"] || f.name} | Reg=${f['Board Registration Number'] || f.regNo} | Class=${f['Admission sought for class'] || f.class} | Session=${f.Session || f.session} | photo_id len=${(f.photo_id || f['Student Photo'] || '').length}`);
      }
    }
  }
}

searchAll().catch(console.error);
