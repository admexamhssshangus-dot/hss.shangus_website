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

async function run() {
  const token = await getAccessToken();
  const forms = [
    { form: '250218', name: 'Uzma jan', reg: '2401015001220006' },
    { form: '250398', name: 'Sheeza shafi', reg: '2401010001010072' },
    { form: '250407', name: 'Hanan Bashir Mantoo', reg: '2401003000610024' },
    { form: '250558', name: 'Wanhar Ahmad Malik', reg: '2401000000610005' },
    { form: '250271', name: 'Malikatariq', reg: '2301010000900057' }
  ];

  console.log('--- ADMISSIONS DOCUMENTS ---');
  for (const f of forms) {
    const admDoc = parseFirestoreDoc(await restRequest('GET', `/admissions/adm_${f.form}`, null, token));
    console.log(`\nForm #${f.form} (${f.name}):`);
    if (admDoc) {
      console.log(`  _docId: ${admDoc._docId}`);
      console.log(`  Name: ${admDoc["Student's Name (as per school records)"] || admDoc.name}`);
      console.log(`  Board Reg No in doc: "${admDoc['Board Registration Number'] || admDoc.boardRegNo || admDoc.regNo}"`);
      console.log(`  Class: "${admDoc['Admission sought for class'] || admDoc.class}" | Session: "${admDoc.Session || admDoc.session}"`);
      console.log(`  photo_id length: ${(admDoc.photo_id || '').length}`);
      console.log(`  Student Photo length: ${(admDoc['Student Photo'] || '').length}`);
      console.log(`  photoUrl: "${admDoc.photoUrl || ''}"`);
    } else {
      console.log('  ❌ admDoc not found!');
    }
  }

  console.log('\n--- SEARCHING studentPhotos FOR REGS AND NAMES ---');
  // Fetch all docs in studentPhotos to see everything
  let spDocs = [];
  let pageToken = '';
  do {
    const res = await restRequest('GET', `/studentPhotos?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, null, token);
    if (res.documents) spDocs.push(...res.documents.map(parseFirestoreDoc));
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  console.log(`Total studentPhotos docs in Firestore: ${spDocs.length}`);

  for (const f of forms) {
    console.log(`\nLooking up photos related to ${f.name} (Form #${f.form}, Target Reg: ${f.reg}):`);
    const matches = spDocs.filter(d => {
      const matchDocId = d._docId.includes(f.form) || d._docId.includes(f.reg);
      const matchReg = String(d.regNo || d.boardRegNo || '').trim() === f.reg || String(d.regNo || d.boardRegNo || '').includes(f.form);
      const matchName = String(d.studentName || d.name || '').toLowerCase().includes(f.name.toLowerCase().split(' ')[0]);
      return matchDocId || matchReg || matchName;
    });

    if (matches.length === 0) {
      console.log('  ⚠️ No matches in studentPhotos');
    } else {
      for (const m of matches) {
        console.log(`  📸 Match in studentPhotos: docId="${m._docId}" | studentName="${m.studentName || m.name}" | regNo="${m.regNo || m.boardRegNo}" | formNo="${m.formNo || m.formNumber}" | photoLen=${(m.photo_id || m.photoData || m.photo || '').length}`);
      }
    }
  }
}

run().catch(console.error);
