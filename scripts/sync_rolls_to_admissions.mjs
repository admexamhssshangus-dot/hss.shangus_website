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

function extractReg(s) {
  return String(
    s.boardRegNo || s.regNo || s['Registration No.'] || s['Board Registration Number'] ||
    s['Board Registration No. (Class 11th)'] || s['Board Registration No. (Class 10th)'] ||
    s['Board Registration No. (Class 9th)'] || s['Board Registration No. (Class 8th)'] ||
    s['Board Registration No.'] || s['Board Registration No'] || s['Board Reg. No.'] ||
    s['Reg. No.'] || s['Registration No'] || ''
  ).trim();
}

function extractName(s) {
  return String(
    s.studentName || s["Student's Name (as per school records)"] || s["Student's Name"] ||
    s['Student Name'] || s.candidatename || s.name || s.fullName || ''
  ).trim();
}

function cleanStr(val) {
  return String(val || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

async function run() {
  const token = await getAccessToken();

  console.log('Fetching masterRegisters...');
  const mrRaw = await fetchCollection('masterRegisters', token);

  const mr2025WithRoll = [];
  mrRaw.forEach(doc => {
    const f = doc.fields || {};
    const o = { _docId: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    const items = Array.isArray(o.items) ? o.items : [o];

    items.forEach((it) => {
      const sess = String(it.session || it.academicYear || o.session || '');
      if (sess.includes('2025') || sess.includes('25')) {
        const roll = it.currExamRollNo || it.boardRollNo || it.examRollNo;
        if (roll) {
          mr2025WithRoll.push({
            name: extractName(it),
            fatherName: it.fatherName || it["Father's Name"],
            class: it.class || it.appliedClass,
            session: sess,
            regNo: extractReg(it),
            examRollNo: String(roll)
          });
        }
      }
    });
  });

  console.log(`MasterRegisters 2025-26 with Exam Roll: ${mr2025WithRoll.length}`);

  console.log('Fetching admissions...');
  const admRaw = await fetchCollection('admissions', token);

  const adm2025 = [];
  admRaw.forEach(doc => {
    const f = doc.fields || {};
    const o = { _docId: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    const sess = String(o.session || o.academicYear || '');
    if (sess.includes('2025') || sess.includes('25')) {
      adm2025.push(o);
    }
  });

  console.log(`Admissions 2025-26 count: ${adm2025.length}`);

  // Map MR by reg
  const regMap = new Map();
  mr2025WithRoll.forEach(m => {
    const cR = cleanStr(m.regNo);
    if (cR) regMap.set(cR, m);
  });

  // Map MR by name + class
  const nameClassMap = new Map();
  mr2025WithRoll.forEach(m => {
    const cN = cleanStr(m.name);
    const cls = cleanStr(m.class);
    if (cN) nameClassMap.set(`${cls}_${cN}`, m);
  });

  let matchByReg = 0;
  let matchByName = 0;
  const updatesToApply = [];

  adm2025.forEach(st => {
    const stReg = cleanStr(extractReg(st));
    const stName = cleanStr(extractName(st));
    const stCls = cleanStr(st.appliedClass || st.class);

    let match = null;
    let matchType = '';
    if (stReg && regMap.has(stReg)) {
      match = regMap.get(stReg);
      matchType = 'reg';
      matchByReg++;
    } else if (stName && nameClassMap.has(`${stCls}_${stName}`)) {
      match = nameClassMap.get(`${stCls}_${stName}`);
      matchType = 'name';
      matchByName++;
    }

    if (match) {
      updatesToApply.push({
        docId: st._docId,
        studentName: extractName(st),
        class: st.appliedClass || st.class,
        regNo: extractReg(st) || match.regNo,
        examRollNo: match.examRollNo,
        currExamRollNoInAdm: st.currExamRollNo || null,
        matchType
      });
    }
  });

  console.log(`\n=== MATCH RESULTS ===`);
  console.log(`Matched by Registration No: ${matchByReg}`);
  console.log(`Matched by Name + Class: ${matchByName}`);
  console.log(`Total Admissions candidates matched: ${updatesToApply.length}`);
  console.log(`\nSample matched candidates ready for sync:`);
  console.log(updatesToApply.slice(0, 5));

  const nowIso = new Date().toISOString();
  const writes = updatesToApply.map(u => ({
    update: {
      name: `projects/hsssdb/databases/(default)/documents/admissions/${u.docId}`,
      fields: {
        currExamRollNo: { stringValue: String(u.examRollNo) },
        boardRollNo: { stringValue: String(u.examRollNo) },
        examRollNo: { stringValue: String(u.examRollNo) },
        lastBoardSyncAt: { stringValue: nowIso },
        boardSyncSource: { stringValue: 'JKBOSE Board Overwrite' }
      }
    },
    updateMask: {
      fieldPaths: ['currExamRollNo', 'boardRollNo', 'examRollNo', 'lastBoardSyncAt', 'boardSyncSource']
    }
  }));

  console.log(`\nWriting updates to Firestore admissions for ${writes.length} candidates in chunks of 100...`);
  for (let i = 0; i < writes.length; i += 100) {
    const chunk = writes.slice(i, i + 100);
    const postData = JSON.stringify({ writes: chunk });
    const res = await new Promise((resolve, reject) => {
      const req = https.request('https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents:batchWrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Content-Length': Buffer.byteLength(postData)
        }
      }, r => {
        let d = ''; r.on('data', c => d += c);
        r.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    console.log(`Committed chunk ${Math.floor(i / 100) + 1} (${chunk.length} admissions). Response status: ${res.writeResults ? res.writeResults.length + ' written' : JSON.stringify(res)}`);
  }

  console.log(`\nSUCCESS: Synced ${writes.length} exam roll numbers to 2025-26 admissions collection!`);
}

run().catch(console.error);

