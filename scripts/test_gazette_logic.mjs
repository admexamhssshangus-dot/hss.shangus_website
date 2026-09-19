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

function parseFirestoreFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) res[k] = v.stringValue;
    else if ('integerValue' in v) res[k] = Number(v.integerValue);
    else if ('doubleValue' in v) res[k] = Number(v.doubleValue);
    else if ('booleanValue' in v) res[k] = v.booleanValue;
    else if ('arrayValue' in v) {
      res[k] = (v.arrayValue.values || []).map(item => {
        if ('mapValue' in item) return parseFirestoreFields(item.mapValue.fields);
        if ('stringValue' in item) return item.stringValue;
        return item;
      });
    } else if ('mapValue' in v) {
      res[k] = parseFirestoreFields(v.mapValue.fields);
    } else if ('nullValue' in v) {
      res[k] = null;
    } else if ('timestampValue' in v) {
      res[k] = v.timestampValue;
    }
  }
  return res;
}

async function fetchDocs(collName, token) {
  let docs = [];
  let pageToken = null;
  do {
    const endpoint = `/${collName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await restRequest('GET', endpoint, null, token);
    if (res.documents) {
      for (const d of res.documents) {
        const id = d.name.split('/').pop();
        docs.push({ id, ...parseFirestoreFields(d.fields) });
      }
    }
    pageToken = res.nextPageToken;
  } while (pageToken);
  return docs;
}

// Emulate recordIdentity
const identityKey = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
const classKey = value => {
  const key = identityKey(value).replace(/^class/, '');
  return key.match(/\d+/)?.[0] || ({ ix: '9', x: '10', xi: '11', xii: '12' }[key] || key);
};
const sessionKey = value => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  const match = text.match(/(20\d{2})\s*[-/]\s*(\d{2,4})/);
  if (match) return `${match[1]}-${match[2].slice(-2)}`;
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) return yearMatch[1];
  return identityKey(text);
};

function recordIdentity(s) {
  return {
    form: identityKey(s.formNo || s['Form Number'] || s['Form No.'] || s['Form No']),
    reg: identityKey(s.boardRegNo || s.regNo || s.boardReg || s['Board Registration Number'] || s['Board Registration No.'] || s['Board Registration No'] || s['Board Reg. No.'] || s['Board Reg No'] || s['Registration No. (allotted by JKBOSE)'] || s['Registration No.'] || s['Reg. No.'] || s['Reg No']),
    roll: identityKey(s.classRollNo || s['Class Roll No'] || s['Class Roll No.'] || s['RL. NO.'] || s['Class R.No.'] || s.rollNo),
    adm: identityKey(s.admNo || s['Admission No.'] || s['Admission No'] || s.admissionNo),
    className: classKey(s.classCanonical || s.selectedClass || s['Admission sought for class'] || s.className || s.Class || s.class),
    session: sessionKey(s.sessionCanonical || s.selectedSession || s.Session || s.session || s['Academic Session'])
  };
}

function matchStudentRecord(rec, student, identity) {
  if (!rec) return false;
  const rowReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
  if (rowReg && identity.reg && rowReg === identity.reg) return true;
  const rowForm = identityKey(rec.formNo || rec.form || rec.id);
  if (rowForm && identity.form && rowForm === identity.form) return true;
  const rowRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
  if (rowRoll && identity.roll && rowRoll === identity.roll && rowRoll !== '-' && rowRoll !== '—' && rowRoll !== 'n/a') return true;
  const rowName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const stuName = String(student.studentName || student.name || student["Student's Name"] || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (rowName && stuName && rowName.length > 3 && (rowName === stuName || rowName.includes(stuName) || stuName.includes(rowName))) return true;
  return false;
}

async function testGazetteLogic() {
  const token = await getAccessToken();
  const pracDocs = await fetchDocs('practicalsData', token);
  const admDocs = await fetchDocs('admissions', token);

  console.log(`Loaded ${pracDocs.length} practicalsDocs, ${admDocs.length} admissions docs.`);

  // Test for 12th Pre-Board Test 2025-26
  console.log('\n=== TESTING 12th Pre-Board Test 2025-26 ===');
  const targetClass = classKey('12th');
  const targetSession = sessionKey('2025-26');
  const selectedEvalType = 'Pre-Board Test';

  const matchingDocs12thCurrent = pracDocs.filter(section => {
    if (!Array.isArray(section.records) || section.records.length === 0) return false;
    const rawId = String(section.id || section.docId || '');
    if (rawId.startsWith('history_') || rawId.startsWith('bin_') || section.isDraft === true) return false;
    const docCls = classKey(section.className || section.class || section.selectedClass || section.docId || '');
    if (docCls !== targetClass) return false;
    const rawSess = section.sessionCanonical || section.yearSuffix || section.session || section.Session || section.docId || '';
    const docSess = sessionKey(rawSess);
    const isSessionMatched = docSess === targetSession || (targetSession === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26')));
    if (!isSessionMatched) return false;
    const targetEval = identityKey(selectedEvalType);
    const docEval = identityKey(section.practicalType || section.evaluationType || section.examTitle || section.type || section.docId || '');
    const isEvalMatched = docEval === targetEval || docEval.includes(targetEval) || targetEval.includes(docEval) || (targetEval.includes('preboard') && docEval.includes('preboard'));
    if (!isEvalMatched) return false;
    return true;
  });

  console.log("Matching 12th docs with CURRENT code (excluding isDraft === true):");
  matchingDocs12thCurrent.forEach(d => console.log(`  - ${d.id} (${d.subjectCode || d.subject}) status:${d.status} isDraft:${d.isDraft}`));

  const matchingDocs12thFixed = pracDocs.filter(section => {
    if (!Array.isArray(section.records) || section.records.length === 0) return false;
    const rawId = String(section.id || section.docId || '');
    if (rawId.startsWith('history_') || rawId.startsWith('bin_')) return false;
    if (section.isDraft === true && section.status !== 'approved') return false;
    const docCls = classKey(section.className || section.class || section.selectedClass || section.docId || '');
    if (docCls !== targetClass) return false;
    const rawSess = section.sessionCanonical || section.yearSuffix || section.session || section.Session || section.docId || '';
    const docSess = sessionKey(rawSess);
    const isSessionMatched = docSess === targetSession || (targetSession === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26')));
    if (!isSessionMatched) return false;
    const targetEval = identityKey(selectedEvalType);
    const docEval = identityKey(section.practicalType || section.evaluationType || section.examTitle || section.type || section.docId || '');
    const isEvalMatched = docEval === targetEval || docEval.includes(targetEval) || targetEval.includes(docEval) || (targetEval.includes('preboard') && docEval.includes('preboard'));
    if (!isEvalMatched) return false;
    return true;
  });

  console.log("\nMatching 12th docs with FIXED code (allowing isDraft === true IF status === 'approved'):");
  matchingDocs12thFixed.forEach(d => console.log(`  - ${d.id} (${d.subjectCode || d.subject}) status:${d.status} isDraft:${d.isDraft}`));

  // Test for 11th Pre-Board Test 2025-26
  console.log('\n=== TESTING 11th Pre-Board Test 2025-26 ===');
  const targetClass11 = classKey('11th');
  const matchingDocs11thFixed = pracDocs.filter(section => {
    if (!Array.isArray(section.records) || section.records.length === 0) return false;
    const rawId = String(section.id || section.docId || '');
    if (rawId.startsWith('history_') || rawId.startsWith('bin_')) return false;
    if (section.isDraft === true && section.status !== 'approved') return false;
    const docCls = classKey(section.className || section.class || section.selectedClass || section.docId || '');
    if (docCls !== targetClass11) return false;
    const rawSess = section.sessionCanonical || section.yearSuffix || section.session || section.Session || section.docId || '';
    const docSess = sessionKey(rawSess);
    const isSessionMatched = docSess === targetSession || (targetSession === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26')));
    if (!isSessionMatched) return false;
    const targetEval = identityKey(selectedEvalType);
    const docEval = identityKey(section.practicalType || section.evaluationType || section.examTitle || section.type || section.docId || '');
    const isEvalMatched = docEval === targetEval || docEval.includes(targetEval) || targetEval.includes(docEval) || (targetEval.includes('preboard') && docEval.includes('preboard'));
    if (!isEvalMatched) return false;
    return true;
  });

  console.log("Matching 11th docs with FIXED code:");
  matchingDocs11thFixed.forEach(d => console.log(`  - ${d.id} (${d.subjectCode || d.subject}) status:${d.status} isDraft:${d.isDraft}`));
}

testGazetteLogic().catch(console.error);
