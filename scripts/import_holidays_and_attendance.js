const XLSX = require('xlsx');
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'serviceAccount.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'hsssdb'
  });
}

const db = admin.firestore();

function formatExcelDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'number') {
    const parsed = XLSX.SSF.parse_date_code(dateVal);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(dateVal).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const m = parts[0].padStart(2, '0');
      const d = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return str;
}

async function runImport() {
  console.log('📖 Reading db_30 Jul 2026.xlsx...');
  const wb = XLSX.readFile('db_30 Jul 2026.xlsx');

  // 1. Process Holidays
  const hSheet = wb.Sheets['holidays_attendance'];
  if (hSheet) {
    const hRows = XLSX.utils.sheet_to_json(hSheet);
    console.log(`🎉 Found ${hRows.length} holiday records in Excel...`);
    let hCount = 0;
    for (const r of hRows) {
      const dateStr = formatExcelDate(r.Date);
      if (!dateStr || !r.Label) continue;

      const docId = `holiday_${dateStr}`;
      const holidayData = {
        date: dateStr,
        dateStr: dateStr,
        label: String(r.Label).trim(),
        purpose: r.Purpose ? String(r.Purpose).trim() : '',
        updatedAt: new Date().toISOString()
      };

      await db.collection('holidays').doc(docId).set(holidayData, { merge: true });
      hCount++;
    }
    console.log(`✅ Successfully uploaded ${hCount} holiday documents to Firestore!`);
  }

  // 2. Process Attendance Records
  const aSheet = wb.Sheets['attendance'];
  if (aSheet) {
    const aRows = XLSX.utils.sheet_to_json(aSheet);
    console.log(`📋 Found ${aRows.length} attendance row entries in Excel...`);

    // Group attendance rows by Class + Date + Subject
    const grouped = {};
    for (const r of aRows) {
      const dateStr = formatExcelDate(r.Date);
      const className = String(r.Class || r.class || '12th').trim();
      const teacher = String(r.Teacher || r.teacher || 'socialshiftz@gmail.com').trim();
      const subjRaw = String(r.Subject || r.subject || 'General').trim();
      const rollNo = String(r['Roll No'] || r.rollNo || r.RollNo || '').trim();
      const rawStatus = String(r.Status || r.status || 'P').trim().toUpperCase();
      const status = rawStatus === 'PRESENT' || rawStatus === 'P' ? 'P' :
                     rawStatus === 'ABSENT' || rawStatus === 'A' ? 'A' :
                     rawStatus === 'LEAVE' || rawStatus === 'L' ? 'L' : 'P';

      if (!dateStr || !rollNo) continue;

      let subjCode = 'BO';
      let subjName = 'Botany';
      const codeMatch = subjRaw.match(/\(([^)]+)\)/);
      if (codeMatch) {
        subjCode = codeMatch[1].trim().toUpperCase();
        subjName = subjRaw.replace(/\([^)]+\)/, '').trim();
      } else if (subjRaw.toLowerCase().includes('botany')) {
        subjCode = 'BO';
        subjName = 'Botany';
      } else if (subjRaw.toLowerCase().includes('urdu')) {
        subjCode = 'UR';
        subjName = 'Urdu';
      }

      const clsNorm = className.replace(/class/i, '').trim();

      // Create primary doc ID with Subject Code (e.g. 11th_2026-03-09_bo)
      const primaryKey = `${clsNorm}_${dateStr}_${subjCode.toLowerCase()}`;
      // Create secondary doc ID with Full Name (e.g. 11th_2026-03-09_botany (bo))
      const fullKey = `${clsNorm}_${dateStr}_${subjRaw.toLowerCase()}`;

      [primaryKey, fullKey].forEach(groupKey => {
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            className: clsNorm.endsWith('th') ? clsNorm : `${clsNorm}th`,
            session: '2025-26',
            date: dateStr,
            dateStr: dateStr,
            subject: subjCode,
            subjectCode: subjCode,
            subjectName: subjName,
            subjectFull: subjRaw,
            teacher: teacher,
            updatedAt: new Date().toISOString(),
            records: []
          };
        }

        // Avoid duplicate roll numbers in records array
        const existingIdx = grouped[groupKey].records.findIndex(rec => rec.rollNo === rollNo);
        if (existingIdx === -1) {
          grouped[groupKey].records.push({
            rollNo: rollNo,
            classRollNo: rollNo,
            status: status
          });
        }
      });
    }

    const groupKeys = Object.keys(grouped);
    console.log(`📦 Grouped into ${groupKeys.length} attendance session documents (including code & name variants)...`);

    let aCount = 0;
    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const gKey of groupKeys) {
      const attData = grouped[gKey];
      const docRef = db.collection('attendance').doc(gKey);
      batch.set(docRef, attData, { merge: true });
      batchCount++;
      aCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`✅ Successfully uploaded ${aCount} attendance documents to Firestore!`);
  }

  console.log('🚀 Firestore seeding completed successfully!');
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import error:', err);
  process.exit(1);
});
