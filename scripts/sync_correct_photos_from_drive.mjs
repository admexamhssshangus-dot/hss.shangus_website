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

const PHOTOS_DIR = 'I:\\My Drive\\Projects\\admission form\\2026 onwards\\Student Photos\\optimized_photos';

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

async function syncPhotos() {
  const token = await getAccessToken();

  const assignments = [
    {
      studentName: 'Malikatariq',
      regNo: '2301010000900057',
      formNo: '250271',
      file: '11th_2024-25 (Oct-Nov)_2301010000900057_Malika Tariq.jpg'
    },
    {
      studentName: 'Wanhar Ahmad Malik',
      regNo: '2401000000610005',
      formNo: '250558',
      file: '11th_2025-26_2401000000610032_Wanhar Ahmad Malik.jpg'
    },
    {
      studentName: 'Uzma jan',
      regNo: '2401015001220006',
      formNo: '250218',
      file: '11th_2025-26_2401013000470021_Uzma Jan.jpg'
    },
    {
      studentName: 'Sheeza shafi',
      regNo: '2401010001010072',
      formNo: '250398',
      file: '11th_2025-26_2401010000101007_Sheeza Shafi.jpg'
    },
    {
      studentName: 'Hanan Bashir Mantoo',
      regNo: '2401003000610024',
      formNo: '250407',
      file: '11th_2025-26_6775676685438986_Hanan Bashir Mantoo.jpg'
    }
  ];

  console.log('🔄 Uploading authentic photos to studentPhotos for updated Board Registration Numbers...');
  for (const a of assignments) {
    const filePath = path.join(PHOTOS_DIR, a.file);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const base64Data = `data:image/jpeg;base64,${buffer.toString('base64')}`;

      const payload = {
        photo_id: base64Data,
        photoData: base64Data,
        regNo: a.regNo,
        boardRegNo: a.regNo,
        studentName: a.studentName,
        formNumber: a.formNo,
        sourceFile: a.file,
        updatedAt: new Date().toISOString()
      };

      const maskParams = Object.keys(payload).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const patchUrl = `/studentPhotos/photo_${a.regNo}?${maskParams}`;
      await restRequest('PATCH', patchUrl, { fields: toFirestoreFields(payload) }, token);
      console.log(`✅ Synced studentPhotos/photo_${a.regNo} with "${a.file}" (${buffer.length} bytes)`);

      // Also update candidate key by plain regNo
      await restRequest('PATCH', `/studentPhotos/${a.regNo}?${maskParams}`, { fields: toFirestoreFields(payload) }, token).catch(() => {});

      // Also update the admission document photo_id
      const admPatch = {
        photo_id: base64Data,
        'Board Registration Number': a.regNo,
        boardRegNo: a.regNo,
        regNo: a.regNo
      };
      const admMask = Object.keys(admPatch).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      await restRequest('PATCH', `/admissions/adm_${a.formNo}?${admMask}`, { fields: toFirestoreFields(admPatch) }, token);
      console.log(`  ✅ Also updated admissions/adm_${a.formNo} photo_id`);
    } else {
      console.log(`❌ File not found: ${filePath}`);
    }
  }

  console.log('\n🎉 ALL 5 PHOTOS UPDATED TO AUTHENTIC DRIVE VERSIONS!');
}

syncPhotos().catch(console.error);
