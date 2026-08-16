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

function parseFirestoreFields(fields) {
  const obj = {};
  if (!fields) return obj;
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) obj[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.mapValue !== undefined) obj[k] = parseFirestoreFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) obj[k] = (v.arrayValue.values || []).map(item => parseFirestoreFields({ x: item }).x);
    else if (v.nullValue !== undefined) obj[k] = null;
  }
  return obj;
}

async function run() {
  const token = await getAccessToken();

  console.log('🔍 Checking fundDistributions vs fund_distributions...');
  const fdCamel = await fetchCollectionDocs('fundDistributions', token);
  const fdSnake = await fetchCollectionDocs('fund_distributions', token);
  const frSnake = await fetchCollectionDocs('fund_rates', token);
  const frCamel = await fetchCollectionDocs('feeRates', token);

  console.log(`- 'fundDistributions' (camelCase) count : ${fdCamel.length}`);
  console.log(`- 'fund_distributions' (snake_case) count: ${fdSnake.length}`);
  console.log(`- 'fund_rates' count                     : ${frSnake.length}`);
  console.log(`- 'feeRates' count                       : ${frCamel.length}`);

  if (fdCamel.length > 0) {
    console.log('Sample doc in fundDistributions:', fdCamel[0].name.split('/').pop());
  }
  if (fdSnake.length > 0) {
    console.log('Sample doc in fund_distributions:', fdSnake[0].name.split('/').pop());
  }

  console.log('\n🔍 Checking gktest_settings and related collections...');
  const gkSettings = await fetchCollectionDocs('gktest_settings', token);
  console.log(`- 'gktest_settings' count: ${gkSettings.length}`);
  if (gkSettings.length > 0) {
    gkSettings.forEach(d => {
      console.log(`  Doc: ${d.name.split('/').pop()}`, parseFirestoreFields(d.fields));
    });
  }

  // Check any other exam collections
  const gkRegs = await fetchCollectionDocs('gktest_registrations', token);
  console.log(`- 'gktest_registrations' count: ${gkRegs.length}`);
  const compExams = await fetchCollectionDocs('competitive_exams', token);
  console.log(`- 'competitive_exams' count: ${compExams.length}`);
}

run().catch(e => console.error(e));
