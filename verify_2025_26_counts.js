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
  return (
    st.class || st.Class || st['Class'] ||
    st['Class for which Admission Sought'] ||
    st['Admission sought for class'] ||
    st['Class Enrolled'] || st.className || ''
  );
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
    st['Class Roll No'] ||
    st['Class Roll No.'] ||
    st['Class R.No.'] ||
    st['Class R.No'] ||
    st['Class R. No.'] ||
    st.classRollNo ||
    st.rollNo ||
    st['Roll No.'] ||
    st['Roll No'] ||
    st.roll_no ||
    ''
  ).trim();

  if (!roll || roll === '—' || roll === 'N/A' || roll.toLowerCase() === 'undefined' || roll.toLowerCase() === 'null') {
    return false;
  }
  return true;
}

function getSessionEndYear(sessionStr) {
  const s = String(sessionStr || '').trim();
  const rangeMatch = s.match(/\b(20\d\d)-(\d\d)\b/);
  if (rangeMatch) {
    return '20' + rangeMatch[2];
  }
  const yearMatch = s.match(/\b(20\d\d)\b/);
  if (yearMatch) {
    return yearMatch[1];
  }
  return '';
}

function isSessionMatch(stSession, targetYearSuffix) {
  if (!stSession) return true;
  const sStr = String(stSession).toLowerCase().trim();
  const tStr = String(targetYearSuffix).toLowerCase().trim();

  if (sStr === tStr) return true;

  const aprBianPattern = /\b(apr|bian|biannual|bi-annual|private|annual\s*private)\b/i;
  const sIsAprBian = aprBianPattern.test(sStr);
  const tIsAprBian = aprBianPattern.test(tStr);

  if (sIsAprBian !== tIsAprBian) return false;

  const sIsMarApr = sStr.includes('mar-apr') || sStr.includes('mar/apr');
  const tIsMarApr = tStr.includes('mar-apr') || tStr.includes('mar/apr');
  const sIsOctNov = sStr.includes('oct-nov') || sStr.includes('oct/nov') || sStr.includes('revised');
  const tIsOctNov = tStr.includes('oct-nov') || tStr.includes('oct/nov') || tStr.includes('revised');

  if (sIsMarApr && tIsOctNov) return false;
  if (sIsOctNov && tIsMarApr) return false;

  const sEndYear = getSessionEndYear(sStr);
  const tEndYear = getSessionEndYear(tStr);

  if (sEndYear && tEndYear) {
    return sEndYear === tEndYear;
  }

  return sStr.includes(tStr) || tStr.includes(sStr);
}

async function verifyCounts() {
  console.log('=== VERIFYING 2025-26 STUDENT COUNTS ===');

  const masterSnap = await getDocs(collection(db, 'masterRegisters'));
  let allCandidates = [];

  masterSnap.docs.forEach(d => {
    const data = d.data();
    const items = data.items || data.data || data.records;
    const docSession = data.Session || data.session || data.groupKey?.split('_')[0] || data.id?.split('_')[0] || '';
    const docClass = data.class || data.Class || data.groupKey?.split('_')[1] || '';

    if (Array.isArray(items)) {
      items.forEach(it => {
        allCandidates.push({
          ...it,
          session: it.Session || it.session || docSession,
          class: it.class || it.Class || it['Class'] || docClass
        });
      });
    } else {
      allCandidates.push({
        ...data,
        session: data.Session || data.session || docSession,
        class: data.class || data.Class || docClass
      });
    }
  });

  const admSnap = await getDocs(collection(db, 'admissions'));
  admSnap.docs.forEach(d => {
    const data = d.data();
    const items = data.items || data.students || data.records;
    const docSession = data.Session || data.session || '2026';
    const docClass = data.class || data.Class || data['Admission sought for class'] || '';

    if (Array.isArray(items)) {
      items.forEach(it => {
        allCandidates.push({
          ...it,
          session: it.Session || it.session || docSession,
          class: it.class || it.Class || it['Class'] || docClass
        });
      });
    } else {
      allCandidates.push({
        ...data,
        session: data.Session || data.session || docSession,
        class: data.class || data.Class || docClass
      });
    }
  });

  console.log('Total candidates loaded:', allCandidates.length);

  // 11th Class Session 2025-26 (targetYearSuffix = 2026)
  const c11_2026 = allCandidates.filter(st => {
    const cls = extractStudentClass(st);
    const ses = st.session || st.Session;
    return isClassMatch(cls, '11th') && isSessionMatch(ses, '2026') && hasAssignedClassRoll(st);
  });

  // De-duplicate
  const map11 = new Map();
  c11_2026.forEach(st => {
    const roll = st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st['Class R.No'] || st.classRollNo || st.rollNo || st.id || '';
    if (roll && !map11.has(String(roll).trim())) map11.set(String(roll).trim(), st);
  });

  console.log('\n--- 11th Class 2025-26 (Reg. 2026) ---');
  console.log('  Total with assigned class roll:', c11_2026.length);
  console.log('  Unique by Class Roll No:', map11.size);

  // 12th Class Session 2025-26 (targetYearSuffix = 2026)
  const c12_2026 = allCandidates.filter(st => {
    const cls = extractStudentClass(st);
    const ses = st.session || st.Session;
    return isClassMatch(cls, '12th') && isSessionMatch(ses, '2026') && hasAssignedClassRoll(st);
  });

  const map12 = new Map();
  c12_2026.forEach(st => {
    const roll = st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st['Class R.No'] || st.classRollNo || st.rollNo || st.id || '';
    if (roll && !map12.has(String(roll).trim())) map12.set(String(roll).trim(), st);
  });

  console.log('\n--- 12th Class 2025-26 (Reg. 2026) ---');
  console.log('  Total with assigned class roll:', c12_2026.length);
  console.log('  Unique by Class Roll No:', map12.size);

  process.exit(0);
}

verifyCounts().catch(e => { console.error(e); process.exit(1); });
