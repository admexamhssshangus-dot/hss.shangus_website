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

  // Variations:
  // 11th_2023-24_1901003000900019_Basharat Shabir Wani
  // 10th_2024-25_2401000000900075_Aahil Sheeraz Shah
  // or RollNo / FormNo in parts[2]
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
    rawName: name,
    cls: cleanStr(cls),
    session: cleanStr(session)
  };
}

async function run() {
  const photoFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  const parsedPhotos = photoFiles.map(parsePhotoFilename);

  console.log(`Parsed ${parsedPhotos.length} photos.`);

  const token = await getAccessToken();
  const rawDocs = await fetchAllAdmissions(token);
  console.log(`Fetched ${rawDocs.length} admission documents.`);

  let matchedByReg = 0;
  let matchedByFormNo = 0;
  let matchedByRollNo = 0;
  let matchedByName = 0;
  let unmatched = 0;

  const unmatchedList = [];
  const matchedList = [];

  for (const d of rawDocs) {
    const id = d.name.split('/').pop();
    const data = parseFirestoreFields(d.fields);

    const regNo = cleanStr(data["Board Registration No. (Class 10th)"] || data["Board Registration No. (Class 11th)"] || data["Board Reg. No."] || data["Board Registration No."] || data.regNo);
    const formNo = cleanStr(data["Form Number"] || data["Form No."] || data.formNo || id.replace('adm_', ''));
    const rollNo = cleanStr(data["Class Roll No"] || data["Class Roll No."] || data["Class R.No."] || data.rollNo);
    const name = cleanName(data["Student's Name (as per school records)"] || data["Student's Name"] || data.name);
    const father = cleanName(data["Father's Name (as per school records)"] || data["Father's Name"] || data.fatherName);

    let match = null;
    let matchType = '';

    // 1. Match by Board Reg No
    if (regNo && regNo.length >= 6) {
      match = parsedPhotos.find(p => p.cleanIdentifier && (p.cleanIdentifier === regNo || p.cleanIdentifier.includes(regNo) || regNo.includes(p.cleanIdentifier)));
      if (match) matchType = 'Board Reg No';
    }

    // 2. Match by Form Number
    if (!match && formNo && formNo.length >= 4) {
      match = parsedPhotos.find(p => p.cleanIdentifier && p.cleanIdentifier === formNo);
      if (match) matchType = 'Form Number';
    }

    // 3. Match by Roll Number
    if (!match && rollNo && rollNo.length >= 3) {
      match = parsedPhotos.find(p => p.cleanIdentifier && p.cleanIdentifier === rollNo);
      if (match) matchType = 'Roll Number';
    }

    // 4. Match by Student Name & Father/Class
    if (!match && name && name.length >= 4) {
      const nameMatches = parsedPhotos.filter(p => p.cleanName && (p.cleanName === name || p.cleanName.includes(name) || name.includes(p.cleanName)));
      if (nameMatches.length === 1) {
        match = nameMatches[0];
        matchType = 'Unique Name';
      } else if (nameMatches.length > 1) {
        match = nameMatches[0]; // best match
        matchType = 'Name (Multi)';
      }
    }

    if (match) {
      if (matchType === 'Board Reg No') matchedByReg++;
      else if (matchType === 'Form Number') matchedByFormNo++;
      else if (matchType === 'Roll Number') matchedByRollNo++;
      else matchedByName++;

      matchedList.push({ id, name, matchType, file: match.fileName });
    } else {
      unmatched++;
      unmatchedList.push({ id, name, regNo, formNo, rollNo });
    }
  }

  console.log('\n================ MATCHING RESULTS ================');
  console.log(`✅ Matched by Board Registration No : ${matchedByReg}`);
  console.log(`✅ Matched by Form Number            : ${matchedByFormNo}`);
  console.log(`✅ Matched by Roll Number            : ${matchedByRollNo}`);
  console.log(`✅ Matched by Name                   : ${matchedByName}`);
  console.log(`🎉 Total Matched                     : ${matchedByReg + matchedByFormNo + matchedByRollNo + matchedByName} / ${rawDocs.length}`);
  console.log(`❌ Unmatched                         : ${unmatched}`);
  console.log('==================================================\n');

  console.log('Sample matched:');
  matchedList.slice(0, 5).forEach(m => console.log(`  [${m.id}] "${m.name}" -> ${m.matchType} -> ${m.file}`));

  console.log('\nSample unmatched:');
  unmatchedList.slice(0, 5).forEach(u => console.log(`  [${u.id}] Name: "${u.name}", Reg: "${u.regNo}", Form: "${u.formNo}"`));
}

run().catch(e => console.error(e));
