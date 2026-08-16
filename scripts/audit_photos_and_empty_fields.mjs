import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SA_PATH = path.join(__dirname, 'serviceAccount.json');
const PHOTOS_DIR = 'D:\\Shk_Gulfam\\Projects\\optimized_photos (8 aug 2026)';

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

async function fetchAllAdmissions(token) {
  let docs = [];
  let pageToken = null;
  do {
    const endpoint = `/admissions?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await restRequest('GET', endpoint, null, token);
    if (res.documents) {
      docs.push(...res.documents);
    }
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
  console.log('🔍 Checking local photos directory...');
  let photoFiles = [];
  if (fs.existsSync(PHOTOS_DIR)) {
    photoFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`✅ Found ${photoFiles.length} photo files in "${PHOTOS_DIR}"`);
    console.log('Sample photo filenames:');
    photoFiles.slice(0, 5).forEach(f => console.log('  -', f));
  } else {
    console.error(`❌ Local directory not found: ${PHOTOS_DIR}`);
  }

  console.log('\n🔍 Connecting to Firestore...');
  const token = await getAccessToken();
  const rawDocs = await fetchAllAdmissions(token);
  console.log(`✅ Fetched ${rawDocs.length} admission documents from Firestore.`);

  let withBase64 = 0;
  let withDriveUrl = 0;
  let withNoPhoto = 0;
  let otherPhoto = 0;
  let emptyFieldCountTotal = 0;

  const sampleDocs = [];

  for (const d of rawDocs) {
    const id = d.name.split('/').pop();
    const data = parseFirestoreFields(d.fields);

    const pId = data.photo_id || '';
    const sPhoto = data['Student Photo'] || '';
    const pUrl = data.photoUrl || '';
    const photo = pId || sPhoto || pUrl;

    if (photo.startsWith('data:image')) {
      withBase64++;
    } else if (photo.includes('drive.google.com') || photo.includes('drive.usercontent')) {
      withDriveUrl++;
    } else if (!photo) {
      withNoPhoto++;
    } else {
      otherPhoto++;
    }

    // Count empty string fields
    let emptyCount = 0;
    for (const [k, v] of Object.entries(data)) {
      if (v === '' || v === null) emptyCount++;
    }
    emptyFieldCountTotal += emptyCount;

    if (id === 'adm_250569' || sampleDocs.length < 3) {
      sampleDocs.push({ id, data, emptyCount });
    }
  }

  console.log('\n📊 PHOTO FIELD ANALYSIS:');
  console.log(`- Documents with Base64 Photos: ${withBase64}`);
  console.log(`- Documents with Google Drive URLs: ${withDriveUrl}`);
  console.log(`- Documents with No Photo: ${withNoPhoto}`);
  console.log(`- Documents with Other Photo format: ${otherPhoto}`);
  console.log(`- Total empty string / null fields across all docs: ${emptyFieldCountTotal}`);

  console.log('\n🔎 INSPECTION OF SAMPLE DOCS:');
  for (const s of sampleDocs) {
    console.log(`\nDoc ID: ${s.id}`);
    console.log(`  Student Name: "${s.data["Student's Name (as per school records)"] || s.data["Student's Name"] || s.data.name}"`);
    console.log(`  Class: "${s.data["Class to which admission sought"] || s.data.class}"`);
    console.log(`  Session: "${s.data["Academic Session"] || s.data.session}"`);
    console.log(`  Reg No: "${s.data["Board Registration No. (Class 10th)"] || s.data["Board Reg. No."]}"`);
    console.log(`  photo_id present: ${Boolean(s.data.photo_id)} (Length: ${s.data.photo_id ? s.data.photo_id.length : 0})`);
    console.log(`  Student Photo present: "${s.data['Student Photo'] ? s.data['Student Photo'].substring(0, 50) + '...' : ''}"`);
    console.log(`  Empty fields count: ${s.emptyCount}`);
  }
}

run().catch(e => console.error(e));
