// =================================================================
// HSS SHANGUS — Master Registers Migration: Chunks -> Individual Docs
// =================================================================
// 1. Reads all 123 legacy chunk documents in masterRegisters
// 2. Unpacks every student item with deterministic document IDs
// 3. Normalizes canonical session, class, stream, and board identifiers
// 4. Writes individual student documents to masterRegisters
// 5. Backs up original chunks into 'masterRegisters_legacy_chunks'
// =================================================================

import fs from 'fs';
import https from 'https';
import crypto from 'crypto';

const SA_PATH = 'scripts/serviceAccount.json';
if (!fs.existsSync(SA_PATH)) {
  console.error('ERROR: Missing serviceAccount.json at:', SA_PATH);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const PROJECT_ID = sa.project_id || 'hsssdb';
const isDryRun = !process.argv.includes('--commit');

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
          else reject(new Error('Token error: ' + body));
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
    const u = new URL('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents' + endpoint);
    const data = payload ? JSON.stringify(payload) : null;

    const req = https.request({
      hostname: u.hostname,
      port: 443,
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
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          } else {
            resolve(parsed);
          }
        } catch (e) { reject(new Error(body)); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function restRequestWithRetry(method, endpoint, payload, token, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await restRequest(method, endpoint, payload, token);
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.warn(`[Network Retry] Attempt ${attempt} failed with ${err.message || err}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Convert Firestore REST format to JS object
function fromFirestore(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.arrayValue !== undefined) {
      res[k] = (v.arrayValue.values || []).map(item => {
        if (item.mapValue) return fromFirestore(item.mapValue.fields);
        if (item.stringValue !== undefined) return item.stringValue;
        if (item.integerValue !== undefined) return parseInt(item.integerValue, 10);
        return item;
      });
    } else if (v.mapValue !== undefined) {
      res[k] = fromFirestore(v.mapValue.fields);
    } else {
      res[k] = v;
    }
  }
  return res;
}

// Convert JS object to Firestore REST format
function toFirestore(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null) fields[k] = { nullValue: null };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: String(v) };
      else fields[k] = { doubleValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map(item => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') return Number.isInteger(item) ? { integerValue: String(item) } : { doubleValue: item };
            if (typeof item === 'object' && item !== null) return { mapValue: { fields: toFirestore(item) } };
            return { stringValue: String(item) };
          })
        }
      };
    } else if (typeof v === 'object') {
      fields[k] = { mapValue: { fields: toFirestore(v) } };
    }
  }
  return fields;
}

export function generateMasterRegisterDocId(student, fallbackIndex = 0) {
  const rawSession = String(student.session || student.Session || student['Academic Session'] || 'unknown')
    .replace(/[^a-zA-Z0-9-]/g, '');
  const rawClass = String(student.class || student.Class || '11th').toLowerCase();
  let classKey = '11th';
  if (rawClass.includes('9')) classKey = '9th';
  else if (rawClass.includes('10')) classKey = '10th';
  else if (rawClass.includes('11')) classKey = '11th';
  else if (rawClass.includes('12')) classKey = '12th';

  const reg = String(student['Board Registration Number'] || student['Board Reg. No.'] || student.boardRegNo || student.regNo || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const form = String(student['Form No.'] || student['Form Number'] || student.formNo || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const adm = String(student['Adm. No.'] || student['Admission No'] || student.admNo || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const roll = String(student['Class R.No.'] || student['Class Roll No'] || student.classRollNo || student.rollNo || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const sno = String(student['S.No.'] || student._globalIndex || fallbackIndex).trim();

  // Primary: reg if available and valid length
  if (reg && reg.length >= 6) {
    return `mr_${rawSession}_${classKey}_reg_${reg}`;
  }
  // Secondary: form if available
  if (form && form.length >= 2) {
    return `mr_${rawSession}_${classKey}_form_${form}`;
  }
  // Tertiary: adm if available
  if (adm && adm.length >= 1) {
    return `mr_${rawSession}_${classKey}_adm_${adm}`;
  }
  // Fallback: roll or sno
  if (roll) {
    return `mr_${rawSession}_${classKey}_roll_${roll}`;
  }
  return `mr_${rawSession}_${classKey}_sno_${sno}`;
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`HSS SHANGUS: Master Registers Migration to Flat Docs`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Inspection & Preview only)' : 'LIVE COMMIT (Will update Firestore)'}`);
  console.log(`======================================================\n`);

  const token = await getAccessToken();

  console.log('1. Loading all chunk documents from masterRegisters...');
  let pageToken = '';
  const chunkDocs = [];
  const existingFlatDocs = [];

  let pageCount = 0;
  do {
    pageCount++;
    const queryStr = pageToken ? `?pageSize=300&pageToken=${pageToken}` : '?pageSize=300';
    const res = await restRequestWithRetry('GET', `/masterRegisters${queryStr}`, null, token);
    const docs = res.documents || [];
    pageToken = res.nextPageToken || '';
    console.log(`Loaded page ${pageCount} (${docs.length} documents retrieved)...`);

    for (const d of docs) {
      const docId = d.name.split('/').pop();
      const rawData = fromFirestore(d.fields);
      const items = rawData.items || rawData.students || rawData.records || rawData.data;

      if (Array.isArray(items) && items.length > 0) {
        chunkDocs.push({ id: docId, rawData, items, path: d.name });
      } else if (!docId.startsWith('mr_')) {
        existingFlatDocs.push({ id: docId, rawData, path: d.name });
      }
    }
  } while (pageToken);

  console.log(`Found ${chunkDocs.length} chunk documents containing student arrays.`);
  console.log(`Found ${existingFlatDocs.length} existing flat documents.\n`);

  // 2. Unpack students with deterministic IDs and collision detection
  console.log('2. Unpacking and normalizing student records...');
  const individualDocs = new Map();
  const sessionBreakdown = new Map();
  let totalExtracted = 0;
  let collisionsResolved = 0;

  for (const chunk of chunkDocs) {
    const parentSession = chunk.rawData.session || chunk.rawData.Session || chunk.rawData['Academic Session'] || '';
    const parentClass = chunk.rawData.class || chunk.rawData.Class || '';
    const parentStream = chunk.rawData.stream || chunk.rawData.Stream || '';

    for (let idx = 0; idx < chunk.items.length; idx++) {
      const s = chunk.items[idx];
      if (!s || typeof s !== 'object') continue;
      if (s.Status === 'Deleted' || s.status === 'Deleted' || s._deleted === true) continue;

      totalExtracted++;

      const sSession = String(s.session || s.Session || s['Academic Session'] || parentSession || 'unknown').trim();
      const rawClass = String(s.class || s.Class || s['Class'] || parentClass || '11th').toLowerCase();
      let canonicalClass = '11th';
      if (rawClass.includes('9')) canonicalClass = '9th';
      else if (rawClass.includes('10')) canonicalClass = '10th';
      else if (rawClass.includes('11')) canonicalClass = '11th';
      else if (rawClass.includes('12')) canonicalClass = '12th';

      const sStream = String(s.stream || s.Stream || parentStream || '').trim();

      let targetId = generateMasterRegisterDocId({ ...s, session: sSession, class: canonicalClass }, totalExtracted);

      // Handle collision where 2 different students share an ID (e.g. S.No. or roll collision)
      if (individualDocs.has(targetId)) {
        const existing = individualDocs.get(targetId);
        const exName = String(existing.studentName || existing["Student's Name"] || '').toLowerCase().trim();
        const curName = String(s.studentName || s["Student's Name"] || '').toLowerCase().trim();
        const exFather = String(existing.fatherName || existing["Father's Name"] || '').toLowerCase().trim();
        const curFather = String(s.fatherName || s["Father's Name"] || '').toLowerCase().trim();

        const isDifferentPerson = (exName && curName && exName !== curName) || (exFather && curFather && exFather !== curFather);
        if (isDifferentPerson) {
          collisionsResolved++;
          targetId = `${targetId}_${chunk.id}_${idx}`;
        }
      }

      const flatPayload = {
        ...s,
        id: targetId,
        _docId: targetId,
        _source: 'masterRegisters',
        _srcCollection: 'masterRegisters',
        _isHistorical: true,
        session: sSession,
        Session: sSession,
        canonicalSession: sSession,
        class: canonicalClass,
        Class: canonicalClass,
        canonicalClass,
        stream: sStream,
        Stream: sStream,
        status: s.status || s.Status || 'Approved',
        Status: s.Status || s.status || 'Approved',
        _migratedFromChunk: chunk.id,
        _migratedAt: new Date().toISOString()
      };

      // Strip legacy nested parent links
      delete flatPayload._parentDocId;
      delete flatPayload._arrayKey;

      individualDocs.set(targetId, flatPayload);

      // Session stats
      sessionBreakdown.set(sSession, (sessionBreakdown.get(sSession) || 0) + 1);
    }
  }

  console.log(`Total students extracted: ${totalExtracted}`);
  console.log(`Total unique individual documents to write: ${individualDocs.size}`);
  console.log(`Collisions safely disambiguated: ${collisionsResolved}`);

  console.log('\n--- Student Count by Academic Session ---');
  const sortedSessions = Array.from(sessionBreakdown.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  for (const [sess, count] of sortedSessions) {
    console.log(`  ${sess.padEnd(20)}: ${count} students`);
  }

  if (isDryRun) {
    console.log('\n======================================================');
    console.log('DRY-RUN COMPLETE! No changes were made to Firestore.');
    console.log('To execute the live migration, run:');
    console.log('  node scripts/migrate_master_registers_to_flat_docs.mjs --commit');
    console.log('======================================================\n');
    return;
  }

  // Merge any partial edit data from existing flat docs
  let mergedEditsCount = 0;
  for (const flat of existingFlatDocs) {
    const raw = flat.rawData;
    const reg = String(raw.boardRegNo || raw.regNo || raw['Board Registration Number'] || raw['Registration No.'] || '').trim().replace(/[^a-zA-Z0-9]/g, '');
    const form = String(raw.formNo || raw['Form No.'] || raw['Form Number'] || '').trim().replace(/[^a-zA-Z0-9]/g, '');

    for (const [docId, payload] of individualDocs.entries()) {
      const pReg = String(payload.boardRegNo || payload.regNo || payload['Board Registration Number'] || '').trim().replace(/[^a-zA-Z0-9]/g, '');
      const pForm = String(payload.formNo || payload['Form No.'] || payload['Form Number'] || '').trim().replace(/[^a-zA-Z0-9]/g, '');

      if ((reg && pReg && reg === pReg) || (form && pForm && form === pForm)) {
        mergedEditsCount++;
        individualDocs.set(docId, { ...payload, ...raw, id: docId, _docId: docId });
        break;
      }
    }
  }
  if (mergedEditsCount > 0) {
    console.log(`Merged ${mergedEditsCount} existing direct field edits into migrated records.`);
  }

  // 3. LIVE COMMIT: Write flat documents in batches using Firestore Commit API
  console.log('\n3. Starting Live Batched Commit to masterRegisters...');
  const docEntries = Array.from(individualDocs.entries());
  const BATCH_SIZE = 250;
  let committed = 0;

  for (let i = 0; i < docEntries.length; i += BATCH_SIZE) {
    const chunk = docEntries.slice(i, i + BATCH_SIZE);
    const writes = chunk.map(([docId, payload]) => {
      return {
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/masterRegisters/${docId}`,
          fields: toFirestore(payload)
        }
      };
    });

    const commitPayload = { writes };
    await restRequestWithRetry('POST', ':commit', commitPayload, token);
    committed += chunk.length;
    console.log(`Committed ${committed} / ${individualDocs.size} documents (${Math.round((committed / individualDocs.size) * 100)}%)...`);
  }

  console.log('\nAll individual student documents successfully written!');

  // 4. Backup chunk documents to masterRegisters_legacy_chunks
  console.log('\n4. Backing up original chunk documents to masterRegisters_legacy_chunks...');
  const CHUNK_BACKUP_BATCH_SIZE = 5;
  let backupCommitted = 0;
  for (let i = 0; i < chunkDocs.length; i += CHUNK_BACKUP_BATCH_SIZE) {
    const chunk = chunkDocs.slice(i, i + CHUNK_BACKUP_BATCH_SIZE);
    const writes = chunk.map(c => {
      return {
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/masterRegisters_legacy_chunks/${c.id}`,
          fields: toFirestore(c.rawData)
        }
      };
    });

    await restRequestWithRetry('POST', ':commit', { writes }, token);
    backupCommitted += chunk.length;
    console.log(`Backed up ${backupCommitted} / ${chunkDocs.length} chunk containers (${Math.round((backupCommitted / chunkDocs.length) * 100)}%)...`);
  }

  console.log('\nAll original chunks backed up to masterRegisters_legacy_chunks!');

  // 5. Delete container chunk documents and obsolete partial docs from masterRegisters
  console.log('\n5. Purging original chunk container documents from masterRegisters...');
  const docsToPurge = [...chunkDocs.map(c => c.id), ...existingFlatDocs.map(f => f.id)];
  console.log(`Documents to purge: ${docsToPurge.length} (chunks: ${chunkDocs.length}, legacy flat: ${existingFlatDocs.length})`);
  const DELETE_BATCH_SIZE = 100;
  let deletedCount = 0;
  for (let i = 0; i < docsToPurge.length; i += DELETE_BATCH_SIZE) {
    const chunk = docsToPurge.slice(i, i + DELETE_BATCH_SIZE);
    const writes = chunk.map(docId => {
      return {
        delete: `projects/${PROJECT_ID}/databases/(default)/documents/masterRegisters/${docId}`
      };
    });

    await restRequestWithRetry('POST', ':commit', { writes }, token);
    deletedCount += chunk.length;
    console.log(`Purged ${deletedCount} / ${docsToPurge.length} legacy/temporary documents (${Math.round((deletedCount / docsToPurge.length) * 100)}%)...`);
  }

  console.log(`\n\n======================================================`);
  console.log(`MIGRATION COMPLETED SUCCESSFULLY!`);
  console.log(`Total Individual Documents Created: ${individualDocs.size}`);
  console.log(`Total Chunks Backed Up: ${chunkDocs.length}`);
  console.log(`Total Chunks Purged from masterRegisters: ${chunkDocs.length}`);
  console.log(`======================================================\n`);
}

run().catch(err => {
  console.error('\nMigration Error:', err);
  process.exit(1);
});
