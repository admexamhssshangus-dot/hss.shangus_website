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

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: String(v) };
      else fields[k] = { doubleValue: v };
    } else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) {
      if (v.length === 0) continue;
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

function getSessionRank(sessionStr) {
  const s = String(sessionStr || '').toLowerCase();
  if (s.includes('2026-27') || s.includes('2026')) return 5;
  if (s.includes('2025-26') || s.includes('2025')) return 4;
  if (s.includes('2024-25') || s.includes('2024')) return 3;
  if (s.includes('2023-24') || s.includes('2023')) return 2;
  if (s.includes('2022-23') || s.includes('2022')) return 1;
  return 0;
}

function parsePhoto(fileName) {
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

  const cleanCls = cleanStr(cls);
  const is9or10 = cleanCls.includes('9') || cleanCls.includes('10');
  const is11or12 = cleanCls.includes('11') || cleanCls.includes('12');

  const filePath = path.join(PHOTOS_DIR, fileName);
  const stats = fs.statSync(filePath);

  return {
    fileName,
    filePath,
    fileSizeBytes: stats.size,
    cls: cleanCls,
    rawCls: cls,
    is9or10,
    is11or12,
    session: String(session || '').trim(),
    sessionRank: getSessionRank(session),
    regNo: cleanStr(identifier),
    rawRegNo: identifier.trim(),
    name: cleanName(name),
    rawName: name.trim()
  };
}

async function run() {
  console.log('🚀 SEEDING DEDUPLICATED STUDENT PHOTOS INTO FIRESTORE "studentPhotos" COLLECTION...\n');

  const allFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`📁 Scanning ${allFiles.length} photo files in "${PHOTOS_DIR}"...`);

  const photos = allFiles.map(parsePhoto);

  const track1Groups = new Map(); // 9th & 10th
  const track2Groups = new Map(); // 11th & 12th
  const trackOtherGroups = new Map();

  for (const p of photos) {
    const key = (p.regNo && p.regNo.length >= 6) ? `reg_${p.regNo}` : `name_${p.name}`;
    if (p.is9or10) {
      if (!track1Groups.has(key)) track1Groups.set(key, []);
      track1Groups.get(key).push(p);
    } else if (p.is11or12) {
      if (!track2Groups.has(key)) track2Groups.set(key, []);
      track2Groups.get(key).push(p);
    } else {
      if (!trackOtherGroups.has(key)) trackOtherGroups.set(key, []);
      trackOtherGroups.get(key).push(p);
    }
  }

  // 1. In 9th/10th: Prefer 9th over 10th. Within same class: recent session first.
  function selectBest9th10th(list) {
    return list.slice().sort((a, b) => {
      const aIs9 = a.cls.includes('9') ? 1 : 0;
      const bIs9 = b.cls.includes('9') ? 1 : 0;
      if (aIs9 !== bIs9) return bIs9 - aIs9;
      return b.sessionRank - a.sessionRank;
    })[0];
  }

  // 2. In 11th/12th: Prefer 11th over 12th. Within same class: recent session first.
  function selectBest11th12th(list) {
    return list.slice().sort((a, b) => {
      const aIs11 = a.cls.includes('11') ? 1 : 0;
      const bIs11 = b.cls.includes('11') ? 1 : 0;
      if (aIs11 !== bIs11) return bIs11 - aIs11;
      return b.sessionRank - a.sessionRank;
    })[0];
  }

  const selectedPhotos = [];
  for (const [, list] of track1Groups.entries()) selectedPhotos.push(selectBest9th10th(list));
  for (const [, list] of track2Groups.entries()) selectedPhotos.push(selectBest11th12th(list));
  for (const [, list] of trackOtherGroups.entries()) selectedPhotos.push(list[0]);

  console.log(`✅ Deduplication complete: ${selectedPhotos.length} unique photos chosen out of ${photos.length} (${photos.length - selectedPhotos.length} duplicates pruned).`);

  console.log('\n🔑 Obtaining OAuth2 token for Firestore...');
  const token = await getAccessToken();

  const writeCommits = [];
  for (const p of selectedPhotos) {
    const fileBuffer = fs.readFileSync(p.filePath);
    const ext = path.extname(p.fileName).toLowerCase().replace('.', '') || 'jpeg';
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    const base64Data = `data:${mime};base64,${fileBuffer.toString('base64')}`;

    // A registration number can legitimately span the 9th/10th and 11th/12th
    // bands. Keep one canonical photo per band, rather than letting the later
    // write overwrite the other band at photo_<registration-number>.
    const photoBand = p.is9or10 ? 'secondary' : p.is11or12 ? 'higher-secondary' : 'other';
    const docId = (p.regNo && p.regNo.length >= 6)
      ? `photo_${p.regNo}_${photoBand}`
      : `photo_name_${p.name.replace(/\s+/g, '_')}_${photoBand}`;

    const photoDoc = {
      photo_id: base64Data,
      regNo: p.rawRegNo || '',
      studentName: p.rawName || '',
      selectedClass: p.rawCls || '',
      selectedSession: p.session || '',
      photoBand,
      sourceFileName: p.fileName,
      updatedAt: new Date().toISOString()
    };

    writeCommits.push({
      docPath: `studentPhotos/${docId}`,
      fields: toFirestoreFields(photoDoc)
    });
  }

  console.log(`\n💾 Writing ${writeCommits.length} deduplicated photo documents to "studentPhotos" collection...`);
  const BATCH_SIZE = 40;
  for (let i = 0; i < writeCommits.length; i += BATCH_SIZE) {
    const batch = writeCommits.slice(i, i + BATCH_SIZE);
    const writes = batch.map(item => ({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/${item.docPath}`,
        fields: item.fields
      }
    }));

    const res = await restRequest('POST', ':commit', { writes }, token);
    if (res.error) {
      console.error(`❌ Error at batch ${i}:`, res.error);
    } else {
      console.log(`  ⚡ Uploaded batch ${i + 1} to ${Math.min(i + BATCH_SIZE, writeCommits.length)} of ${writeCommits.length} photos...`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n🎉 ALL DEDUPLICATED PHOTOS SUCCESSFULLY SEEDED INTO "studentPhotos" COLLECTION!');
}

run().catch(e => console.error(e));
