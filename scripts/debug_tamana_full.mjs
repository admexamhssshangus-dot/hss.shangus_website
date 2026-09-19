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

async function debugTamanaFull() {
  const token = await getAccessToken();

  // Get student from verifiedCatalog
  const catalog = JSON.parse(fs.readFileSync('src/data/verifiedStudentsCatalog.json', 'utf8'));
  const student = catalog.find(s => s.boardRegNo === '2401010000200028');
  console.log('Catalog student:', student);

  // Get all practicalsData
  const docsRes = await restRequest('GET', '/practicalsData?pageSize=300', null, token);
  const practicalDocs = (docsRes.documents || []).map(decodeDoc);

  const { identityKey, classKey, sessionKey } = await import('../src/utils/recordIdentity.js');

  // filterAndDeduplicateSections
  const targetClass = classKey('11th');
  const targetSession = sessionKey('2025-26');
  const targetEval = identityKey('Pre-Board Test');

  const matchingSectionsRaw = practicalDocs.filter(sec => {
    if (!Array.isArray(sec.records) || sec.records.length === 0) return false;
    if (String(sec.id || '').startsWith('history_') || String(sec.docId || '').startsWith('history_')) return false;
    if ((sec.isDraft === true && sec.status !== 'approved') || (sec.status === 'draft' && sec.status !== 'approved') || sec.status === 'rejected') return false;

    const docCls = classKey(sec.className || sec.class || sec.selectedClass || sec.docId || '');
    if (docCls !== targetClass) return false;

    const rawSess = sec.sessionCanonical || sec.yearSuffix || sec.session || sec.Session || sec.docId || '';
    const docSess = sessionKey(rawSess);
    const isSessionMatched = docSess === targetSession ||
      (targetSession === '2025-26' && (docSess === '2026' || String(rawSess).includes('2026') || String(rawSess).includes('2025-26')));
    if (!isSessionMatched) return false;

    const docEval = identityKey(sec.practicalType || sec.evaluationType || sec.examTitle || sec.type || sec.docId || '');
    const isEvalMatched = docEval === targetEval ||
      docEval.includes(targetEval) || targetEval.includes(docEval) ||
      (targetEval.includes('preboard') && docEval.includes('preboard'));
    if (!isEvalMatched) return false;

    return true;
  });

  console.log('Matching sections count for 11th Pre-Board:', matchingSectionsRaw.length);
  for (const s of matchingSectionsRaw) {
    console.log(`- ${s.id} | Subject: ${s.subject} | Code: ${s.subjectCode} | Records: ${s.records.length}`);
  }

  // Deduplicate by subject
  const sectionsBySubj = new Map();
  for (const sec of matchingSectionsRaw) {
    const sKey = (sec.subjectCode || sec.subject || '').toUpperCase().trim();
    if (!sKey) continue;
    const existing = sectionsBySubj.get(sKey);
    if (!existing) {
      sectionsBySubj.set(sKey, sec);
    } else {
      const isPending = (sec.id && sec.id.startsWith('pending_')) || sec.status === 'pending_approval';
      const existPending = (existing.id && existing.id.startsWith('pending_')) || existing.status === 'pending_approval';
      const secTime = Date.parse(sec.updatedAt || sec.submittedAt || sec.timestamp || 0) || 0;
      const existTime = Date.parse(existing.updatedAt || existing.submittedAt || existing.timestamp || 0) || 0;
      if ((isPending && !existPending) || secTime > existTime) {
        sectionsBySubj.set(sKey, sec);
      }
    }
  }

  const matchingSections = Array.from(sectionsBySubj.values());

  const matchRecord = (rec) => {
    if (!rec) return false;
    const rName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const sName = String(student.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const isNameMatch = rName && sName && rName.length > 3 && (rName === sName || rName.includes(sName) || sName.includes(rName));

    const rReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
    const sReg = identityKey(student.boardRegNo || student.regNo);
    if (rReg && sReg) {
      const isFullReg = rReg.length >= 10 && sReg.length >= 10;
      const isRegMatched = isFullReg ? rReg === sReg : (rReg === sReg || rReg.endsWith(sReg) || sReg.endsWith(rReg));
      if (isRegMatched) {
        if (rName && sName && !isNameMatch) {
          // Reject cross-student collision even if suffix accidentally overlapped
        } else {
          return true;
        }
      }
    }

    const rForm = identityKey(rec.formNo || rec.fNo || rec.id);
    const sForm = identityKey(student.fNo || student.formNo);
    if (rForm && sForm && rForm === sForm) {
      return true;
    }

    const rRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
    const sRoll = identityKey(student.classRollNo);
    const sExamRoll = identityKey(student.examRollNo);
    const isRollMatch = (rRoll && sRoll && rRoll === sRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a') ||
                        (rRoll && sExamRoll && rRoll === sExamRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a');


    if (isRollMatch) {
      if (rName && sName && !isNameMatch) {
        return false;
      }
      return true;
    }

    if (isNameMatch) return true;

    return false;
  };

  // Check matching for each subject in student.subjects
  for (const subj of student.subjects) {
    let foundRec = null;
    let foundSec = null;
    for (const sec of matchingSections) {
      const c = (sec.subjectCode || '').toUpperCase().trim();
      const n = String(sec.subjectName || sec.subject || '').toLowerCase();
      const tplName = (subj.name || '').toLowerCase();
      const isMatch = c === subj.code || (tplName && n === tplName) ||
        (subj.code === 'PS' && (c === 'POL' || n.includes('political')));
      if (isMatch) {
        const rec = (sec.records || []).find(matchRecord);
        if (rec) {
          foundRec = rec;
          foundSec = sec;
          break;
        }
      }
    }
    console.log(`\nSubject: ${subj.code} (${subj.name}) -> Found in ${foundSec?.id || 'NONE'}:`, foundRec);
  }
}

debugTamanaFull().catch(console.error);
