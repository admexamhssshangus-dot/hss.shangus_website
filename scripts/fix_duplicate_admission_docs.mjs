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

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: v.toString() };
      else fields[k] = { doubleValue: v };
    } else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  }
  return fields;
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

async function fixDuplicates() {
  const token = await getAccessToken();
  console.log('📡 Fetching all admissions from Firestore...');
  const admissions = await fetchCollectionDocs('admissions', token);
  console.log(`Total admissions: ${admissions.length}`);

  const fiveForms = ['250218', '250398', '250407', '250558', '250271'];

  for (const fNo of fiveForms) {
    const bareDoc = admissions.find(d => d._docId === fNo);
    const origDoc = admissions.find(d => d._docId === `adm_${fNo}`);

    if (bareDoc && origDoc) {
      const regToCopy = 
        bareDoc['Board Registration Number'] ||
        bareDoc['Board Registration No.'] ||
        bareDoc.boardRegNo ||
        bareDoc.regNo ||
        '';

      console.log(`\n🔄 Form ${fNo}: Copying RegNo "${regToCopy}" from bare doc "${bareDoc._docId}" -> original doc "${origDoc._docId}" (${origDoc["Student's Name (as per school records)"] || origDoc.name})`);

      // Update original document
      const updateFields = {
        'Board Registration Number': regToCopy,
        'Board Registration No.': regToCopy,
        boardRegNo: regToCopy,
        regNo: regToCopy,
        updatedAt: new Date().toISOString()
      };

      const maskParams = Object.keys(updateFields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const patchUrl = `/admissions/${origDoc._docId}?${maskParams}`;
      await restRequest('PATCH', patchUrl, { fields: toFirestoreFields(updateFields) }, token);
      console.log(`  ✅ Updated ${origDoc._docId} with correct RegNo: ${regToCopy}`);

      // Delete the bare duplicate document
      console.log(`  🗑️ Deleting duplicate bare document: ${bareDoc._docId}`);
      await restRequest('DELETE', `/admissions/${bareDoc._docId}`, null, token);
      console.log(`  ✅ Deleted duplicate bare document: ${bareDoc._docId}`);
    } else {
      console.log(`\n⚠️ Form ${fNo}: bareDoc=${!!bareDoc}, origDoc=${!!origDoc}`);
    }
  }

  // Also check if any other bare docs (numeric doc ID of length 6) exist where an adm_ prefixed doc also exists
  console.log('\n🔍 Scanning for any other accidental bare numeric documents...');
  const allAdmissions = await fetchCollectionDocs('admissions', token);
  for (const d of allAdmissions) {
    if (/^\d{6}$/.test(d._docId)) {
      const partner = allAdmissions.find(x => x._docId === `adm_${d._docId}`);
      if (partner) {
        console.log(`Found another duplicate: ${d._docId} and ${partner._docId}. Merging and deleting bare doc...`);
        // merge fields if needed
        const reg = d['Board Registration Number'] || d.boardRegNo || d.regNo || '';
        if (reg) {
          const updateFields = {
            'Board Registration Number': reg,
            boardRegNo: reg,
            regNo: reg,
            updatedAt: new Date().toISOString()
          };
          const maskParams = Object.keys(updateFields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
          await restRequest('PATCH', `/admissions/${partner._docId}?${maskParams}`, { fields: toFirestoreFields(updateFields) }, token);
        }
        await restRequest('DELETE', `/admissions/${d._docId}`, null, token);
        console.log(`  ✅ Cleaned duplicate ${d._docId}`);
      }
    }
  }

  console.log('\n🎉 ALL DUPLICATES CLEANED & ORIGINAL DOCUMENTS PRESERVED!');
}

fixDuplicates().catch(e => console.error(e));
