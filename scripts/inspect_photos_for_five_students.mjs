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

async function checkPhotos() {
  const token = await getAccessToken();
  const regList = [
    { reg: '2401015001220006', form: '250218', name: 'Uzma jan' },
    { reg: '2401010001010072', form: '250398', name: 'Sheeza shafi' },
    { reg: '2401003000610024', form: '250407', name: 'Hanan Bashir Mantoo' },
    { reg: '2401000000610005', form: '250558', name: 'Wanhar Ahmad Malik' },
    { reg: '2301010000900057', form: '250271', name: 'Malikatariq' }
  ];

  console.log('🔍 Checking studentPhotos collection for the 5 registration numbers:');
  for (const item of regList) {
    const docRes = await restRequest('GET', `/studentPhotos/photo_${item.reg}`, null, token);
    const parsed = parseFirestoreDoc(docRes);
    if (parsed) {
      const pLen = (parsed.photo_id || parsed.photoData || parsed.photo || '').length;
      console.log(`✅ Found studentPhotos/photo_${item.reg} | Name: ${parsed.studentName} | RegNo: ${parsed.regNo} | Photo Length: ${pLen} chars`);
    } else {
      console.log(`❌ NOT found: studentPhotos/photo_${item.reg}`);
    }

    // Also check what is currently inside admission doc
    const admRes = await restRequest('GET', `/admissions/adm_${item.form}`, null, token);
    const admParsed = parseFirestoreDoc(admRes);
    if (admParsed) {
      const pLen = (admParsed.photo_id || admParsed['Student Photo'] || '').length;
      console.log(`   Admission doc adm_${item.form}: Name: ${admParsed["Student's Name (as per school records)"] || admParsed.name} | Reg: ${admParsed['Board Registration Number']} | photo_id length: ${pLen} chars`);
    }
  }
}

checkPhotos().catch(e => console.error(e));
