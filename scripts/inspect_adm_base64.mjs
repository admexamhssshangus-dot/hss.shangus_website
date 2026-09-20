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

async function inspectAdmissionsBase64() {
  const token = await getAccessToken();
  const admDocs = await fetchCollectionDocs('admissions', token);
  for (const d of admDocs) {
    const id = d.name.split('/').pop();
    const f = d.fields || {};
    const base64Keys = [];
    for (const [k, v] of Object.entries(f)) {
      if (v.stringValue && v.stringValue.startsWith('data:image')) {
        base64Keys.push(k);
      }
    }
    if (base64Keys.length > 0) {
      console.log(`Admission doc ${id} has base64 keys:`, base64Keys);
      const regNo = f['Board Registration No. (Class 10th)']?.stringValue || f['Board Registration No. (Class 11th)']?.stringValue || f.regNo?.stringValue;
      const formNo = f['Form Number']?.stringValue || f.formNo?.stringValue || id;
      console.log(`   regNo: ${regNo || 'none'}, formNo: ${formNo}`);

      // Check if photo is in studentPhotos
      const keysToCheck = [regNo, `photo_${regNo}`, formNo, `photo_form_${formNo}`].filter(Boolean);
      for (const k of keysToCheck) {
        const u = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/studentPhotos/${k}`);
        const res = await fetch(u, { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 200) console.log(`   -> ALREADY in studentPhotos as: ${k}`);
      }
    }
  }
}

inspectAdmissionsBase64().catch(console.error);
