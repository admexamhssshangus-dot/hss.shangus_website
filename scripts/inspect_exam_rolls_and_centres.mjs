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

async function main() {
  const token = await getAccessToken();
  console.log('Token acquired. Fetching collections...');

  const [admissionsRaw, masterRegistersRaw, practicalsRaw] = await Promise.all([
    fetchCollection('admissions', token),
    fetchCollection('masterRegisters', token),
    fetchCollection('practicalsData', token)
  ]);

  console.log(`Fetched: admissions=${admissionsRaw.length}, masterRegisters=${masterRegistersRaw.length}, practicalsData=${practicalsRaw.length}`);

  // 1. Inspect admissions
  const admissions = admissionsRaw.map(d => {
    const f = d.fields || {};
    const o = { _id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    return o;
  });

  // 2. Inspect masterRegisters
  const masterRegisters = masterRegistersRaw.map(d => {
    const f = d.fields || {};
    const o = { _id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    return o;
  });

  // Find Rohit Chidanand Raina
  console.log('\n--- Searching for Rohit Chidanand Raina in Admissions ---');
  admissions.filter(a => {
    const n = JSON.stringify(a).toLowerCase();
    return n.includes('rohit') && n.includes('raina');
  }).forEach(a => {
    console.log('Admission doc:', a._id, {
      name: a.name || a.studentName,
      class: a.class || a.appliedClass,
      session: a.session,
      currExamRollNo: a.currExamRollNo,
      examRollNo: a.examRollNo,
      'Exam Roll No': a['Exam Roll No'],
      'Exam R.No. (Current)': a['Exam R.No. (Current)'],
      boardRegNo: a.boardRegNo,
      centreNo: a.centreNo
    });
  });

  console.log('\n--- Searching for Rohit in MasterRegisters ---');
  masterRegisters.forEach(mr => {
    const items = Array.isArray(mr.items) ? mr.items : [mr];
    items.forEach(it => {
      const s = JSON.stringify(it).toLowerCase();
      if (s.includes('rohit') && s.includes('raina')) {
        console.log('MR Doc:', mr._id, {
          name: it.name || it.StudentName || it.studentName,
          class: it.class || it.Class || mr.class,
          session: it.session || it.Session || mr.session,
          currExamRollNo: it.currExamRollNo,
          examRollNo: it.examRollNo,
          boardRollNo: it.boardRollNo,
          'Exam Roll No': it['Exam Roll No'],
          boardRegNo: it.boardRegNo || it.regNo,
          centreNo: it.centreNo
        });
      }
    });
  });

  // Check unique centres and exam roll formats in admissions and masterRegisters by class and session
  const centreStats = { '10th': {}, '11th': {}, '12th': {} };
  const examRollStats = { '10th': {}, '11th': {}, '12th': {} };

  function recordRoll(cls, sess, roll, source) {
    if (!cls) return;
    const cleanCls = cls.includes('10') ? '10th' : cls.includes('11') ? '11th' : cls.includes('12') ? '12th' : null;
    if (!cleanCls) return;
    const s = String(sess || 'unknown');
    if (!centreStats[cleanCls][s]) centreStats[cleanCls][s] = new Set();
    if (!examRollStats[cleanCls][s]) examRollStats[cleanCls][s] = [];

    const digits = String(roll || '').replace(/\D/g, '');
    if (digits.length >= 6) {
      const centre = digits.slice(0, 6);
      centreStats[cleanCls][s].add(centre);
      examRollStats[cleanCls][s].push({ roll: digits, centre, source });
    }
  }

  admissions.forEach(a => {
    const cls = a.class || a.appliedClass;
    const sess = a.session;
    const rolls = [
      a.currExamRollNo,
      a.examRollNo,
      a['Exam R.No. (Current)'],
      a['Exam Roll No'],
      a['Exam Roll No.']
    ].filter(Boolean);
    rolls.forEach(r => recordRoll(cls, sess, r, 'admissions'));
  });

  masterRegisters.forEach(mr => {
    const items = Array.isArray(mr.items) ? mr.items : [mr];
    items.forEach(it => {
      const cls = it.class || it.Class || mr.class || mr.Class;
      const sess = it.session || it.Session || mr.session || mr.Session;
      const rolls = [
        it.currExamRollNo,
        it.examRollNo,
        it.boardRollNo,
        it['Exam Roll No'],
        it['Exam Roll No.'],
        it['Exam R.No. (Current)']
      ].filter(Boolean);
      rolls.forEach(r => recordRoll(cls, sess, r, 'masterRegisters'));
    });
  });

  practicalsRaw.forEach(d => {
    const f = d.fields || {};
    const o = { _id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    const cls = o.className || o.class || o.Class;
    const sess = o.sessionText || o.session;
    if (Array.isArray(o.records)) {
      o.records.forEach(r => {
        const rolls = [r.examRollNo, r.rollNo, r['Exam Roll No']].filter(Boolean);
        rolls.forEach(r2 => recordRoll(cls, sess, r2, `practicals_${o._id}`));
      });
    }
  });

  console.log('\n--- CENTRE STATS BY CLASS & SESSION ---');
  for (const [cls, sessions] of Object.entries(centreStats)) {
    console.log(`\n=== CLASS ${cls} ===`);
    for (const [sess, centres] of Object.entries(sessions)) {
      console.log(`Session: ${sess} -> Centres (${centres.size}):`, Array.from(centres));
      const sampleRolls = (examRollStats[cls][sess] || []).slice(0, 5).map(x => `${x.roll} (src: ${x.source})`);
      console.log(`  Sample rolls:`, sampleRolls);
    }
  }
}

main().catch(console.error);
