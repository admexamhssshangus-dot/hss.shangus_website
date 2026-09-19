import fs from 'fs';
import https from 'https';
import crypto from 'crypto';

const sa = JSON.parse(fs.readFileSync('scripts/serviceAccount.json', 'utf8'));

function getAccessToken() {
  return new Promise((resolve) => {
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

async function run() {
  const token = await getAccessToken();
  const docsToInspect = [
    'practicalsData/11th,12th_Botany_Pre-Board%20Test_2025-26',
    'practicalsData/history_11th_Botany_Pre-Board%20Test_2025-26_1789487999790',
    'practicalsBin/bin_11th_Botany_Pre-Board%20Test_2025-26_1789826392636',
    'practicalsBin/bin_11th_Botany_Pre-Board%20Test_2025-26_1789526513514'
  ];

  for (const p of docsToInspect) {
    console.log(`\n================== ${p} ==================`);
    const doc = await getDoc(token, p);
    if (!doc.fields) {
      console.log('Not found or empty fields');
      continue;
    }
    const f = doc.fields;
    console.log('maxMarks:', f.maxMarks?.stringValue || f.maxMarks?.integerValue);
    console.log('minMarks:', f.minMarks?.stringValue || f.minMarks?.integerValue);
    console.log('status:', f.status?.stringValue);
    console.log('subject:', f.subject?.stringValue);
    console.log('className:', f.className?.stringValue);

    const recs = (f.records?.arrayValue?.values || []).map(v => {
      const o = {};
      for (const [k, val] of Object.entries(v.mapValue.fields)) {
        o[k] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? '';
      }
      return o;
    });

    console.log('Total records:', recs.length);
    const nonAB = recs.filter(r => r.totalMarks && r.totalMarks !== 'AB' && r.totalMarks !== 'A');
    console.log('Non-AB records (' + nonAB.length + '):');
    nonAB.forEach(r => {
      console.log(`  Roll ${r.rollNo}: ${r.name} (Form: ${r.formNo}) -> practical: "${r.practicalMarks}", viva: "${r.vivaMarks}", total: "${r.totalMarks}", words: "${r.marksInWords}"`);
    });
  }
}

run();
