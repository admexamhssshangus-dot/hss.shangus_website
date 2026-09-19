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
    if ('stringValue' in v) res[k] = v.stringValue;
    else if ('integerValue' in v) res[k] = Number(v.integerValue);
    else if ('doubleValue' in v) res[k] = Number(v.doubleValue);
    else if ('booleanValue' in v) res[k] = v.booleanValue;
    else if ('arrayValue' in v) {
      res[k] = (v.arrayValue.values || []).map(item => {
        if ('mapValue' in item) return parseFirestoreFields(item.mapValue.fields);
        if ('stringValue' in item) return item.stringValue;
        return item;
      });
    } else if ('mapValue' in v) {
      res[k] = parseFirestoreFields(v.mapValue.fields);
    } else if ('nullValue' in v) {
      res[k] = null;
    } else if ('timestampValue' in v) {
      res[k] = v.timestampValue;
    }
  }
  return res;
}

async function fetchDocs(collName, token) {
  let docs = [];
  let pageToken = null;
  do {
    const endpoint = `/${collName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await restRequest('GET', endpoint, null, token);
    if (res.documents) {
      for (const d of res.documents) {
        const id = d.name.split('/').pop();
        docs.push({ id, ...parseFirestoreFields(d.fields) });
      }
    }
    pageToken = res.nextPageToken;
  } while (pageToken);
  return docs;
}

async function main() {
  const token = await getAccessToken();
  console.log("Token obtained successfully.");

  console.log("\n--- Checking practicalsBin ---");
  const binDocs = await fetchDocs('practicalsBin', token);
  console.log(`Found ${binDocs.length} docs in practicalsBin:`);
  for (const b of binDocs) {
    console.log(`- ID: ${b.id} | Target: ${b.canonicalDocId || b.targetDocId} | Reason: ${b.archiveReason || b.reason} | Count: ${b.records?.length}`);
    if (b.id.includes('Political') || b.id.includes('English') || b.id.includes('Environmental')) {
      console.log(`   Sample records from ${b.id}:`, b.records?.slice(0, 3));
    }
  }

  console.log("\n--- Checking practicalsData ---");
  const pracDocs = await fetchDocs('practicalsData', token);
  console.log(`Found ${pracDocs.length} docs in practicalsData.`);
  for (const p of pracDocs) {
    if (p.id.includes('Pre-Board') || p.practicalType?.includes('Pre-Board') || p.id.startsWith('pending_')) {
      console.log(`ID: ${p.id} | Class: ${p.className} | Sub: ${p.subject} (${p.subjectCode}) | Status: ${p.status} | isDraft: ${p.isDraft} | Recs: ${p.records?.length}`);
    }
  }
}

main().catch(console.error);
