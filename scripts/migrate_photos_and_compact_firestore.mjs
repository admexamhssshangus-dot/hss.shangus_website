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

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue; // strip empty fields to save space
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: String(v) };
      else fields[k] = { doubleValue: v };
    } else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) {
      if (v.length === 0) continue; // skip empty array
      fields[k] = { arrayValue: { values: v.map(item => toFirestoreFields({ x: item }).x).filter(Boolean) } };
    } else if (typeof v === 'object') {
      const sub = toFirestoreFields(v);
      if (Object.keys(sub).length > 0) fields[k] = { mapValue: { fields: sub } };
    }
  }
  return fields;
}

function cleanStr(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function cleanName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePhotoFilename(fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const parts = base.split('_');

  let cls = '';
  let session = '';
  let identifier = '';
  let name = '';

  if (parts.length >= 4) {
    cls = parts[0];
    session = parts[1];
    identifier = parts[2];
    name = parts.slice(3).join(' ');
  } else if (parts.length === 3) {
    cls = parts[0];
    identifier = parts[1];
    name = parts[2];
  } else if (parts.length === 2) {
    identifier = parts[0];
    name = parts[1];
  } else {
    name = base;
  }

  return {
    fileName,
    cleanIdentifier: cleanStr(identifier),
    cleanName: cleanName(name),
    cls: cleanStr(cls),
    session: cleanStr(session)
  };
}

async function run(dryRun = false) {
  console.log(`🚀 RUNNING FIRESTORE PHOTO MIGRATION & COMPACTION (DryRun: ${dryRun})...\n`);

  const photoFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  const parsedPhotos = photoFiles.map(parsePhotoFilename);
  console.log(`📁 Loaded ${parsedPhotos.length} optimized local photos.`);

  const token = await getAccessToken();
  const rawDocs = await fetchAllAdmissions(token);
  console.log(`📥 Fetched ${rawDocs.length} admission documents from Firestore.`);

  let updatedPhotosCount = 0;
  let preservedExistingPhotos = 0;
  let cleanedEmptyFieldsTotal = 0;
  let totalDocumentsProcessed = 0;

  const commits = [];

  for (const d of rawDocs) {
    const docPath = d.name.replace(`projects/${PROJECT_ID}/databases/(default)/documents/`, '');
    const docId = docPath.split('/').pop();
    const data = parseFirestoreFields(d.fields);

    const regNo = cleanStr(data["Board Registration No. (Class 10th)"] || data["Board Registration No. (Class 11th)"] || data["Board Reg. No."] || data["Board Registration No."] || data.regNo);
    const formNo = cleanStr(data["Form Number"] || data["Form No."] || data.formNo || docId.replace('adm_', ''));
    const rollNo = cleanStr(data["Class Roll No"] || data["Class Roll No."] || data["Class R.No."] || data.rollNo);
    const name = cleanName(data["Student's Name (as per school records)"] || data["Student's Name"] || data.name);

    let match = null;

    // 1. Primary: Board Reg No
    if (regNo && regNo.length >= 6) {
      match = parsedPhotos.find(p => p.cleanIdentifier && (p.cleanIdentifier === regNo || p.cleanIdentifier.includes(regNo) || regNo.includes(p.cleanIdentifier)));
    }
    // 2. Secondary: Form No
    if (!match && formNo && formNo.length >= 4) {
      match = parsedPhotos.find(p => p.cleanIdentifier && p.cleanIdentifier === formNo);
    }
    // 3. Tertiary: Roll No
    if (!match && rollNo && rollNo.length >= 3) {
      match = parsedPhotos.find(p => p.cleanIdentifier && p.cleanIdentifier === rollNo);
    }
    // 4. Quaternary: Name
    if (!match && name && name.length >= 4) {
      const nameMatches = parsedPhotos.filter(p => p.cleanName && (p.cleanName === name || p.cleanName.includes(name) || name.includes(p.cleanName)));
      if (nameMatches.length >= 1) match = nameMatches[0];
    }

    let finalPhotoBase64 = null;
    if (match) {
      const filePath = path.join(PHOTOS_DIR, match.fileName);
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(match.fileName).toLowerCase().replace('.', '') || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      finalPhotoBase64 = `data:${mime};base64,${fileBuffer.toString('base64')}`;
      updatedPhotosCount++;
    } else {
      // If already has a base64 photo, keep it
      if (data.photo_id && data.photo_id.startsWith('data:image')) {
        finalPhotoBase64 = data.photo_id;
        preservedExistingPhotos++;
      }
    }

    // Build lean cleaned document
    const cleanDoc = {};
    let emptyCount = 0;
    for (const [k, v] of Object.entries(data)) {
      // Remove redundant photo fields
      if (['Student Photo', 'photoUrl', 'photoId', 'photo', 'photo_id', 'photoPath'].includes(k)) {
        continue;
      }
      if (v === '' || v === null || v === undefined) {
        emptyCount++;
        continue;
      }
      cleanDoc[k] = v;
    }
    cleanedEmptyFieldsTotal += emptyCount;

    if (finalPhotoBase64) {
      cleanDoc.photo_id = finalPhotoBase64;
    }

    totalDocumentsProcessed++;

    // Prepare Firestore batch write payload
    commits.push({
      docPath,
      docId,
      fields: toFirestoreFields(cleanDoc)
    });
  }

  console.log('\n📊 MIGRATION PLAN SUMMARY:');
  console.log(`- Total Admission Documents: ${totalDocumentsProcessed}`);
  console.log(`- Matched & Upgraded with Base64 Photos: ${updatedPhotosCount}`);
  console.log(`- Preserved Existing Base64 Photos: ${preservedExistingPhotos}`);
  console.log(`- Redundant Empty Fields Cleaned: ${cleanedEmptyFieldsTotal}`);

  if (dryRun) {
    console.log('\n✅ Dry-run complete. No writes performed.');
    return;
  }

  console.log('\n💾 Executing Firestore Write Batches...');
  const BATCH_SIZE = 50;
  for (let i = 0; i < commits.length; i += BATCH_SIZE) {
    const batch = commits.slice(i, i + BATCH_SIZE);
    const writes = batch.map(item => ({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/${item.docPath}`,
        fields: item.fields
      }
    }));

    const res = await restRequest('POST', ':commit', { writes }, token);
    if (res.error) {
      console.error(`❌ Batch error at ${i}:`, res.error);
    } else {
      console.log(`  ⚡ Written batch ${i + 1} to ${Math.min(i + BATCH_SIZE, commits.length)} of ${commits.length}...`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n🎉 ALL ADMISSION DOCUMENTS CLEANED AND PHOTOS STORED EFFICIENTLY IN FIRESTORE!');
}

const isDryRun = process.argv.includes('--dry-run');
run(isDryRun).catch(e => console.error(e));
