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

  console.log('Fetching admissions...');
  const admRaw = await fetchCollection('admissions', token);
  console.log(`Fetched ${admRaw.length} admissions docs.`);

  console.log('Fetching masterRegisters...');
  const mrRaw = await fetchCollection('masterRegisters', token);
  console.log(`Fetched ${mrRaw.length} masterRegisters docs.`);

  // 1. Audit admissions
  const admStudents = [];
  admRaw.forEach(doc => {
    const f = doc.fields || {};
    const o = { _docId: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    admStudents.push(o);
  });

  // 2. Audit masterRegisters
  const mrStudents = [];
  mrRaw.forEach(doc => {
    const f = doc.fields || {};
    const o = { _docId: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    if (Array.isArray(o.items)) {
      o.items.forEach((it, idx) => {
        mrStudents.push({ ...it, _parentDocId: o._docId, _itemIndex: idx, _source: 'masterRegisters' });
      });
    } else {
      mrStudents.push({ ...o, _source: 'masterRegisters' });
    }
  });

  console.log(`\nTotal parsed students: Admissions = ${admStudents.length}, MasterRegisters items = ${mrStudents.length}`);

  // Check board data overwrites from today (Sep 30, 2026)
  // Let's check fields: currExamRollNo, boardRollNo, examRollNo, boardSync, jkboseVerified, etc.
  const all = [...admStudents.map(s => ({ ...s, _source: 'admissions' })), ...mrStudents];

  const withExamRoll = all.filter(s => {
    const r = s.currExamRollNo || s['currExamRollNo'] || s.boardRollNo || s.examRollNo || s['Exam R.No. (Current)'];
    return !!r;
  });
  console.log(`\nTotal students with exam roll no in DB: ${withExamRoll.length}`);

  // Breakdown by session and class
  const breakdown = {};
  withExamRoll.forEach(s => {
    const sess = s.session || s.academicYear || s.Session || 'Unknown Session';
    const cls = s.appliedClass || s.class || s.Class || 'Unknown Class';
    const key = `${sess} | ${cls} (${s._source})`;
    breakdown[key] = (breakdown[key] || 0) + 1;
  });

  console.log('\nBreakdown of students with exam roll no by Session & Class:');
  for (const [k, count] of Object.entries(breakdown).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${k}: ${count}`);
  }

  // Specifically check Umair Bin Shabir Lone
  console.log('\nSearching for Umair Bin Shabir Lone:');
  const umairMatches = all.filter(s => {
    const name = String(s.name || s.studentName || s["Student's Name"] || '').toLowerCase();
    return name.includes('umair') && name.includes('shabir');
  });
  umairMatches.forEach(u => {
    console.log({
      source: u._source,
      docId: u._docId || u._parentDocId,
      name: u.name || u.studentName || u["Student's Name"],
      class: u.class || u.appliedClass,
      session: u.session || u.academicYear,
      regNo: u.regNo || u.boardRegNo || u['Registration No.'] || u['Board Registration Number'],
      currExamRollNo: u.currExamRollNo,
      boardRollNo: u.boardRollNo,
      examRollNo: u.examRollNo,
      updatedAt: u.updatedAt || u.boardSyncDate || u.lastModified
    });
  });

  // Specifically check Faizan Bilal Najar
  console.log('\nSearching for Faizan Bilal Najar:');
  const faizanMatches = all.filter(s => {
    const name = String(s.name || s.studentName || s["Student's Name"] || '').toLowerCase();
    return name.includes('faizan') && name.includes('bilal');
  });
  faizanMatches.forEach(f => {
    console.log({
      source: f._source,
      docId: f._docId || f._parentDocId,
      name: f.name || f.studentName || f["Student's Name"],
      class: f.class || f.appliedClass,
      session: f.session || f.academicYear,
      regNo: f.regNo || f.boardRegNo || f['Registration No.'] || f['Board Registration Number'],
      currExamRollNo: f.currExamRollNo,
      boardRollNo: f.boardRollNo,
      examRollNo: f.examRollNo,
      rollNo: f.rollNo || f.classRollNo,
      updatedAt: f.updatedAt || f.boardSyncDate || f.lastModified
    });
  });
}

run().catch(console.error);
