const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

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
  'ECONOMICS': 'EC',
  'GEOGRAPHY': 'GG',
  'ACCOUNTANCY': 'AY',
  'BUSINESS STUDIES': 'BS',
  'ENTREPRENEURSHIP': 'EP'
};

async function transformData() {
  console.log('🚀 Starting practicalsData transformation & normalization...');
  try {
    const snap = await getDocs(collection(db, 'practicalsData'));
    console.log(`Found ${snap.docs.length} documents in practicalsData.`);

    let count = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const docId = d.id;

      // Extract Class
      const rawClass = data.className || data.Class || data['Admission sought for class'] || '';
      const clsNorm = String(rawClass).includes('12') ? '12th' : String(rawClass).includes('11') ? '11th' : '11th';

      // Extract Subject
      const rawSubj = data.subjectName || data.Subject || data.subject || data.subjectCode || '';
      let code = 'PH';
      const upperSubj = String(rawSubj).toUpperCase();
      for (const [key, val] of Object.entries(SUBJECT_CODE_MAP)) {
        if (upperSubj.includes(key)) {
          code = val;
          break;
        }
      }
      if (upperSubj.includes('(BO)')) code = 'BO';
      if (upperSubj.includes('(ZO)')) code = 'ZO';
      if (upperSubj.includes('(BI)')) code = upperSubj.includes('BOTANY') ? 'BO' : upperSubj.includes('ZOOLOGY') ? 'ZO' : 'BI';

      // Extract PracticalType
      const pType = String(data.practicalType || data.PracticalType || 'internal').toLowerCase();

      // Extract Year / Session
      const rawSession = data.sessionText || data.SessionText || data.yearSuffix || data.Session || '2025';
      let yearSuffix = '2025';
      const yearMatch = String(rawSession).match(/20\d\d/);
      if (yearMatch) {
        yearSuffix = yearMatch[0];
      }

      // Teacher metadata
      const teacherName = data.teacherName || data['Teacher Name'] || 'Faculty';
      const teacherEmail = data.teacherEmail || data.Email || '';

      // Parse Records
      const records = Array.isArray(data.records) && data.records.length > 0 ? [...data.records] : [];

      Object.keys(data).forEach(k => {
        // Matches "1/201003044. Aarizoo Kawsar (Kawsar Ahmad Itoo)": 3
        const match = k.match(/^(?:(\d+)\/)?(\d+)\.\s*(.+?)(?:\s*\((.+)\))?$/);
        if (match) {
          const serialNo = match[1] ? match[1].trim() : '';
          const boardRoll = match[2].trim();
          const studentName = match[3].trim();
          const parentName = match[4] ? match[4].trim() : '';
          const val = data[k];

          // Check if already in records
          const exists = records.some(r => r.boardRollNo === boardRoll || r.rollNo === serialNo);
          if (!exists) {
            records.push({
              classRollNo: serialNo || boardRoll,
              boardRollNo: boardRoll,
              rollNo: serialNo || boardRoll,
              name: studentName,
              parentName: parentName,
              practicalMarks: val,
              totalMarks: val,
              vivaMarks: ''
            });
          }
        }
      });

      const updatedDoc = {
        ...data,
        className: clsNorm,
        Class: clsNorm,
        subjectCode: code,
        subjectName: rawSubj || code,
        Subject: rawSubj || code,
        practicalType: pType,
        yearSuffix: yearSuffix,
        sessionText: rawSession,
        teacherName: teacherName,
        teacherEmail: teacherEmail,
        records: records,
        updatedAt: new Date().toISOString()
      };

      // 1. Save standardized record to original doc ID (e.g. doc_1)
      await setDoc(doc(db, 'practicalsData', docId), updatedDoc, { merge: true });

      // 2. Also save to new standardized doc ID e.g. 11th_BO_internal_2025
      const newDocId = `${clsNorm}_${code}_${pType}_${yearSuffix}`;
      await setDoc(doc(db, 'practicalsData', newDocId), updatedDoc, { merge: true });

      count++;
      console.log(`✅ Normalised [${count}/${snap.docs.length}]: ${docId} -> ${newDocId} (${records.length} records)`);
    }

    console.log(`\n🎉 Transformation Complete! ${count} documents processed successfully.`);
  } catch (err) {
    console.error('Fatal Transformation Error:', err);
  }
}

transformData();
