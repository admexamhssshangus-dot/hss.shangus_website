import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

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

async function simulateScorecard() {
  const token = await getAccessToken();

  // Fetch all practicalsData documents
  const docsRes = await restRequest('GET', '/practicalsData?pageSize=300', null, token);
  const practicalDocs = (docsRes.documents || []).map(decodeDoc);

  // Fetch student adm_250085
  const admRaw = await restRequest('GET', '/admissions/adm_250085', null, token);
  const matchedStudentRaw = decodeDoc(admRaw);

  const {
    filterAndDeduplicateSections,
    computeScorecardSubjects,
    extractEnrolledSubjects
  } = await import('../src/pages/PublicResultLookup.jsx');
  const { identityKey } = await import('../src/utils/recordIdentity.js');

  const matchingSections = filterAndDeduplicateSections(
    practicalDocs,
    '11th',
    '2025-26',
    'Pre-Board Test'
  );

  console.log('Matching sections for 11th Pre-Board:', matchingSections.map(s => `${s.subject || s.subjectName} (${s.subjectCode}) id: ${s.id}`));

  const enrolled = extractEnrolledSubjects(matchedStudentRaw);
  console.log('Enrolled subjects for Tamana Manzoor:', enrolled);

  const matchedStudent = {
    name: matchedStudentRaw["Student's Name (as per school records)"],
    fatherName: matchedStudentRaw["Father's/Guardian's Name (as per school records)"],
    className: '11th',
    classRollNo: matchedStudentRaw['Class Roll No'] || '141',
    boardRegNo: matchedStudentRaw['Board Registration No. (Class 10th)'] || '2401010000200028',
    formNo: matchedStudentRaw['Form Number'] || '250085',
    stream: 'Humanities',
    session: '2025-26',
    subjects: enrolled
  };

  const matchRecord = (rec) => {
    if (!rec) return false;
    const rReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
    const sReg = identityKey(matchedStudent.boardRegNo || matchedStudent.regNo);
    if (rReg && sReg) {
      const isRegMatched = rReg === sReg || (rReg.length >= 6 && sReg.length >= 6 && (rReg.endsWith(sReg.slice(-6)) || sReg.endsWith(rReg.slice(-6))));
      if (isRegMatched) return true;
    }
    const rForm = identityKey(rec.formNo || rec.fNo || rec.id);
    const sForm = identityKey(matchedStudent.fNo || matchedStudent.formNo);
    if (rForm && sForm && rForm === sForm) return true;
    const rRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
    const sRoll = identityKey(matchedStudent.classRollNo);
    const isRollMatch = (rRoll && sRoll && rRoll === sRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a');
    if (isRollMatch) return true;
    const rName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const sName = String(matchedStudent.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (rName && sName && rName.length > 3 && (rName === sName || rName.includes(sName) || sName.includes(rName))) return true;
    return false;
  };

  const scorecard = computeScorecardSubjects({
    matchedStudent,
    streamName: 'Humanities',
    matchingSections,
    matchRecord,
    biologyDisplayMode: 'combined',
    evalConfig: { evalType: 'Pre-Board Test', maxMarks: 50 }
  });

  console.log('\n=== SCORECARD SUBJECTS ===');
  for (const s of scorecard.subjects) {
    console.log(`${s.subjectCode} - ${s.subjectName}: Marks=${s.marksObtained}, isAbsent=${s.isAbsent}, isEvaluated=${s.isEvaluated}, status=${s.status}`);
  }
}

simulateScorecard().catch(console.error);
