import fs from 'fs';
import https from 'https';
import crypto from 'crypto';

const sa = JSON.parse(fs.readFileSync('scripts/serviceAccount.json', 'utf8'));

function getAccessToken() {
  return new Promise((resolve, reject) => {
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
    const req = https.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d).access_token));
    });
    req.write(postData); req.end();
  });
}

function getDoc(token, path) {
  return new Promise((resolve) => {
    const req = https.request('https://firestore.googleapis.com/v1/projects/' + sa.project_id + '/databases/(default)/documents/' + path, {
      headers: { Authorization: 'Bearer ' + token }
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });
}

async function dryRun() {
  const token = await getAccessToken();
  const d1 = await getDoc(token, 'practicalsData/11th,12th_Botany_Pre-Board%20Test_2025-26');
  const d2 = await getDoc(token, 'practicalsData/11th_Botany_Pre-Board%20Test_2025-26');
  const binDoc = await getDoc(token, 'practicalsBin/bin_11th_Botany_Pre-Board%20Test_2025-26_1789826342228');
  const histDoc = await getDoc(token, 'practicalsData/history_11th_Botany_Pre-Board%20Test_2025-26_1789487999790');

  const parseRecs = (doc) => (doc.fields?.records?.arrayValue?.values || []).map(v => {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields)) {
      o[k] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? '';
    }
    return o;
  });

  const r1 = parseRecs(d1); // from 11th,12th_Botany
  const r2 = parseRecs(d2); // from 11th_Botany
  const rBin = parseRecs(binDoc);
  const rHist = parseRecs(histDoc);

  console.log('11th,12th_Botany records:', r1.length);
  console.log('11th_Botany records:', r2.length);
  console.log('Bin records:', rBin.length);
  console.log('History records:', rHist.length);

  // Check known scores across all sources
  console.log('\n--- SCORES ACROSS SOURCES ---');
  [r1, r2, rBin, rHist].forEach((source, sIdx) => {
    const sName = ['11th,12th_Botany', '11th_Botany', 'Bin_13:59', 'History_Sep15'][sIdx];
    const scored = source.filter(r => r.totalMarks && r.totalMarks !== 'AB' && r.totalMarks !== 'A');
    console.log(`${sName}: ${scored.length} scored`);
    scored.forEach(r => console.log(`  Roll ${r.rollNo}: ${r.name} = total: ${r.totalMarks}, practical: ${r.practicalMarks}, viva: ${r.vivaMarks}`));
  });
}

dryRun();
