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

async function simulateGazetteRow() {
  const token = await getAccessToken();

  const admRaw = await restRequest('GET', '/admissions/adm_250085', null, token);
  const student = decodeDoc(admRaw);

  const docsRes = await restRequest('GET', '/practicalsData?pageSize=300', null, token);
  const practicalsDocs = (docsRes.documents || []).map(decodeDoc);

  const { identityKey, classKey, sessionKey, recordIdentity } = await import('../src/utils/recordIdentity.js');
  const identity = recordIdentity(student);

  function matchStudentRecord(rec, stu, ident) {
    if (!rec) return false;
    const rowReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
    if (rowReg && ident.reg && rowReg === ident.reg) return true;
    const rowForm = identityKey(rec.formNo || rec.form || rec.id);
    if (rowForm && ident.form && rowForm === ident.form) return true;
    const rowRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
    if (rowRoll && ident.roll && rowRoll === ident.roll && rowRoll !== '-' && rowRoll !== '—' && rowRoll !== 'n/a') return true;
    const rowName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const stuName = String(stu.studentName || stu.name || stu["Student's Name"] || stu["Student's Name (as per school records)"] || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (rowName && stuName && rowName.length > 3 && (rowName === stuName || rowName.includes(stuName) || stuName.includes(rowName))) return true;
    return false;
  }

  // Check matching practicalsDocs for 11th
  const matchingDocs = practicalsDocs.filter(section => {
    if (!Array.isArray(section.records) || section.records.length === 0) return false;
    const rawId = String(section.id || section.docId || '');
    if (rawId.startsWith('history_') || rawId.startsWith('bin_') || (section.isDraft === true && section.status !== 'approved')) return false;
    const docCls = classKey(section.className || section.class || section.selectedClass || section.docId || '');
    if (docCls !== '11') return false;
    return true;
  });

  console.log('Matching 11th docs count:', matchingDocs.length);
  for (const m of matchingDocs) {
    console.log(`- ${m.id} | Subj: ${m.subject} | SubjCode: ${m.subjectCode} | Records: ${m.records.length}`);
  }

  // Now check what PS column gets
  const psDoc = matchingDocs.find(sec => {
    const sCode = (sec.subjectCode || '').toUpperCase().trim();
    const sName = String(sec.subjectName || sec.subject || '').toLowerCase();
    return sCode === 'PS' || (sCode === 'POL' || sName.includes('political') || sName.includes('pol science'));
  });

  if (psDoc) {
    const recs = psDoc.records || [];
    const match = recs.find(r => matchStudentRecord(r, student, identity));
    console.log('\nPS match in Gazette:', match);
  } else {
    console.log('\nNO PS DOC FOUND IN MATCHING DOCS!');
  }
}

simulateGazetteRow().catch(console.error);
