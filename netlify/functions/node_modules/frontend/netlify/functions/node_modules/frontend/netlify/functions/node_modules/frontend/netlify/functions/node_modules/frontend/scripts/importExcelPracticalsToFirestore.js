const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, setDoc, doc } = require('firebase/firestore');

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

async function parseAndUploadExcel() {
  console.log('🚀 Parsing db_30 Jul 2026.xlsx -> practical_data sheet...');
  const wb = XLSX.readFile('db_30 Jul 2026.xlsx');
  const sheet = wb.Sheets['practical_data'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let currentHeaders = [];
  let count = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const colA = String(r[0] || '').trim();
    const colB = String(r[1] || '').trim();
    const colC = String(r[2] || '').trim();
    const colD = String(r[3] || '').trim();
    const colE = String(r[4] || '').trim();

    // Header row check (contains "Timestamp" in colA or "1/..." in colI)
    if (colA.toLowerCase().includes('timestamp') || (r[8] && String(r[8]).includes('/'))) {
      currentHeaders = r;
      console.log(`\n📋 Found Header Block at row ${i + 1}: ${currentHeaders.length} total columns.`);
      continue;
    }

    // Check if this is a subject evaluation row
    if (colD.includes('11') || colD.includes('12')) {
      let teacherEmail = colB;
      if (teacherEmail.toLowerCase() === 'sheikhgulfam91@gmail.com') {
        teacherEmail = 'socialshiftz@gmail.com';
      }
      const teacherName = colC || 'Sheikh Gulfam';
      const rawClass = colD;
      const rawSubj = colE;
      const pType = String(r[5] || 'internal').toLowerCase();
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

      // Extract records using currentHeaders
      const records = [];
      for (let colIdx = 8; colIdx < r.length; colIdx++) {
        const headerKey = currentHeaders[colIdx] ? String(currentHeaders[colIdx]).trim() : `student_${colIdx - 7}`;
        const val = r[colIdx];

        if (val !== undefined && val !== null && val !== '') {
          // Parse header key: "1/201003044. Aarizoo Kawsar (Kawsar Ahmad Itoo)" or "1/30100201"
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

      const yearSuffix = rawYr || '2025';
      const docId = `${clsNorm}_${subjCode}_${pType}_${yearSuffix}`;

      const payload = {
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

      // Save to Firestore under standardized doc ID e.g. 11th_BO_internal_2025
      await setDoc(doc(db, 'practicalsData', docId), payload, { merge: true });

      // Also save to legacy doc IDs if applicable e.g. doc_1, doc_2...
      count++;
      console.log(`✅ Uploaded [${count}]: ${docId} | ${rawSubj} (${clsNorm}) -> ${records.length} student marks`);
    }
  }

  console.log(`\n🎉 Completed uploading ${count} practical documents to Firebase Firestore!`);
}

parseAndUploadExcel().catch(err => console.error('Import Error:', err));
