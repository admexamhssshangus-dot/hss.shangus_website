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

function listDocs(token, collection) {
  return new Promise((resolve) => {
    const req = https.request('https://firestore.googleapis.com/v1/projects/' + sa.project_id + '/databases/(default)/documents/' + collection + '?pageSize=300', {
      headers: { Authorization: 'Bearer ' + token }
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
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
  const targetCols = ['practicalsData', 'practicalsBin', 'recycleBin'];

  for (const c of targetCols) {
    console.log(`\n=== Collection: ${c} ===`);
    const dList = await listDocs(token, c);
    if (!dList.documents) continue;
    const matching = dList.documents.filter(doc => {
      const id = doc.name.split('/').pop().toLowerCase();
      return id.includes('botan') || id.includes('biol') || id.includes('_bo_') || id.includes('_bi_');
    });
    for (const m of matching) {
      const id = m.name.split('/').pop();
      const full = await getDoc(token, c + '/' + encodeURIComponent(id));
      const f = full.fields || {};
      const recs = (f.records?.arrayValue?.values || f.data?.mapValue?.fields?.records?.arrayValue?.values || []).map(v => {
        const o = {};
        for (const [k, val] of Object.entries(v.mapValue.fields)) {
          o[k] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? '';
        }
        return o;
      });
      const scored = recs.filter(r => r.totalMarks && r.totalMarks !== 'AB' && r.totalMarks !== 'A');
      console.log(`\nDoc ID: ${id}`);
      console.log(`  Updated: ${full.updateTime}, Created: ${full.createTime}`);
      console.log(`  Status: ${f.status?.stringValue || f.originalStatus?.stringValue}, isDraft: ${f.isDraft?.booleanValue}`);
      console.log(`  Records: ${recs.length}, Scored: ${scored.length}`);
      if (scored.length > 0) {
        console.log('  Scored Sample:');
        scored.slice(0, 10).forEach(s => {
          console.log(`    Roll ${s.rollNo || '?'}: ${s.name} (Form: ${s.formNo || '?'}, Reg: ${s.regNo || '?'}) = ${s.totalMarks}`);
        });
      }
    }
  }
}

run();
