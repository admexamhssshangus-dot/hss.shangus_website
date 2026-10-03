import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const sa = JSON.parse(fs.readFileSync('./scripts/serviceAccount.json', 'utf8'));

async function getAccessToken() {
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

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: postData
  });
  const data = await res.json();
  return data.access_token;
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

function encodeVal(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(encodeVal) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = encodeVal(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function fetchCollection(collection, token) {
  let docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents/${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    let res = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) break;
      } catch (e) {
        if (attempt === 3) throw e;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

async function updateDocumentFields(docPath, fields, token) {
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents/${docPath}?${mask}`;
  const encodedFields = {};
  for (const [k, v] of Object.entries(fields)) {
    encodedFields[k] = encodeVal(v);
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: encodedFields })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update ${docPath}: ${res.status} ${text}`);
  }
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== RUNNING IN ${isApply ? 'APPLY' : 'DRY RUN'} MODE ===`);

  const token = await getAccessToken();
  console.log('Fetching collections...');
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

  const practicals = practicalsRaw.map(d => {
    const f = d.fields || {};
    const o = { _id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
    return o;
  });

  // Build canonical index
  const canonicalMap = new Map();

  function registerCanonical(cls, reg, form, roll, name, father, examRoll) {
    if (!examRoll || !/^\d{6,}$/.test(examRoll)) return;
    const cleanCls = cls.includes('10') ? '10th' : cls.includes('11') ? '11th' : cls.includes('12') ? '12th' : null;
    if (!cleanCls) return;

    if (cleanCls === '10th' && !examRoll.startsWith('1')) return;
    if (cleanCls === '11th' && !examRoll.startsWith('2')) return;
    if (cleanCls === '12th' && !examRoll.startsWith('3')) return;

    const cReg = String(reg || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cForm = String(form || '').trim();
    const cRoll = String(roll || '').trim();
    const cName = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cFather = String(father || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    if (cReg && cReg.length >= 5) canonicalMap.set(`${cleanCls}_reg_${cReg}`, examRoll);
    if (cForm) canonicalMap.set(`${cleanCls}_form_${cForm}`, examRoll);
    if (cRoll && !/^\d{6,}$/.test(cRoll)) canonicalMap.set(`${cleanCls}_roll_${cRoll}`, examRoll);
    if (cName && cFather) canonicalMap.set(`${cleanCls}_name_${cName}_${cFather}`, examRoll);
  }

  // 1. From masterRegisters (chunk_118 is 2025-26)
  masterRegisters.forEach(mr => {
    const items = Array.isArray(mr.items) ? mr.items : [mr];
    items.forEach(it => {
      const cls = String(it.class || it.Class || mr.class || mr.Class || '');
      const sess = String(it.session || it.Session || mr.session || mr.Session || '');
      if (sess.includes('2025')) {
        const examRoll = String(it.currExamRollNo || it.boardRollNo || it['Exam R.No. (Current)'] || it.examRollNo || '').trim();
        const reg = it.boardRegNo || it.regNo || it['Board Reg. No.'] || it['Board Registration Number'];
        const form = it.formNo || it['Form No.'];
        const roll = it.classRollNo || it['Class R.No.'] || it['Class Roll No'] || it.rollNo;
        const name = it.name || it.StudentName || it["Student's Name"];
        const father = it.fatherName || it["Father's Name"];
        registerCanonical(cls, reg, form, roll, name, father, examRoll);
      }
    });
  });

  // 2. From admissions (2025-26 live intake)
  admissions.forEach(a => {
    const cls = String(a.class || a.appliedClass || '');
    const sess = String(a.session || '');
    if (sess.includes('2025')) {
      const examRoll = String(a.currExamRollNo || a.boardRollNo || a.examRollNo || a['Exam R.No. (Current)'] || '').trim();
      const reg = a.boardRegNo || a.regNo || a['Board Registration Number'];
      const form = a.formNo || a['Form Number'] || a['Form No.'];
      const roll = a.rollNo || a['Class Roll No'];
      const name = a.name || a.studentName || a["Student's Name (as per school records)"];
      const father = a.fatherName || a["Father's/Guardian's Name (as per school records)"];
      registerCanonical(cls, reg, form, roll, name, father, examRoll);
    }
  });

  console.log(`Canonical 2025-26 directory loaded (${canonicalMap.size} index keys).`);

  let totalDocsUpdated = 0;
  let totalRecordsUpdated = 0;

  for (const p of practicals) {
    const cls = String(p.className || p.class || p.Class || '');
    const sess = String(p.sessionText || p.session || '');
    if (p._id.includes('2024-25') || sess.includes('2024-25')) continue;
    if (!sess.includes('2025-26') && !p._id.includes('2025-26') && !sess.includes('2025')) continue;

    const cleanCls = cls.includes('10') ? '10th' : cls.includes('11') ? '11th' : cls.includes('12') ? '12th' : null;
    if (!cleanCls) continue;

    let docModified = false;
    let docUpdatedCount = 0;
    const records = p.records || [];

    const updatedRecords = records.map(r => {
      const currentExamInRecord = String(r.examRollNo || (/^\d{6,}$/.test(String(r.rollNo)) ? r.rollNo : '') || '').trim();

      const cReg = String(r.boardRegNo || r.regNo || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const cForm = String(r.formNo || '').trim();
      const cRoll = String(r.classRollNo || r.classRoll || r.rollNo || '').trim();
      const cName = String(r.name || r.studentName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const cFather = String(r.parentage || r.parentName || r.fatherName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      let canonicalRoll = null;
      if (cReg && canonicalMap.has(`${cleanCls}_reg_${cReg}`)) {
        canonicalRoll = canonicalMap.get(`${cleanCls}_reg_${cReg}`);
      } else if (cForm && canonicalMap.has(`${cleanCls}_form_${cForm}`)) {
        canonicalRoll = canonicalMap.get(`${cleanCls}_form_${cForm}`);
      } else if (cRoll && !/^\d{6,}$/.test(cRoll) && canonicalMap.has(`${cleanCls}_roll_${cRoll}`)) {
        canonicalRoll = canonicalMap.get(`${cleanCls}_roll_${cRoll}`);
      } else if (cName && cFather && canonicalMap.has(`${cleanCls}_name_${cName}_${cFather}`)) {
        canonicalRoll = canonicalMap.get(`${cleanCls}_name_${cName}_${cFather}`);
      }

      if (canonicalRoll && canonicalRoll !== currentExamInRecord) {
        docModified = true;
        docUpdatedCount++;
        totalRecordsUpdated++;
        return {
          ...r,
          examRollNo: canonicalRoll
        };
      }
      return r;
    });

    if (docModified) {
      totalDocsUpdated++;
      console.log(`Document ${p._id}: ${docUpdatedCount} of ${records.length} records updated to canonical rolls`);
      if (isApply) {
        await updateDocumentFields(`practicalsData/${p._id}`, {
          records: updatedRecords,
          lastCanonicalRollSyncAt: new Date().toISOString()
        }, token);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total practical documents updated: ${totalDocsUpdated}`);
  console.log(`Total individual student records updated: ${totalRecordsUpdated}`);
  if (!isApply) {
    console.log(`(This was a dry run. Run with --apply to commit updates to Firestore)`);
  } else {
    console.log(`(All updates committed to live Firestore practicalsData collection!)`);
  }
}

main().catch(console.error);
