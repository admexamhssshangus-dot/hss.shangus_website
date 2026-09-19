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

function patchDoc(token, path, fields, updateMask) {
  return new Promise((resolve, reject) => {
    const maskQuery = updateMask.map(m => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}?${maskQuery}`;
    const body = JSON.stringify({ fields });
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function createDoc(token, collection, docId, fields) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${collection}?documentId=${encodeURIComponent(docId)}`;
    const body = JSON.stringify({ fields });
    const req = https.request(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function numberToWords(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return '';
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
    'Twenty-One', 'Twenty-Two', 'Twenty-Three', 'Twenty-Four', 'Twenty-Five', 'Twenty-Six', 'Twenty-Seven', 'Twenty-Eight', 'Twenty-Nine', 'Thirty',
    'Thirty-One', 'Thirty-Two', 'Thirty-Three', 'Thirty-Four', 'Thirty-Five', 'Thirty-Six', 'Thirty-Seven', 'Thirty-Eight', 'Thirty-Nine', 'Forty',
    'Forty-One', 'Forty-Two', 'Forty-Three', 'Forty-Four', 'Forty-Five', 'Forty-Six', 'Forty-Seven', 'Forty-Eight', 'Forty-Nine', 'Fifty'
  ];
  return words[n] || String(n);
}

function objToFirestoreMap(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      fields[k] = { stringValue: '' };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      fields[k] = { integerValue: String(v) };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  }
  return { mapValue: { fields } };
}

async function run() {
  const token = await getAccessToken();

  console.log('1. Reading current Botany documents...');
  const docPath = 'practicalsData/11th_Botany_Pre-Board%20Test_2025-26';
  const dualDocPath = 'practicalsData/11th,12th_Botany_Pre-Board%20Test_2025-26';

  const currentDoc = await getDoc(token, docPath);
  const currentDualDoc = await getDoc(token, dualDocPath);

  // Step 1: Backup current documents to practicalsBin
  const backupId1 = `bin_11th_Botany_Pre-Board Test_2025-26_${Date.now()}`;
  console.log(`2. Creating backup in practicalsBin: ${backupId1}...`);
  if (currentDoc && currentDoc.fields) {
    await createDoc(token, 'practicalsBin', backupId1, {
      ...currentDoc.fields,
      archivedAt: { stringValue: new Date().toISOString() },
      archivedReason: { stringValue: 'pre_repair_backup_before_botany_reflection_fix' }
    });
    console.log('   -> Backup 1 created successfully.');
  }

  const backupId2 = `bin_11th_12th_Botany_Pre-Board Test_2025-26_${Date.now()}`;
  if (currentDualDoc && currentDualDoc.fields) {
    await createDoc(token, 'practicalsBin', backupId2, {
      ...currentDualDoc.fields,
      archivedAt: { stringValue: new Date().toISOString() },
      archivedReason: { stringValue: 'pre_repair_backup_before_botany_reflection_fix' }
    });
    console.log('   -> Backup 2 created successfully.');
  }

  // Step 2: Build clean records array
  // Retrieve raw records from 11th_Botany
  const rawValues = currentDoc.fields?.records?.arrayValue?.values || currentDualDoc.fields?.records?.arrayValue?.values || [];
  console.log(`3. Processing ${rawValues.length} student records for Botany (11th)...`);

  const knownScores = {
    // Saira Jan (Roll 4, Form 250083): 15 marks
    '4': { practical: '15', total: 15, words: 'Fifteen' },
    '250083': { practical: '15', total: 15, words: 'Fifteen' },
    // Mozim Ahmed Allie (Roll 3, Form 250204): 5 marks
    '3': { practical: '5', total: 5, words: 'Five' },
    '250204': { practical: '5', total: 5, words: 'Five' },
    // Uzma Jan (Roll 5, Form 250218): 18 marks (from 36/50 in history)
    '5': { practical: '18', total: 18, words: 'Eighteen' },
    '250218': { practical: '18', total: 18, words: 'Eighteen' }
  };

  let scoredCount = 0;
  let pendingCount = 0;

  const repairedRecords = rawValues.map((v) => {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields)) {
      o[k] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? '';
    }

    const roll = String(o.rollNo || '').trim();
    const form = String(o.formNo || '').trim();

    // Check if known score exists
    const match = knownScores[roll] || knownScores[form];
    if (match) {
      scoredCount++;
      return {
        rollNo: roll,
        name: o.name || '',
        formNo: form,
        regNo: o.regNo || '',
        examRollNo: o.examRollNo || '',
        practicalMarks: match.practical,
        vivaMarks: '',
        totalMarks: match.total,
        marksInWords: match.words
      };
    }

    // For all other students who were previously auto-marked AB, reset to blank/pending ""
    pendingCount++;
    return {
      rollNo: roll,
      name: o.name || '',
      formNo: form,
      regNo: o.regNo || '',
      examRollNo: o.examRollNo || '',
      practicalMarks: '',
      vivaMarks: '',
      totalMarks: '',
      marksInWords: ''
    };
  });

  console.log(`   -> Repaired ${repairedRecords.length} records: ${scoredCount} Scored, ${pendingCount} Pending/Blank (zero false AB).`);

  const firestoreRecordsArray = {
    arrayValue: {
      values: repairedRecords.map(objToFirestoreMap)
    }
  };

  // Step 3: Patch 11th_Botany_Pre-Board Test_2025-26
  console.log('4. Updating practicalsData/11th_Botany_Pre-Board Test_2025-26...');
  const patchPayload = {
    records: firestoreRecordsArray,
    className: { stringValue: '11th' },
    status: { stringValue: 'approved' },
    isDraft: { booleanValue: false },
    isPendingApproval: { booleanValue: false },
    subject: { stringValue: 'Botany' },
    subjectCode: { stringValue: 'BO' },
    evaluationType: { stringValue: 'Pre-Board Test' },
    practicalType: { stringValue: 'Pre-Board Test' },
    session: { stringValue: '2025-26' },
    yearSuffix: { stringValue: '2025-26' },
    maxMarks: { stringValue: '25' },
    minMarks: { stringValue: '9' },
    updatedAt: { stringValue: new Date().toISOString() }
  };

  const updateMask = ['records', 'className', 'status', 'isDraft', 'isPendingApproval', 'subject', 'subjectCode', 'evaluationType', 'practicalType', 'session', 'yearSuffix', 'maxMarks', 'minMarks', 'updatedAt'];

  await patchDoc(token, 'practicalsData/11th_Botany_Pre-Board%20Test_2025-26', patchPayload, updateMask);
  console.log('   -> 11th_Botany_Pre-Board Test_2025-26 updated successfully.');

  // Step 4: Also update 11th,12th_Botany_Pre-Board Test_2025-26 to match so no conflict occurs
  console.log('5. Synchronizing practicalsData/11th,12th_Botany_Pre-Board Test_2025-26...');
  await patchDoc(token, 'practicalsData/11th,12th_Botany_Pre-Board%20Test_2025-26', {
    ...patchPayload,
    className: { stringValue: '11th' }
  }, updateMask);
  console.log('   -> Synchronized successfully.');

  console.log('Botany database repair complete!');
}

run();
