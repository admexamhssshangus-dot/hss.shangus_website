import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sa = JSON.parse(fs.readFileSync(path.join(__dirname, 'serviceAccount.json'), 'utf8'));

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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d).access_token));
    });
    req.write(postData); req.end();
  });
}

function parseVal(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseVal);
  if ('mapValue' in val) {
    const o = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) o[k] = parseVal(v);
    return o;
  }
  return null;
}

async function fetchCollection(collection, token) {
  let docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents/${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await new Promise(r => {
      https.get(url, { headers: { Authorization: 'Bearer ' + token } }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
      });
    });
    if (res.documents) docs.push(...res.documents);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return docs;
}

async function run() {
  const token = await getAccessToken();

  console.log('Fetching masterRegisters...');
  const mrRaw = await fetchCollection('masterRegisters', token);

  const prevSessionOverwritten = [];
  let total2025Updates = 0;

  mrRaw.forEach(doc => {
    const f = doc.fields || {};
    const o = { _docId: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    const items = Array.isArray(o.items) ? o.items : [o];

    items.forEach((it, idx) => {
      const upd = String(it.updatedAt || it.lastBoardSyncAt || o.updatedAt || '');
      const isUpdatedToday = upd.includes('2026-09-30');
      const sess = String(it.session || it.academicYear || o.session || '');
      const is2025 = sess.includes('2025') || sess.includes('25');

      if (isUpdatedToday) {
        if (is2025) {
          total2025Updates++;
        } else {
          prevSessionOverwritten.push({
            docId: o._docId,
            itemIdx: idx,
            name: it.studentName || it.name,
            class: it.class || it.appliedClass,
            session: sess,
            currExamRollNo: it.currExamRollNo,
            boardRollNo: it.boardRollNo,
            updatedAt: upd
          });
        }
      }
    });
  });

  console.log(`\n=== AUDIT RESULTS FOR MASTER REGISTERS ===`);
  console.log(`Updates done today for Session 2025-26: ${total2025Updates}`);
  console.log(`Updates done today for Previous Sessions: ${prevSessionOverwritten.length}`);
  if (prevSessionOverwritten.length > 0) {
    console.log('Samples of previous session records modified today:');
    console.log(prevSessionOverwritten.slice(0, 10));
  } else {
    console.log('CONFIRMED: ZERO previous session records in masterRegisters were overwritten today!');
  }

  // Also check admissions
  console.log('\nFetching admissions...');
  const admRaw = await fetchCollection('admissions', token);
  const admPrevUpdatedToday = [];
  let adm2025Updates = 0;

  admRaw.forEach(doc => {
    const f = doc.fields || {};
    const o = { _docId: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    const upd = String(o.updatedAt || o.lastBoardSyncAt || '');
    const isUpdatedToday = upd.includes('2026-09-30');
    const sess = String(o.session || o.academicYear || '');
    const is2025 = sess.includes('2025') || sess.includes('25');

    if (isUpdatedToday) {
      if (is2025) {
        adm2025Updates++;
      } else {
        admPrevUpdatedToday.push({
          docId: o._docId,
          name: o.studentName || o.name,
          class: o.class || o.appliedClass,
          session: sess,
          currExamRollNo: o.currExamRollNo,
          updatedAt: upd
        });
      }
    }
  });

  console.log(`\n=== AUDIT RESULTS FOR ADMISSIONS ===`);
  console.log(`Admissions updated today for Session 2025-26: ${adm2025Updates}`);
  console.log(`Admissions updated today for Previous Sessions: ${admPrevUpdatedToday.length}`);
  if (admPrevUpdatedToday.length > 0) {
    console.log('Samples of previous session admissions modified today:');
    console.log(admPrevUpdatedToday.slice(0, 10));
  } else {
    console.log('CONFIRMED: ZERO previous session admissions were overwritten today!');
  }
}

run().catch(console.error);
