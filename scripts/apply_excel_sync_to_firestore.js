const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const xlsx = require('xlsx');

const SA_PATH = path.join(__dirname, 'serviceAccount.json');
const EXCEL_PATH = path.join(__dirname, '../db_30 Jul 2026.xlsx');

if (!fs.existsSync(SA_PATH)) {
  console.error(`❌ Service account key not found at: ${SA_PATH}`);
  process.exit(1);
}
const sa = require(SA_PATH);
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
          else reject(new Error(`Failed to obtain access token: ${body}`));
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

    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    Object.keys(val).forEach(k => {
      fields[k] = toFirestoreValue(val[k]);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function commitBatchWrites(writes, token) {
  if (writes.length === 0) return;
  return restRequest('POST', ':commit', { writes }, token);
}

function cleanVal(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normalizeClassVal(c) {
  if (!c) return '11th';
  const str = String(c).toLowerCase().trim();
  if (str.includes('9')) return '9th';
  if (str.includes('10')) return '10th';
  if (str.includes('11')) return '11th';
  if (str.includes('12')) return '12th';
  return String(c).trim();
}

function normalizeSessionVal(s) {
  if (!s) return '2025-26';
  return String(s).trim().replace(/\s+/g, ' ');
}

async function main() {
  console.log('🚀 Starting targeted Firestore synchronization from db_30 Jul 2026.xlsx...');
  const token = await getAccessToken();
  const wb = xlsx.readFile(EXCEL_PATH);

  // ==========================================
  // PART 1: SYNC ADMISSIONS COLLECTION
  // ==========================================
  console.log('\n--- STEP 1: SYNCING [admissions] COLLECTION ---');
  const admSheet = wb.Sheets['admissions'];
  const admRows = xlsx.utils.sheet_to_json(admSheet, { defval: '' });

  // 1A. New admissions to insert:
  const targetNewForms = ['250574', '250571', '250572', '250573', '250576', '250273', '250538'];
  const newRows = admRows.filter(r => targetNewForms.includes(String(r['Form Number'] || '').trim()));
  console.log(`Found ${newRows.length} new admissions to insert.`);

  const newWrites = [];
  newRows.forEach(r => {
    const formNo = String(r['Form Number'] || '').trim();
    const docId = `adm_${formNo}`;
    const docName = `projects/${PROJECT_ID}/databases/(default)/documents/admissions/${docId}`;

    const cleanDoc = {};
    Object.keys(r).forEach(k => {
      const cleanKey = k.replace(/[\r\n\t]+/g, ' ').trim();
      cleanDoc[cleanKey] = r[k];
    });

    cleanDoc.formNo = formNo;
    cleanDoc['Form Number'] = formNo;
    cleanDoc['Form No.'] = formNo;
    cleanDoc.id = docId;
    cleanDoc.docId = docId;
    cleanDoc.class = normalizeClassVal(cleanDoc['Admission sought for class'] || cleanDoc['Class'] || '11th');
    cleanDoc.session = normalizeSessionVal(cleanDoc['Session'] || '2025-26');
    cleanDoc.status = cleanVal(cleanDoc['Status'] || 'Submitted');
    cleanDoc.Status = cleanVal(cleanDoc['Status'] || 'Submitted');
    cleanDoc.rollNo = cleanVal(cleanDoc['Class Roll No'] || cleanDoc['Class Roll No.'] || '');
    cleanDoc['Class Roll No'] = cleanVal(cleanDoc['Class Roll No'] || cleanDoc['Class Roll No.'] || '');
    cleanDoc.updatedAt = new Date().toISOString();
    cleanDoc.createdAt = cleanDoc['Timestamp'] || cleanDoc.updatedAt;

    const firestoreFields = {};
    Object.keys(cleanDoc).forEach(k => {
      firestoreFields[k] = toFirestoreValue(cleanDoc[k]);
    });

    newWrites.push({
      update: {
        name: docName,
        fields: firestoreFields
      }
    });
    console.log(`  ➕ Prepared new admission: ${docId} (${cleanDoc["Student's Name (as per school records)"] || cleanDoc["Student's Name"]}, Class: ${cleanDoc.class}, Roll: ${cleanDoc['Class Roll No'] || '—'})`);
  });

  if (newWrites.length > 0) {
    await commitBatchWrites(newWrites, token);
    console.log(`✅ Successfully inserted ${newWrites.length} new admissions.`);
  }

  // 1B. Existing admissions to update (rolls, status, clearing Arman Javid's roll):
  console.log('\nApplying roll number reassignments and status updates to existing admissions...');
  const existingUpdates = [
    { formNo: '250555', roll: '', note: 'Arman Javid: roll cleared' },
    { formNo: '250043', roll: '110', note: 'Sania Jan' },
    { formNo: '250510', roll: '111', note: 'Rohit Chidanand Raina' },
    { formNo: '250196', roll: '112', note: 'Zaira Jahan' },
    { formNo: '250137', roll: '197', note: 'Arbeena Jan (107 -> 197)' },
    { formNo: '250081', roll: '198', note: 'Nahida Jan (108 -> 198)' },
    { formNo: '250159', roll: '199', note: 'Salma Jan (109 -> 199)' },
    { formNo: '250082', roll: '200', note: 'Rumisa Bashir (110 -> 200)' },
    { formNo: '250130', roll: '201', note: 'Mehvish Rafiq (111 -> 201)' },
    { formNo: '250323', roll: '202', note: 'Farhaan Rashid Wani (112 -> 202)' },
    { formNo: '250111', roll: '203', status: 'Submitted', note: 'Burhan Tariq (Draft -> Submitted, Roll 203)' }
  ];

  const patchWrites = [];
  existingUpdates.forEach(u => {
    const docId = `adm_${u.formNo}`;
    const docName = `projects/${PROJECT_ID}/databases/(default)/documents/admissions/${docId}`;

    const fieldsToUpdate = {
      'Class Roll No': toFirestoreValue(u.roll),
      'rollNo': toFirestoreValue(u.roll),
      'updatedAt': toFirestoreValue(new Date().toISOString())
    };

    const updateMaskFieldPaths = ['`Class Roll No`', 'rollNo', 'updatedAt'];

    if (u.status) {
      fieldsToUpdate['Status'] = toFirestoreValue(u.status);
      fieldsToUpdate['status'] = toFirestoreValue(u.status);
      updateMaskFieldPaths.push('Status', 'status');
    }

    patchWrites.push({
      update: {
        name: docName,
        fields: fieldsToUpdate
      },
      updateMask: {
        fieldPaths: updateMaskFieldPaths
      }
    });
    console.log(`  🔄 Prepared patch for ${docId}: Roll='${u.roll}' (${u.note})`);
  });

  if (patchWrites.length > 0) {
    await commitBatchWrites(patchWrites, token);
    console.log(`✅ Successfully updated ${patchWrites.length} existing admissions.`);
  }

  // ==========================================
  // PART 2: SYNC MASTERREGISTERS COLLECTION
  // ==========================================
  console.log('\n--- STEP 2: SYNCING [masterRegisters] COLLECTION ---');
  const srcSheet = wb.Sheets['source_data'];
  const srcRows = xlsx.utils.sheet_to_json(srcSheet, { defval: '' });
  console.log(`Total source_data rows in Excel: ${srcRows.length}`);

  const ITEMS_PER_CHUNK = 50;
  const totalChunks = Math.ceil(srcRows.length / ITEMS_PER_CHUNK);
  console.log(`Chunking into ${totalChunks} documents of ~${ITEMS_PER_CHUNK} items each...`);

  const CHUNKS_BATCH_SIZE = 10;
  let chunksWritten = 0;

  for (let bStart = 0; bStart < totalChunks; bStart += CHUNKS_BATCH_SIZE) {
    const bEnd = Math.min(bStart + CHUNKS_BATCH_SIZE, totalChunks);
    const chunkBatchWrites = [];

    for (let chunkIdx = bStart; chunkIdx < bEnd; chunkIdx++) {
      const start = chunkIdx * ITEMS_PER_CHUNK;
      const end = Math.min(start + ITEMS_PER_CHUNK, srcRows.length);
      const chunkRows = srcRows.slice(start, end);

      const chunkItems = chunkRows.map((r, itemIdx) => {
        const cleanItem = {};
        Object.keys(r).forEach(k => {
          const cleanKey = k.replace(/[\r\n\t]+/g, ' ').trim();
          cleanItem[cleanKey] = r[k];
        });
        cleanItem._globalIndex = start + itemIdx;
        cleanItem.class = normalizeClassVal(cleanItem['Class'] || '11th');
        cleanItem.session = normalizeSessionVal(cleanItem['Session'] || '2025-26');
        return cleanItem;
      });

      const chunkDocId = `chunk_${String(chunkIdx + 1).padStart(3, '0')}`;
      const docName = `projects/${PROJECT_ID}/databases/(default)/documents/masterRegisters/${chunkDocId}`;

      const chunkDocData = {
        chunkIndex: chunkIdx + 1,
        itemCount: chunkItems.length,
        rangeStart: start,
        rangeEnd: end - 1,
        updatedAt: new Date().toISOString(),
        items: chunkItems
      };

      const firestoreFields = {};
      Object.keys(chunkDocData).forEach(k => {
        firestoreFields[k] = toFirestoreValue(chunkDocData[k]);
      });

      chunkBatchWrites.push({
        update: {
          name: docName,
          fields: firestoreFields
        }
      });
    }

    await commitBatchWrites(chunkBatchWrites, token);
    chunksWritten += (bEnd - bStart);
    console.log(`  - Uploaded chunks ${bStart + 1} to ${bEnd} (${chunksWritten} / ${totalChunks} complete)...`);
  }
  console.log(`✅ [masterRegisters] chunk import complete (${chunksWritten} chunks, ${srcRows.length} records).`);

  // 2B. Clean up any stale flat documents in masterRegisters (documents without items)
  console.log('\nChecking and pruning stale/flat docs in masterRegisters...');
  let pageToken = '';
  let staleDeleted = 0;
  do {
    const listRes = await restRequest('GET', `/masterRegisters?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, null, token);
    const docs = listRes.documents || [];
    pageToken = listRes.nextPageToken || '';

    const staleDeletes = [];
    for (const d of docs) {
      const docId = d.name.split('/').pop();
      // Valid chunk docs are chunk_001 to chunk_123 with an items array
      const hasItems = !!d.fields?.items;
      const isStandardChunk = /^chunk_\d{3}$/.test(docId);
      if (!hasItems || !isStandardChunk) {
        staleDeletes.push({ delete: d.name });
        staleDeleted++;
        console.log(`  🗑️ Removing stale/flat doc from masterRegisters: ${docId}`);
      }
    }

    if (staleDeletes.length > 0) {
      await commitBatchWrites(staleDeletes, token);
    }
  } while (pageToken);
  console.log(`✅ Stale document cleanup complete (${staleDeleted} non-chunk/flat docs removed).`);

  // ==========================================
  // PART 3: VERIFICATION
  // ==========================================
  console.log('\n--- STEP 3: VERIFYING SYNCED DATABASE ---');

  // Verify Arman Javid
  const armanAdm = await restRequest('GET', '/admissions/adm_250555', null, token);
  console.log('Verification adm_250555 (Arman Javid): Class Roll No =', armanAdm.fields?.['Class Roll No']?.stringValue || 'EMPTY');

  // Verify Sujan Ahmad Bhat
  const sujanAdm = await restRequest('GET', '/admissions/adm_250574', null, token);
  console.log('Verification adm_250574 (Sujan Ahmad Bhat): Name =', sujanAdm.fields?.["Student's Name (as per school records)"]?.stringValue, ', Roll =', sujanAdm.fields?.['Class Roll No']?.stringValue);

  // Verify Sheezan Nazir
  const sheezanAdm = await restRequest('GET', '/admissions/adm_250571', null, token);
  console.log('Verification adm_250571 (SHEEZAN NAZIR): Name =', sheezanAdm.fields?.["Student's Name (as per school records)"]?.stringValue, ', Roll =', sheezanAdm.fields?.['Class Roll No']?.stringValue);

  // Verify Arbeena Jan
  const arbeenaAdm = await restRequest('GET', '/admissions/adm_250137', null, token);
  console.log('Verification adm_250137 (Arbeena Jan): Name =', arbeenaAdm.fields?.["Student's Name (as per school records)"]?.stringValue, ', Roll =', arbeenaAdm.fields?.['Class Roll No']?.stringValue);

  console.log('\n🎉 ALL FIRESTORE SYNCHRONIZATION TASKS COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('❌ FATAL ERROR DURING SYNC:', err);
  process.exit(1);
});
