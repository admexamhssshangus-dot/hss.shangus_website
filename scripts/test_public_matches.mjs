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

const identityKey = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');

function createPublicMatchRecord(matchedStudent) {
  return function matchRecord(rec) {
    if (!rec) return false;
    const rReg = identityKey(rec.regNo || rec.boardRegNo || rec.reg);
    const sReg = identityKey(matchedStudent.boardRegNo || matchedStudent.regNo);
    if (rReg && sReg) {
      const isRegMatched = rReg === sReg || (rReg.length >= 6 && sReg.length >= 6 && (rReg.endsWith(sReg.slice(-6)) || sReg.endsWith(rReg.slice(-6))));
      if (isRegMatched) return true;
    }

    const rForm = identityKey(rec.formNo || rec.fNo || rec.id);
    const sForm = identityKey(matchedStudent.fNo || matchedStudent.formNo);
    if (rForm && sForm && rForm === sForm) {
      return true;
    }

    const rRoll = identityKey(rec.rollNo || rec.classRollNo || rec.roll || rec.examRollNo);
    const sRoll = identityKey(matchedStudent.classRollNo);
    const sExamRoll = identityKey(matchedStudent.examRollNo);
    const isRollMatch = (rRoll && sRoll && rRoll === sRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a') ||
                        (rRoll && sExamRoll && rRoll === sExamRoll && rRoll !== '-' && rRoll !== '—' && rRoll !== 'n/a');

    const rName = String(rec.name || rec.studentName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const sName = String(matchedStudent.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const isNameMatch = rName && sName && rName.length > 3 && (rName === sName || rName.includes(sName) || sName.includes(rName));

    if (isRollMatch) {
      if (rName && sName && !isNameMatch) {
        return false;
      }
      return true;
    }

    if (isNameMatch) return true;
    return false;
  };
}

async function testPublicMatches() {
  const token = await getAccessToken();
  const pracDocs = await fetchDocs('practicalsData', token);
  const admDocs = await fetchDocs('admissions', token);

  const polDoc = pracDocs.find(d => d.id === '11th_Political Science_Pre-Board Test_2025-26');

  console.log("Checking each record in 11th Political Science against admissions:");
  for (const r of polDoc.records) {
    // Find who this record in polDoc corresponds to in admissions
    const admMatch = admDocs.find(s => {
      const cls = String(s['Admission sought for class'] || s.class || s.className || '').trim();
      if (!cls.includes('11')) return false;
      const rRoll = identityKey(s['Class Roll No'] || s.classRollNo || s.rollNo);
      return rRoll && rRoll === identityKey(r.rollNo);
    });

    if (admMatch) {
      const studentObj = {
        name: admMatch["Student's Name (as per school records)"] || admMatch.name || admMatch.studentName,
        classRollNo: admMatch['Class Roll No'] || admMatch.classRollNo || admMatch.rollNo,
        boardRegNo: admMatch['Board Registration Number'] || admMatch.boardRegNo || admMatch.regNo,
        formNo: admMatch['Form Number'] || admMatch.formNo
      };
      const matcher = createPublicMatchRecord(studentObj);
      const isMatched = matcher(r);
      if (!isMatched) {
        console.log(`❌ MISMATCH: Doc Roll ${r.rollNo} Name "${r.name}" vs Adm Roll ${studentObj.classRollNo} Name "${studentObj.name}" RegDoc "${r.regNo}" vs RegAdm "${studentObj.boardRegNo}"`);
      }
    } else {
      console.log(`⚠️ NO ADMISSION RECORD FOUND for Doc Roll ${r.rollNo} Name "${r.name}"`);
    }
  }
}

testPublicMatches().catch(console.error);
