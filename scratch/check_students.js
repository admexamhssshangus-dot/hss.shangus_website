const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Load Service Account Credentials
const saPath = path.join(__dirname, '../scripts/serviceAccount.json');
if (!fs.existsSync(saPath)) {
  console.error('Service account not found at:', saPath);
  process.exit(1);
}
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

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
        try { resolve(JSON.parse(body).access_token); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function restRequest(p, token) {
  return new Promise((resolve, reject) => {
    const fullPath = '/v1/projects/' + sa.project_id + '/databases/(default)/documents' + p;
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: fullPath,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseDoc(doc) {
  const f = doc.fields || {};
  const res = { id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(f)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else res[k] = v;
  }
  return res;
}

async function auditFirestore() {
  console.log('📡 Connecting to Firebase Project:', sa.project_id);
  const token = await getAccessToken();

  let docs = [];
  let pageToken = '';
  do {
    const url = '/admissions?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
    const res = await restRequest(url, token);
    if (res.documents) docs.push(...res.documents);
    pageToken = res.nextPageToken || '';
  } while (pageToken);

  console.log(`✅ Retrieved ${docs.length} total admission documents from Cloud Firestore.`);

  const parsed = docs.map(parseDoc);

  // Filter for Class 12th Session 2025-26
  const c12 = parsed.filter(s => {
    const cls = String(s.class || s.Class || s['Admission sought for class'] || s.className || '').toLowerCase();
    const sess = String(s.session || s.Session || s['Academic Session'] || '2025-26').trim();
    return cls.includes('12') && sess === '2025-26';
  });

  console.log(`\n📊 Class 12th (Session 2025-26) Summary:`);
  console.log(`- Total Class 12th Documents: ${c12.length}`);

  const withRoll = c12.filter(s => {
    const r = s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo;
    return r && String(r).trim() !== '' && String(r).trim() !== '—' && String(r).trim() !== 'NA';
  });
  console.log(`- Enrolled Students with Class Roll Number: ${withRoll.length}`);

  const rolls = withRoll.map(s => parseInt(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo, 10)).filter(n => !isNaN(n));
  console.log(`- Roll Range: Min ${Math.min(...rolls)} to Max ${Math.max(...rolls)}`);
  console.log(`- Unique Roll Count: ${new Set(rolls).size}`);

  const missing = [];
  const rollSet = new Set(rolls);
  for (let i = 1; i <= 203; i++) {
    if (!rollSet.has(i)) missing.push(i);
  }
  console.log(`- Missing Roll Numbers between 1 and 203: ${missing.length === 0 ? 'None (100% complete!)' : missing.join(', ')}`);

  const statusBreakdown = {};
  c12.forEach(s => {
    const st = s.status || s.Status || 'Unassigned';
    statusBreakdown[st] = (statusBreakdown[st] || 0) + 1;
  });
  console.log(`- Status Distribution in DB:`, statusBreakdown);
  console.log(`  (Note: In the register UI, students with an assigned roll number are automatically included in the default view).`);
}

auditFirestore().catch(err => {
  console.error('Audit failed:', err);
});
