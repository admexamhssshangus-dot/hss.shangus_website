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

  console.log('--- Verifying Botany 11th Document ---');
  const botDoc = await getDoc(token, 'practicalsData/11th_Botany_Pre-Board%20Test_2025-26');
  const f = botDoc.fields;
  console.log('Status:', f.status?.stringValue);
  console.log('Class:', f.className?.stringValue);
  console.log('Max Marks:', f.maxMarks?.stringValue);
  console.log('Min Marks:', f.minMarks?.stringValue);

  const recs = (f.records?.arrayValue?.values || []).map(v => {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields)) {
      o[k] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? '';
    }
    return o;
  });

  const saira = recs.find(r => r.rollNo === '4' || r.formNo === '250083');
  const mozim = recs.find(r => r.rollNo === '3' || r.formNo === '250204');
  const uzma = recs.find(r => r.rollNo === '5' || r.formNo === '250218');

  console.log('Saira Jan (Roll 4):', saira ? `Practical: ${saira.practicalMarks}, Total: ${saira.totalMarks}, In Words: ${saira.marksInWords}` : 'NOT FOUND');
  console.log('Mozim (Roll 3):', mozim ? `Practical: ${mozim.practicalMarks}, Total: ${mozim.totalMarks}, In Words: ${mozim.marksInWords}` : 'NOT FOUND');
  console.log('Uzma (Roll 5):', uzma ? `Practical: ${uzma.practicalMarks}, Total: ${uzma.totalMarks}, In Words: ${uzma.marksInWords}` : 'NOT FOUND');

  const blanks = recs.filter(r => !r.totalMarks && !r.practicalMarks);
  const falseAbsents = recs.filter(r => r.totalMarks === 'AB' || r.practicalMarks === 'AB');
  console.log(`Summary: Total ${recs.length} records | ${recs.length - blanks.length} Scored | ${blanks.length} Blank/Pending | ${falseAbsents.length} False ABs`);

  console.log('\n--- Verifying Chemistry Documents (MUST BE UNTOUCHED) ---');
  const chem12 = await getDoc(token, 'practicalsData/12th_Chemistry_Pre-Board%20Test_2025-26');
  const chem11_12 = await getDoc(token, 'practicalsData/11th,12th_Chemistry_Pre-Board%20Test_2025-26');

  console.log('12th Chemistry Status:', chem12.fields?.status?.stringValue, 'Records:', (chem12.fields?.records?.arrayValue?.values || []).length);
  console.log('11th,12th Chemistry Status:', chem11_12.fields?.status?.stringValue, 'Records:', (chem11_12.fields?.records?.arrayValue?.values || []).length);

  console.log('\nVerification complete!');
}

run();
