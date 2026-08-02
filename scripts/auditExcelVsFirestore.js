const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDhVgqXBo93FGXAm9YrG8x40Oa9pApu0bo",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SUBJECT_CODE_MAP = {
  'BOTANY': 'BO',
  'ZOOLOGY': 'ZO',
  'BIOLOGY': 'BI',
  'PHYSICS': 'PH',
  'CHEMISTRY': 'CH',
  'GENERAL ENGLISH': 'EN',
  'ENVIRONMENTAL SCIENCE': 'ES',
  'PHYSICAL EDUCATION': 'PD',
  'HEALTHCARE': 'HTC',
  'IT AND ITES': 'ITE',
  'IT & ITES': 'ITE',
  'MATHEMATICS': 'MA',
  'URDU': 'UR',
  'EDUCATION': 'ED',
  'HISTORY': 'HT',
  'POLITICAL SCIENCE': 'PS',
  'ECONOMICS': 'EC'
};

async function auditAndUpdate() {
  console.log('🔍 Auditing db_30 Jul 2026.xlsx [practical_data] vs Firestore [practicalsData]...');
  const wb = XLSX.readFile('db_30 Jul 2026.xlsx');
  const sheet = wb.Sheets['practical_data'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let currentHeaders = [];
  const excelDocMap = new Map();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const colA = String(r[0] || '').trim();
    const colB = String(r[1] || '').trim();
    const colC = String(r[2] || '').trim();
    const colD = String(r[3] || '').trim();
    const colE = String(r[4] || '').trim();

    // Check if this row is a header row (contains "Timestamp" or student roll column "1/...")
    if (colA.toLowerCase().includes('timestamp') || (r[8] && String(r[8]).includes('/'))) {
      currentHeaders = r;
      console.log(`\n📋 Header Block at Excel Row ${i + 1}: ${currentHeaders.length} columns.`);
      continue;
    }

    if (colD.includes('11') || colD.includes('12')) {
      let teacherEmail = colB;
      if (teacherEmail.toLowerCase() === 'sheikhgulfam91@gmail.com') {
        teacherEmail = 'socialshiftz@gmail.com';
      }
      const teacherName = colC || 'Faculty';
      const rawClass = colD;
      const rawSubj = colE;
      const pType = String(r[5] || 'internal').toLowerCase().trim();
      const rawYr = String(r[6] || '2025').trim();
      const sessionText = String(r[7] || '').trim();

      const clsNorm = rawClass.includes('12') ? '12th' : '11th';

      // Map subject to code
      let subjCode = 'PH';
      const upperSubj = rawSubj.toUpperCase();
      for (const [key, val] of Object.entries(SUBJECT_CODE_MAP)) {
        if (upperSubj.includes(key)) {
          subjCode = val;
          break;
        }
      }
      if (upperSubj.includes('(BO)')) subjCode = 'BO';
      if (upperSubj.includes('(ZO)')) subjCode = 'ZO';
      if (upperSubj.includes('(BI)')) subjCode = upperSubj.includes('BOTANY') ? 'BO' : upperSubj.includes('ZOOLOGY') ? 'ZO' : 'BI';

      const yearSuffix = rawYr || '2025';
      const docId = `${clsNorm}_${subjCode}_${pType}_${yearSuffix}`;

      // Extract records
      const records = [];
      for (let colIdx = 8; colIdx < r.length; colIdx++) {
        const headerKey = currentHeaders[colIdx] ? String(currentHeaders[colIdx]).trim() : `student_${colIdx - 7}`;
        const val = r[colIdx];

        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const match = headerKey.match(/^(?:(\d+)\/)?(\d+)?(?:\.\s*(.+?)(?:\s*\((.+)\))?)?$/);
          let serialNo = '';
          let boardRoll = '';
          let studentName = '';
          let parentName = '';

          if (match) {
            serialNo = match[1] ? match[1].trim() : '';
            boardRoll = match[2] ? match[2].trim() : '';
            studentName = match[3] ? match[3].trim() : '';
            parentName = match[4] ? match[4].trim() : '';
          }

          records.push({
            classRollNo: serialNo || boardRoll || `${colIdx - 7}`,
            boardRollNo: boardRoll,
            rollNo: serialNo || boardRoll || `${colIdx - 7}`,
            name: studentName || `Student ${serialNo || boardRoll}`,
            parentName: parentName,
            practicalMarks: val,
            totalMarks: val,
            vivaMarks: ''
          });
        }
      }

      const docPayload = {
        docId,
        className: clsNorm,
        Class: clsNorm,
        subjectCode: subjCode,
        subjectName: rawSubj,
        Subject: rawSubj,
        practicalType: pType,
        yearSuffix: yearSuffix,
        sessionText: sessionText,
        teacherName: teacherName,
        teacherEmail: teacherEmail,
        records: records,
        updatedAt: new Date().toISOString()
      };

      excelDocMap.set(docId, docPayload);
      console.log(`📌 Excel Row ${i + 1} -> DocID: ${docId} | ${rawSubj} (${clsNorm}) -> ${records.length} marks`);
    }
  }

  console.log(`\nFound ${excelDocMap.size} unique evaluation documents in Excel.`);

  // Compare with Firestore
  console.log('\nChecking current Firestore practicalsData collection...');
  const snap = await getDocs(collection(db, 'practicalsData'));
  console.log(`Current Firestore docs count: ${snap.docs.length}`);

  let updatedCount = 0;
  let deletedCount = 0;

  // 1. Sync all Excel documents into Firestore
  for (const [dId, payload] of excelDocMap.entries()) {
    await setDoc(doc(db, 'practicalsData', dId), payload, { merge: true });
    updatedCount++;
    console.log(`✅ Synced to Firestore: ${dId} (${payload.records.length} records)`);
  }

  // 2. Clean up any invalid or duplicate legacy document IDs (e.g. doc_1, doc_14, 11th_PH_practicaltype_2025)
  for (const d of snap.docs) {
    const dId = d.id;
    if (dId.startsWith('doc_') || dId.includes('practicaltype')) {
      console.log(`🗑️ Deleting outdated legacy/invalid doc: ${dId}`);
      await deleteDoc(doc(db, 'practicalsData', dId));
      deletedCount++;
    }
  }

  console.log(`\n🎉 Audit & Update Complete! Synced ${updatedCount} valid documents, cleaned up ${deletedCount} legacy docs.`);
}

auditAndUpdate().catch(err => console.error('Audit Error:', err));
