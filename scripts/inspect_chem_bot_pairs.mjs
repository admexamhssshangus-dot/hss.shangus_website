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

async function run() {
  const token = await getAccessToken();
  const docs = [
    'practicalsData/11th,12th_Chemistry_Pre-Board%20Test_2025-26',
    'practicalsData/11th_Chemistry_Pre-Board%20Test_2025-26',
    'practicalsData/11th,12th_Botany_Pre-Board%20Test_2025-26',
    'practicalsData/11th_Botany_Pre-Board%20Test_2025-26'
  ];
  for (const p of docs) {
    const d = await getDoc(token, p);
    const f = d.fields || {};
    const recs = (f.records?.arrayValue?.values || []).map(v => {
      const o = {};
      for (const [k, val] of Object.entries(v.mapValue.fields)) {
        o[k] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? '';
      }
      return o;
    });
    const scored = recs.filter(r => r.totalMarks && r.totalMarks !== 'AB');
    console.log(decodeURIComponent(p.split('/').pop()), {
      updatedAt: d.updateTime,
      status: f.status?.stringValue,
      isDraft: f.isDraft?.booleanValue,
      total: recs.length,
      scoredCount: scored.length,
      sampleScored: scored.slice(0, 5).map(s => `${s.rollNo}: ${s.name} (${s.totalMarks})`)
    });
  }
}

run();
