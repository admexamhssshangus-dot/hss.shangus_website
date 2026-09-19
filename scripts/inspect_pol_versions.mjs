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

async function fetchDoc(collName, docId, token) {
  const endpoint = `/${collName}/${docId}`;
  const res = await restRequest('GET', endpoint, null, token);
  if (res.fields) {
    return { id: docId, ...parseFirestoreFields(res.fields) };
  }
  return null;
}

async function inspectPol() {
  const token = await getAccessToken();

  const active = await fetchDoc('practicalsData', '11th_Political Science_Pre-Board Test_2025-26', token);
  console.log("=== ACTIVE 11th POL DOC ===");
  console.log({
    id: active?.id,
    submittedBy: active?.submittedByName || active?.submittedByEmail || active?.submittedBy,
    submittedAt: active?.submittedAt,
    updatedAt: active?.updatedAt,
    approvedAt: active?.approvedAt,
    approvedBy: active?.approvedBy,
    recordsLength: active?.records?.length
  });

  const bin1 = await fetchDoc('practicalsBin', 'bin_11th_Political Science_Pre-Board Test_2025-26_1789801388911', token);
  console.log("\n=== BIN 1 ===");
  console.log({
    id: bin1?.id,
    submittedBy: bin1?.submittedByName || bin1?.submittedByEmail || bin1?.submittedBy,
    submittedAt: bin1?.submittedAt,
    archivedAt: bin1?.archivedAt,
    recordsLength: bin1?.records?.length
  });

  const bin2 = await fetchDoc('practicalsBin', 'bin_11th_Political Science_Pre-Board Test_2025-26_1789810806714', token);
  console.log("\n=== BIN 2 ===");
  console.log({
    id: bin2?.id,
    submittedBy: bin2?.submittedByName || bin2?.submittedByEmail || bin2?.submittedBy,
    submittedAt: bin2?.submittedAt,
    archivedAt: bin2?.archivedAt,
    recordsLength: bin2?.records?.length
  });

  // Compare active records vs bin records to see if any student had numeric marks previously
  if (active && bin1) {
    console.log("\n=== COMPARING ACTIVE vs BIN1 ===");
    let differences = 0;
    active.records?.forEach((r, i) => {
      const bRec = bin1.records?.find(b => b.rollNo === r.rollNo || b.regNo === r.regNo);
      if (bRec && bRec.totalMarks !== r.totalMarks) {
        differences++;
        console.log(`Roll ${r.rollNo} (${r.name}): active=${r.totalMarks} vs bin1=${bRec.totalMarks}`);
      }
    });
    console.log(`Total differences between active and bin1: ${differences}`);
  }

  if (active && bin2) {
    console.log("\n=== COMPARING ACTIVE vs BIN2 ===");
    let differences = 0;
    active.records?.forEach((r, i) => {
      const bRec = bin2.records?.find(b => b.rollNo === r.rollNo || b.regNo === r.regNo);
      if (bRec && bRec.totalMarks !== r.totalMarks) {
        differences++;
        console.log(`Roll ${r.rollNo} (${r.name}): active=${r.totalMarks} vs bin2=${bRec.totalMarks}`);
      }
    });
    console.log(`Total differences between active and bin2: ${differences}`);
  }
}

inspectPol().catch(console.error);
