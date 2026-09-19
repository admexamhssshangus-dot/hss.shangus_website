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

async function run() {
  const token = await getAccessToken();
  const pData = await listDocs(token, 'practicalsData');
  const practicalDocs = pData.documents.map(d => {
    const id = d.name.split('/').pop();
    const f = d.fields || {};
    const obj = { id };
    for (const [k, v] of Object.entries(f)) {
      if (v.stringValue !== undefined) obj[k] = v.stringValue;
      else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
      else if (v.integerValue !== undefined) obj[k] = v.integerValue;
      else if (v.arrayValue !== undefined) {
        obj[k] = (v.arrayValue.values || []).map(item => {
          const rec = {};
          for (const [rk, rv] of Object.entries(item.mapValue.fields)) {
            rec[rk] = rv.stringValue ?? rv.integerValue ?? rv.doubleValue ?? '';
          }
          return rec;
        });
      }
    }
    return obj;
  });

  const cat = JSON.parse(fs.readFileSync('src/data/verifiedStudentsCatalog.json', 'utf8'));

  // Test students: Saira Jan (Roll 4, Form 250083), Mozim (Roll 3, Form 250204)
  const studentsToTest = cat.filter(s => s.className === '11th' && ['250083', '250204', '250218'].includes(String(s.fNo || s.formNo)));

  console.log('Found students in catalog:', studentsToTest.map(s => `${s.name} (${s.fNo || s.formNo})`));

  // Simulation of PublicResultLookup filterAndDeduplicateSections
  const matchingSections = practicalDocs.filter(sec => {
    if (!Array.isArray(sec.records) || sec.records.length === 0) return false;
    const rawId = String(sec.id || '');
    if (rawId.startsWith('history_') || rawId.startsWith('bin_') || (sec.isDraft === true && sec.status !== 'approved')) return false;
    const c = String(sec.className || '').toLowerCase();
    if (!c.includes('11')) return false;
    const evalType = String(sec.practicalType || sec.evaluationType || '').toLowerCase();
    if (!evalType.includes('preboard') && !evalType.includes('pre-board')) return false;
    const sess = String(sec.sessionCanonical || sec.yearSuffix || sec.session || '');
    if (!sess.includes('2025-26') && !sess.includes('2026')) return false;
    return true;
  });

  console.log('\nMatching Practical Sections for 11th Pre-Board:', matchingSections.map(s => `${s.id} (code: ${s.subjectCode}, recs: ${s.records.length})`));

  studentsToTest.forEach(st => {
    console.log(`\n========================================`);
    console.log(`Student: ${st.name} (Form: ${st.fNo || st.formNo}, Reg: ${st.boardRegNo || st.regNo})`);
    console.log(`Enrolled subjects in catalog:`, st.subjects);

    // Look for Botany, Zoology, Biology sections
    matchingSections.forEach(sec => {
      const rec = sec.records.find(r => {
        const rReg = String(r.regNo || '').replace(/[^0-9]/g, '');
        const sReg = String(st.boardRegNo || st.regNo || '').replace(/[^0-9]/g, '');
        if (rReg && sReg && rReg === sReg) return true;
        const rForm = String(r.formNo || '').trim();
        const sForm = String(st.fNo || st.formNo || '').trim();
        if (rForm && sForm && rForm === sForm) return true;
        const rName = String(r.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const sName = String(st.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (rName && sName && rName.length > 3 && (rName === sName || rName.includes(sName) || sName.includes(rName))) return true;
        return false;
      });

      console.log(`  Section: ${sec.id}`);
      if (rec) {
        console.log(`    -> Matched record: Roll ${rec.rollNo}, Name ${rec.name}, TotalMarks: "${rec.totalMarks}", Practical: "${rec.practicalMarks}", Viva: "${rec.vivaMarks}"`);
      } else {
        console.log(`    -> NO match in this section`);
      }
    });
  });
}

run();
