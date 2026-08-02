const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const XLSX = require('xlsx');

// 1. Initialize Firebase Admin SDK
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'serviceAccount.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('ERROR: Missing serviceAccount.json at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 2. Read Excel Workbook
const excelPath = path.join(__dirname, '..', 'db_30 Jul 2026.xlsx');
if (!fs.existsSync(excelPath)) {
  console.error('ERROR: Excel file not found at:', excelPath);
  process.exit(1);
}

console.log('=== UPDATING FIRESTORE FROM EXCEL DATABASE ===');
console.log('Reading:', excelPath);
const workbook = XLSX.readFile(excelPath);

async function syncCollection(collName, docIdKey, rows, isChunked = false, chunkGroupKey = null) {
  console.log(`\nSyncing '${collName}' (${rows.length} rows)...`);
  if (!rows || rows.length === 0) return;

  if (isChunked && chunkGroupKey) {
    const groups = {};
    rows.forEach(r => {
      const gKey = String(r[chunkGroupKey] || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push(r);
    });

    for (const [gKey, items] of Object.entries(groups)) {
      const chunkSize = 150;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkDocId = `${gKey}_part_${Math.floor(i / chunkSize) + 1}`;
        try {
          await db.collection(collName).doc(chunkDocId).set({
            groupKey: gKey,
            chunkIndex: Math.floor(i / chunkSize) + 1,
            totalCount: chunk.length,
            updatedAt: new Date().toISOString(),
            items: chunk
          }, { merge: true });
          console.log(`  ✓ Updated chunk: ${collName}/${chunkDocId} (${chunk.length} items)`);
        } catch (e) {
          console.error(`  ✗ Error updating chunk ${collName}/${chunkDocId}:`, e.message);
        }
      }
    }
  } else {
    let batch = db.batch();
    let counter = 0;
    let batchCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const docId = docIdKey && row[docIdKey] ? String(row[docIdKey]).trim() : `doc_${i + 1}`;
      const sanitizedDocId = docId.replace(/\//g, '_').toLowerCase();
      
      const ref = db.collection(collName).doc(sanitizedDocId);
      batch.set(ref, { ...row, updatedAt: new Date().toISOString() }, { merge: true });
      counter++;

      if (counter >= 300 || i === rows.length - 1) {
        try {
          await batch.commit();
          batchCount += counter;
          console.log(`  ✓ Committed batch write to '${collName}' (${batchCount}/${rows.length} docs)`);
        } catch (e) {
          console.error(`  ✗ Error committing batch to '${collName}':`, e.message);
        }
        batch = db.batch();
        counter = 0;
      }
    }
  }
}

async function runSync() {
  try {
    // 1. Source Data (masterRegisters)
    const masterSheet = workbook.Sheets['source_data'];
    if (masterSheet) {
      const masterRows = XLSX.utils.sheet_to_json(masterSheet);
      masterRows.forEach(r => {
        r.sessionClassKey = `${r['Session'] || 'Archive'}_${r['Class'] || 'General'}`;
      });
      await syncCollection('masterRegisters', null, masterRows, true, 'sessionClassKey');
    }

    // 2. Active Admissions (admissions)
    const admSheet = workbook.Sheets['adm_form'];
    if (admSheet) {
      const admRows = XLSX.utils.sheet_to_json(admSheet);
      await syncCollection('admissions', 'Form Number', admRows);
    }

    console.log('\n=== FIRESTORE SYNC COMPLETE ===');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

runSync();
