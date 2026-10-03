import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';

const sa = JSON.parse(fs.readFileSync('./scripts/serviceAccount.json', 'utf8'));

function getAccessToken() {
  return new Promise((resolve) => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
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

async function main() {
  const token = await getAccessToken();
  const [admissionsRaw, masterRegistersRaw, practicalsRaw] = await Promise.all([
    fetchCollection('admissions', token),
    fetchCollection('masterRegisters', token),
    fetchCollection('practicalsData', token)
  ]);

  const admissions = admissionsRaw.map(d => {
    const f = d.fields || {};
    const o = { _id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    return o;
  });

  const masterRegisters = masterRegistersRaw.map(d => {
    const f = d.fields || {};
    const o = { _id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    return o;
  });

  console.log('\n=== ADMISSIONS 2025-26 EXAM ROLLS & CENTRES ===');
  ['10th', '11th', '12th'].forEach(cls => {
    const sts = admissions.filter(a => {
      const c = String(a.class || a.appliedClass || '');
      const s = String(a.session || '');
      return c.includes(cls.replace('th', '')) && s.includes('2025');
    });

    const rollsByField = {
      currExamRollNo: new Set(),
      examRollNo: new Set(),
      boardRollNo: new Set(),
      'Exam Roll No': new Set()
    };
    const centres = new Set();
    const studentSample = [];

    sts.forEach(st => {
      const curr = String(st.currExamRollNo || '').trim();
      const ex = String(st.examRollNo || '').trim();
      const b = String(st.boardRollNo || '').trim();
      if (curr) rollsByField.currExamRollNo.add(curr);
      if (ex) rollsByField.examRollNo.add(ex);
      if (b) rollsByField.boardRollNo.add(b);

      const roll = curr || ex || b;
      if (roll && /^\d{6,}$/.test(roll)) {
        centres.add(roll.slice(0, 6));
      }

      if (studentSample.length < 5 && roll) {
        studentSample.push({
          name: st.name || st["Student's Name (as per school records)"],
          classRoll: st.rollNo || st['Class Roll No'],
          curr: curr,
          exam: ex,
          board: b
        });
      }
    });

    console.log(`\nClass ${cls} (Total sts: ${sts.length}):`);
    console.log(`  Centres (${centres.size}):`, Array.from(centres));
    console.log(`  currExamRollNo count: ${rollsByField.currExamRollNo.size}`);
    console.log(`  examRollNo count: ${rollsByField.examRollNo.size}`);
    console.log(`  boardRollNo count: ${rollsByField.boardRollNo.size}`);
    console.log(`  Sample students:`, studentSample);
  });

  console.log('\n=== MASTER REGISTERS 2025-26 (chunk_118 etc) EXAM ROLLS & CENTRES ===');
  ['10th', '11th', '12th'].forEach(cls => {
    const centres = new Set();
    let totalItems = 0;
    const sample = [];
    masterRegisters.forEach(mr => {
      const items = Array.isArray(mr.items) ? mr.items : [mr];
      items.forEach(it => {
        const c = String(it.class || it.Class || mr.class || mr.Class || '');
        const s = String(it.session || it.Session || mr.session || mr.Session || '');
        if (c.includes(cls.replace('th', '')) && s.includes('2025')) {
          totalItems++;
          const roll = String(it.currExamRollNo || it.examRollNo || it.boardRollNo || it['Exam R.No. (Current)'] || it['Exam Roll No'] || '').trim();
          if (roll && /^\d{6,}$/.test(roll)) {
            centres.add(roll.slice(0, 6));
            if (sample.length < 5) {
              sample.push({ name: it.name || it["Student's Name"], roll, centre: roll.slice(0, 6) });
            }
          }
        }
      });
    });
    console.log(`\nClass ${cls} (Total MR items: ${totalItems}):`);
    console.log(`  Centres (${centres.size}):`, Array.from(centres));
    console.log(`  Sample:`, sample);
  });
}

main().catch(console.error);
