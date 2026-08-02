const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDhVgqXBo93FGXAm9YrG8x40Oa9pApu0bo",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function extractStudentClass(st) {
  if (!st) return '';
  return (st.class || st.Class || st['Class'] || st['Class for which Admission Sought'] || st['Admission sought for class'] || st['Class Enrolled'] || st.className || '');
}

function isClassMatch(stClass, targetClass) {
  if (!stClass || !targetClass) return false;
  const c1 = String(stClass).toLowerCase().replace(/class/gi, '').trim();
  const c2 = String(targetClass).toLowerCase().replace(/class/gi, '').trim();
  if (c1 === c2) return true;
  const d1 = c1.match(/\d+/)?.[0];
  const d2 = c2.match(/\d+/)?.[0];
  return !!(d1 && d2 && d1 === d2);
}

function hasAssignedClassRoll(st) {
  if (!st) return false;
  const roll = String(
    st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st['Class R.No'] ||
    st['Class R. No.'] || st.classRollNo || st.rollNo || st['Roll No.'] || st['Roll No'] || st.roll_no || ''
  ).trim();
  if (!roll || roll === '—' || roll === 'N/A' || roll.toLowerCase() === 'undefined' || roll.toLowerCase() === 'null') return false;
  return true;
}

async function investigateSessions() {
  console.log('=== INVESTIGATING ACTUAL SESSION FIELD VALUES ===\n');

  const masterSnap = await getDocs(collection(db, 'masterRegisters'));
  let allCandidates = [];

  masterSnap.docs.forEach(d => {
    const data = d.data();
    const items = data.items || data.data || data.records;
    const docSession = data.Session || data.session || data.groupKey?.split('_')[0] || data.id?.split('_')[0] || '';
    const docClass = data.class || data.Class || data.groupKey?.split('_')[1] || '';

    if (Array.isArray(items)) {
      items.forEach(it => allCandidates.push({
        ...it,
        _docSession: docSession,
        session: it.Session || it.session || docSession,
        class: it.class || it.Class || it['Class'] || docClass
      }));
    } else {
      allCandidates.push({ ...data, _docSession: docSession, session: data.Session || data.session || docSession, class: data.class || data.Class || docClass });
    }
  });

  const admSnap = await getDocs(collection(db, 'admissions'));
  admSnap.docs.forEach(d => {
    const data = d.data();
    const items = data.items || data.students || data.records;
    const docSession = data.Session || data.session || '2026';
    const docClass = data.class || data.Class || data['Admission sought for class'] || '';

    if (Array.isArray(items)) {
      items.forEach(it => allCandidates.push({
        ...it,
        _docSession: docSession,
        session: it.Session || it.session || docSession,
        class: it.class || it.Class || it['Class'] || docClass
      }));
    } else {
      allCandidates.push({ ...data, _docSession: docSession, session: data.Session || data.session || docSession, class: data.class || data.Class || docClass });
    }
  });

  // Group by class + session value
  const groups = {};
  for (const st of allCandidates) {
    if (!hasAssignedClassRoll(st)) continue;
    const cls = extractStudentClass(st);
    if (!isClassMatch(cls, '11th') && !isClassMatch(cls, '12th')) continue;
    const clsNorm = isClassMatch(cls, '11th') ? '11' : '12';
    const ses = String(st.session || '').trim() || '(empty)';
    const key = `${clsNorm}th | session="${ses}"`;
    if (!groups[key]) groups[key] = 0;
    groups[key]++;
  }

  console.log('CLASS + SESSION FIELD BREAKDOWN (students with assigned roll only):');
  const keys = Object.keys(groups).sort();
  for (const k of keys) {
    console.log(`  ${k} -> ${groups[k]} students`);
  }

  // Specifically check 11th 2025-26 — what is stored as their session?
  console.log('\n\nSAMPLE RECORDS for 11th 2025-26 students:');
  let cnt = 0;
  for (const st of allCandidates) {
    if (cnt >= 5) break;
    const cls = extractStudentClass(st);
    if (!isClassMatch(cls, '11th')) continue;
    if (!hasAssignedClassRoll(st)) continue;
    const ses = String(st.session || '').trim();
    if (ses === '2026' || ses === '2025-26' || ses.includes('2026')) {
      const roll = st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st.classRollNo || st.rollNo || '';
      const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st['Name'] || st.name || '';
      console.log(`  Roll=${roll}, Name=${name}, session="${ses}", _docSession="${st._docSession}"`);
      cnt++;
    }
  }

  // Check 12th 2025-26 sample
  console.log('\nSAMPLE RECORDS for 12th 2025-26 students:');
  cnt = 0;
  for (const st of allCandidates) {
    if (cnt >= 5) break;
    const cls = extractStudentClass(st);
    if (!isClassMatch(cls, '12th')) continue;
    if (!hasAssignedClassRoll(st)) continue;
    const ses = String(st.session || '').trim();
    if (ses === '2026' || ses === '2025-26' || ses.includes('2026')) {
      const roll = st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st.classRollNo || st.rollNo || '';
      const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st['Name'] || st.name || '';
      console.log(`  Roll=${roll}, Name=${name}, session="${ses}", _docSession="${st._docSession}"`);
      cnt++;
    }
  }

  // Check 12th 2024-25 samples
  console.log('\nSAMPLE RECORDS for 12th session 2024-25 area:');
  cnt = 0;
  for (const st of allCandidates) {
    if (cnt >= 10) break;
    const cls = extractStudentClass(st);
    if (!isClassMatch(cls, '12th')) continue;
    if (!hasAssignedClassRoll(st)) continue;
    const ses = String(st.session || '').trim();
    if (ses.includes('2025') || ses.includes('2024-25') || ses === '2025') {
      const roll = st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st.classRollNo || st.rollNo || '';
      const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st['Name'] || st.name || '';
      console.log(`  Roll=${roll}, Name=${name}, session="${ses}", _docSession="${st._docSession}"`);
      cnt++;
    }
  }

  process.exit(0);
}

investigateSessions().catch(e => { console.error(e); process.exit(1); });
