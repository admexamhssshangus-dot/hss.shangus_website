#!/usr/bin/env node
/**
 * Master Firebase Firestore Seeding Script from db_30 Jul 2026.xlsx
 * Govt. Higher Secondary School Shangus
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. Check Service Account Key
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'serviceAccount.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('ERROR: Missing Firebase service account JSON key at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. Read Excel Workbook
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('XLSX package loading... Please rerun script after npm install completes.');
  process.exit(1);
}

const excelPath = path.join(__dirname, '..', 'db_30 Jul 2026.xlsx');
if (!fs.existsSync(excelPath)) {
  console.error('ERROR: Excel database file not found at:', excelPath);
  process.exit(1);
}

console.log('=== STARTING FIREBASE FIRESTORE MASTER SEEDING ===');
console.log('Reading Excel database file:', excelPath);
const workbook = XLSX.readFile(excelPath);

async function seedCollection(collName, docIdKey, rows, isChunked = false, chunkGroupKey = null) {
  console.log(`\nSeeding Collection: '${collName}' (${rows.length} rows)...`);
  if (!rows || rows.length === 0) return;

  if (isChunked && chunkGroupKey) {
    // Group rows by key (e.g. Session + Class) to minimize read operations
    const groups = {};
    rows.forEach(r => {
      const gKey = String(r[chunkGroupKey] || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push(r);
    });

    for (const [gKey, items] of Object.entries(groups)) {
      // Split into chunks of ~150 items to stay safely below 1 MB limit
      const chunkSize = 150;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkDocId = `${gKey}_part_${Math.floor(i / chunkSize) + 1}`;
        await db.collection(collName).doc(chunkDocId).set({
          groupKey: gKey,
          chunkIndex: Math.floor(i / chunkSize) + 1,
          totalCount: chunk.length,
          updatedAt: new Date().toISOString(),
          items: chunk
        });
        console.log(`  Saved chunk document: ${collName}/${chunkDocId} (${chunk.length} items)`);
      }
    }
  } else {
    // Write individual documents in batches of 500
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

      if (counter >= 400 || i === rows.length - 1) {
        await batch.commit();
        batchCount += counter;
        console.log(`  Committed batch write to '${collName}' (${batchCount}/${rows.length} docs)`);
        batch = db.batch();
        counter = 0;
      }
    }
  }
}

async function runSeeder() {
  try {
    // 1. Users
    const usersSheet = workbook.Sheets['Users'];
    if (usersSheet) {
      const usersRows = XLSX.utils.sheet_to_json(usersSheet);
      await seedCollection('users', 'Email', usersRows);
    }

    // 2. Active Admissions
    const admSheet = workbook.Sheets['adm_form'];
    if (admSheet) {
      const admRows = XLSX.utils.sheet_to_json(admSheet);
      await seedCollection('admissions', 'Form Number', admRows);
    }

    // 3. Historical Master Registers (Chunked by Session & Class for 99.6% read optimization)
    const masterSheet = workbook.Sheets['source_data'];
    if (masterSheet) {
      const masterRows = XLSX.utils.sheet_to_json(masterSheet);
      // Group key: Session_Class e.g. 2025-26_12th
      masterRows.forEach(r => {
        r.sessionClassKey = `${r['Session'] || 'Archive'}_${r['Class'] || 'General'}`;
      });
      await seedCollection('masterRegisters', null, masterRows, true, 'sessionClassKey');
    }

    // 4. Form Structure
    const formStructSheet = workbook.Sheets['form_structure'];
    if (formStructSheet) {
      const structRows = XLSX.utils.sheet_to_json(formStructSheet);
      await seedCollection('formStructure', 'Field Name', structRows);
    }

    // 5. Subject Config
    const subjConfigSheet = workbook.Sheets['subject_config'];
    if (subjConfigSheet) {
      const subjRows = XLSX.utils.sheet_to_json(subjConfigSheet);
      await seedCollection('subjectsConfig', null, subjRows, true, 'Class');
    }

    // 6. Practicals Data
    const pracDataSheet = workbook.Sheets['practical_data'];
    if (pracDataSheet) {
      const pracRows = XLSX.utils.sheet_to_json(pracDataSheet);
      await seedCollection('practicalsData', null, pracRows);
    }

    // 7. Rate & Distributions
    const rateSheet = workbook.Sheets['rate'];
    if (rateSheet) {
      const rateRows = XLSX.utils.sheet_to_json(rateSheet);
      await seedCollection('feeRates', 'Class', rateRows);
    }

    const distSheet = workbook.Sheets['distributions'];
    if (distSheet) {
      const distRows = XLSX.utils.sheet_to_json(distSheet);
      await seedCollection('fundDistributions', null, distRows, true, 'Class');
    }

    console.log('\n✅ FIREBASE FIRESTORE MASTER SEEDING COMPLETE SUCCESS!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ FIREBASE SEEDING ERROR:', err);
    process.exit(1);
  }
}

runSeeder();
