const path = require('path');
const XLSX = require('xlsx');

const functionDirectory = path.join(__dirname, '..', 'netlify', 'functions');
const { initializeApp, cert } = require(require.resolve('firebase-admin/app', { paths: [functionDirectory] }));
const { getFirestore, FieldValue } = require(require.resolve('firebase-admin/firestore', { paths: [functionDirectory] }));
const serviceAccount = require(path.join(__dirname, 'serviceAccount.json'));

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// 1. Read Excel workbook
const excelPath = path.join(__dirname, '..', 'db_30 Jul 2026.xlsx');
console.log('Loading Excel:', excelPath);
const wb = XLSX.readFile(excelPath);
const sourceSheet = wb.Sheets['source_data'];
const sourceRows = XLSX.utils.sheet_to_json(sourceSheet, { defval: '' });

console.log(`Total source_data rows in Excel: ${sourceRows.length}`);

function normalize(val) {
  return String(val || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function isEmpty(val) {
  if (val === undefined || val === null) return true;
  const s = String(val).trim();
  return s === '' || s === '—' || s === '-' || s === 'N/A' || s === 'NA' || s === 'Nill' || s === 'null' || s === 'undefined';
}

// Map ALL rows in source_data by Board Reg No.
const completeExcelByReg = new Map();
const c10ExcelByReg = new Map();

sourceRows.forEach((r, idx) => {
  const reg = normalize(r['Board Reg. No.']);
  const cls = String(r['Class'] || '').trim().toLowerCase();
  const sess = String(r['Session'] || '').trim().toLowerCase();

  if (reg) {
    if (!completeExcelByReg.has(reg)) {
      completeExcelByReg.set(reg, []);
    }
    completeExcelByReg.get(reg).push({ rowIdx: idx + 2, data: r });
  }

  if ((cls === '10th' || cls === '10') && sess.includes('2024-25') && sess.includes('oct')) {
    if (reg) {
      c10ExcelByReg.set(reg, { rowIdx: idx + 2, data: r });
    }
  }
});

console.log(`Distinct Regs across all source_data: ${completeExcelByReg.size}`);
console.log(`Class 10th 2024-25 (Oct-Nov) Regs in Excel: ${c10ExcelByReg.size}`);

async function applyEnrichment() {
  console.log('\n--- Fetching chunk_005 and chunk_006 from masterRegisters ---');
  
  const targetDocIds = ['chunk_005', 'chunk_006'];
  let totalUpdatedStudents = 0;
  let totalFieldsPopulated = 0;

  for (const docId of targetDocIds) {
    const docRef = db.collection('masterRegisters').doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.error(`Document ${docId} does not exist in masterRegisters!`);
      continue;
    }

    const data = snap.data();
    const arrayKey = ['items', 'students', 'records', 'data'].find(k => Array.isArray(data[k]));
    if (!arrayKey) {
      console.error(`Document ${docId} has no student array!`);
      continue;
    }

    const items = data[arrayKey];
    let docModified = false;
    let docStudentsUpdated = 0;
    let docFieldsUpdated = 0;

    const updatedItems = items.map((st, idx) => {
      const cls = String(st.selectedClass || st.class || st.Class || st['Class'] || '').trim().toLowerCase();
      const sess = String(st.session || st.Session || st['Session'] || '').trim().toLowerCase();

      // Only target Class 10th Session 2024-25 (Oct-Nov)
      if (!((cls === '10th' || cls.includes('10th')) && sess.includes('2024-25') && sess.includes('oct'))) {
        return st; // Leave all other students completely untouched
      }

      const reg = normalize(st.regNo || st.boardRegNo || st['Board Reg. No.'] || st['Board Registration Number']);
      if (!reg) return st;

      const directC10 = c10ExcelByReg.get(reg);
      const allRecordsForReg = completeExcelByReg.get(reg) || [];

      if (!directC10 && allRecordsForReg.length === 0) return st;

      // Synthesize combined Excel fields
      const combinedExcel = {};
      allRecordsForReg.forEach(({ data: rData }) => {
        for (const [k, v] of Object.entries(rData)) {
          if (!isEmpty(v) && isEmpty(combinedExcel[k])) {
            if (k !== 'Class' && k !== 'Session' && k !== 'Stream') {
              combinedExcel[k] = v;
            }
          }
        }
      });

      if (directC10) {
        for (const [k, v] of Object.entries(directC10.data)) {
          if (!isEmpty(v)) {
            combinedExcel[k] = v;
          }
        }
      }

      // Clone student to apply non-destructive updates
      const updatedStudent = { ...st };
      let studentModified = false;

      for (const [k, exVal] of Object.entries(combinedExcel)) {
        if (isEmpty(exVal)) continue;

        // Strict rule: ONLY input data into empty cells in Firebase
        const fbVal = updatedStudent[k];
        if (isEmpty(fbVal)) {
          updatedStudent[k] = exVal;
          studentModified = true;
          docFieldsUpdated++;
        }
      }

      // Also ensure standard canonical alias fields are set if empty:
      if (isEmpty(updatedStudent.admNo) && !isEmpty(updatedStudent['Adm. No.'])) {
        updatedStudent.admNo = updatedStudent['Adm. No.'];
      }
      if (isEmpty(updatedStudent.admissionNo) && !isEmpty(updatedStudent['Adm. No.'])) {
        updatedStudent.admissionNo = updatedStudent['Adm. No.'];
      }
      if (isEmpty(updatedStudent.admDate) && !isEmpty(updatedStudent['Adm. Date'])) {
        updatedStudent.admDate = updatedStudent['Adm. Date'];
      }
      if (isEmpty(updatedStudent.admissionDate) && !isEmpty(updatedStudent['Adm. Date'])) {
        updatedStudent.admissionDate = updatedStudent['Adm. Date'];
      }
      if (isEmpty(updatedStudent.village) && !isEmpty(updatedStudent['Village/Town'])) {
        updatedStudent.village = updatedStudent['Village/Town'];
      }
      if (isEmpty(updatedStudent.regNo) && !isEmpty(updatedStudent['Board Reg. No.'])) {
        updatedStudent.regNo = updatedStudent['Board Reg. No.'];
      }
      if (isEmpty(updatedStudent.boardRegNo) && !isEmpty(updatedStudent['Board Reg. No.'])) {
        updatedStudent.boardRegNo = updatedStudent['Board Reg. No.'];
      }
      if (isEmpty(updatedStudent.formNo) && !isEmpty(updatedStudent['Form No.'])) {
        updatedStudent.formNo = updatedStudent['Form No.'];
      }
      if (isEmpty(updatedStudent.dob) && !isEmpty(updatedStudent['DoB (figures)'])) {
        updatedStudent.dob = updatedStudent['DoB (figures)'];
      }
      if (isEmpty(updatedStudent.dobRaw) && !isEmpty(updatedStudent['DoB (figures)'])) {
        updatedStudent.dobRaw = updatedStudent['DoB (figures)'];
      }

      if (studentModified) {
        docStudentsUpdated++;
        docModified = true;
      }

      return updatedStudent;
    });

    if (docModified) {
      console.log(`Writing updates to ${docId}: ${docStudentsUpdated} students updated, ${docFieldsUpdated} empty fields populated.`);
      await docRef.set({
        [arrayKey]: updatedItems,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      totalUpdatedStudents += docStudentsUpdated;
      totalFieldsPopulated += docFieldsUpdated;
      console.log(`Successfully saved ${docId}.`);
    } else {
      console.log(`No modifications needed for ${docId}.`);
    }
  }

  console.log('\n==================================================');
  console.log(`ENRICHMENT COMPLETED SUCCESSFULLY:`);
  console.log(`Total students updated: ${totalUpdatedStudents}`);
  console.log(`Total empty fields populated from Excel: ${totalFieldsPopulated}`);
  console.log(`==================================================\n`);
}

applyEnrichment().then(() => process.exit(0)).catch(e => {
  console.error('Error applying enrichment:', e);
  process.exit(1);
});
