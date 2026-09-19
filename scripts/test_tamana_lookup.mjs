import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const SA_PATH = 'scripts/serviceAccount.json';
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
          else reject(new Error('Token error: ' + body));
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
    const u = new URL('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents' + endpoint);
    const data = payload ? JSON.stringify(payload) : null;

    const req = https.request({
      hostname: u.hostname,
      port: 443,
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
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve({ error: e.message, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function decodeValue(val) {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(decodeValue);
  if (val.mapValue !== undefined) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = decodeValue(v);
    }
    return res;
  }
  return null;
}

function decodeDoc(doc) {
  if (!doc || !doc.fields) return null;
  const res = { id: doc.name ? doc.name.split('/').pop() : '' };
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = decodeValue(v);
  }
  return res;
}

async function testLookup() {
  const token = await getAccessToken();

  // 1. Get admission doc
  const admRaw = await restRequest('GET', '/admissions/adm_250085', null, token);
  const adm = decodeDoc(admRaw);

  // 2. Get 11th Political Science doc
  const psRaw = await restRequest('GET', '/practicalsData/11th_Political Science_Pre-Board Test_2025-26', null, token);
  const ps = decodeDoc(psRaw);

  console.log('ps doc:', {
    id: ps.id,
    subject: ps.subject,
    subjectCode: ps.subjectCode,
    recordsLength: ps.records.length,
    status: ps.status,
    isDraft: ps.isDraft
  });

  const studentRec = ps.records.find(r => r.regNo === '2401010000200028' || r.name === 'Tamana Manzoor');
  console.log('Tamana record in Political Science doc:', studentRec);

  // Check matching in ConsolidatedGazetteView
  const { identityKey, classKey, sessionKey } = await import('../src/utils/recordIdentity.js');
  const { recordIdentity } = await import('../src/utils/recordIdentity.js');

  const identity = recordIdentity(adm);
  console.log('adm identity:', identity);

  function matchStudentRecord(rec, student, ident) {
    if (!rec) return false;
    const rowReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
    if (rowReg && ident.reg && rowReg === ident.reg) return true;
    const rowForm = identityKey(rec.formNo || rec.form || rec.id);
    if (rowForm && ident.form && rowForm === ident.form) return true;
    const rowRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
    if (rowRoll && ident.roll && rowRoll === ident.roll && rowRoll !== '-' && rowRoll !== '—' && rowRoll !== 'n/a') return true;
    const rowName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const stuName = String(student.studentName || student.name || student["Student's Name"] || student["Student's Name (as per school records)"] || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (rowName && stuName && rowName.length > 3 && (rowName === stuName || rowName.includes(stuName) || stuName.includes(rowName))) return true;
    return false;
  }

  const isMatched = matchStudentRecord(studentRec, adm, identity);
  console.log('matchStudentRecord result:', isMatched);

  // Now let's check PublicResultLookup matching
  const matchRecord = (rec) => {
    if (!rec) return false;
    const rReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
    const sReg = identityKey(adm.boardRegNo || adm.regNo || adm['Board Registration No. (Class 10th)']);
    if (rReg && sReg) {
      const isRegMatched = rReg === sReg || (rReg.length >= 6 && sReg.length >= 6 && (rReg.endsWith(sReg.slice(-6)) || sReg.endsWith(rReg.slice(-6))));
      if (isRegMatched) return true;
    }
    const rForm = identityKey(rec.formNo || rec.fNo || rec.id);
    const sForm = identityKey(adm.fNo || adm.formNo || adm['Form Number']);
    if (rForm && sForm && rForm === sForm) return true;
    const rRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
    const sRoll = identityKey(adm.classRollNo || adm['Class Roll No']);
    const isRollMatch = (rRoll && sRoll && rRoll === sRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a');
    if (isRollMatch) return true;
    const rName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const sName = String(adm.name || adm["Student's Name (as per school records)"] || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (rName && sName && rName.length > 3 && (rName === sName || rName.includes(sName) || sName.includes(rName))) return true;
    return false;
  };
  console.log('PublicResultLookup matchRecord result:', matchRecord(studentRec));
}

testLookup().catch(console.error);
