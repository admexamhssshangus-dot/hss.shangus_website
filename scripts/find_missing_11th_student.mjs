import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

function isClassMatch(stc, trc) {
  if (!stc) return false;
  const s = String(stc).toLowerCase().trim();
  const t = String(trc || '').toLowerCase().replace('th', '').trim();
  return (
    s.includes(t) ||
    s.includes(String(trc).toLowerCase()) ||
    (t === '11' && (s.includes('xi') || s.includes('eleven'))) ||
    (t === '12' && (s.includes('xii') || s.includes('twelve')))
  );
}

function normalizePracticalSession(sess) {
  if (!sess) return '2025-26';
  const str = String(sess).toLowerCase().trim();
  if (
    str.includes('2024') ||
    str.includes('oct') ||
    str.includes('nov') ||
    str.includes('annual regular 2025') ||
    str.includes('annual 2025') ||
    str.includes('regular 2025')
  ) {
    return '2024-25 (Oct-Nov)';
  }
  if (str.includes('2025-26') || str.includes('2025–26') || str.includes('current')) {
    return '2025-26';
  }
  return sess;
}

function isSessionMatch(rawSess, targetFilter) {
  if (!rawSess || !targetFilter || targetFilter === 'all') return true;
  const sNorm = normalizePracticalSession(rawSess);
  const tNorm = normalizePracticalSession(targetFilter);

  if (tNorm === '2025-26') {
    return sNorm === '2025-26';
  }
  if (tNorm === '2024-25 (Oct-Nov)' || tNorm === '2024-25') {
    return sNorm === '2024-25 (Oct-Nov)';
  }

  const s = String(sNorm).toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = String(tNorm).toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === t || s.includes(t) || t.includes(s);
}

function getStudentSession(st) {
  if (!st) return '';
  const keys = ['Session', 'session', 'Academic Session', 'sessionYear', 'yearSuffix', 'Session/Year', 'Annual Year', 'Exam Year', 'Year', 'examYear'];
  for (const k of keys) {
    if (st[k] !== undefined && st[k] !== null) {
      const v = String(st[k]).trim();
      if (v && v !== '—' && v !== '-' && v !== 'N/A') return v;
    }
  }
  if (st._source === 'masterRegisters') return '2024-25 (Oct-Nov)';
  return '';
}

function checkStudentApprovalState(st) {
  const statusStr = String(st.Status || st.status || st['Admission Status'] || '').toLowerCase();
  const isApproved =
    st.isApproved === true ||
    st.Status === 'Approved' ||
    st.status === 'Approved' ||
    statusStr.includes('approved') ||
    statusStr.includes('admitted') ||
    statusStr.includes('active') ||
    statusStr.includes('pass') ||
    !!st['Class Roll No'] ||
    !!st['Class Roll'] ||
    st._source === 'masterRegisters' ||
    st._source === 'practicalsData';

  const isRejected = statusStr.includes('reject') || statusStr.includes('cancel') || st.isRejected === true;
  const isPending = !isApproved && !isRejected;

  return { isApproved, isRejected, isPending };
}

async function findMissingStudent() {
  const snap = await getDocs(collection(db, 'admissions'));
  const students = [];
  snap.forEach(d => {
    students.push({ id: d.id, ...d.data() });
  });

  const cls = '11th';
  const selectedSession = '2025-26';
  const selectedStatusFilter = 'approved';

  const cSts = [];
  const rejectedOrDropped = [];

  students.forEach(st => {
    const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
    if (!classMatch) return;

    const { isRejected, isApproved, isPending } = checkStudentApprovalState(st);
    const rollVal = String(st['Class Roll No'] || st['Class Roll No.'] || st.classRollNo || st['Class Roll'] || st.rollNo || '').trim();
    const hasRoll = !!(rollVal && rollVal !== '—' && rollVal !== '-');

    const sess = getStudentSession(st);
    const matchesSess = isSessionMatch(sess, selectedSession);

    if (hasRoll) {
      if (isRejected || (!isApproved && selectedStatusFilter === 'approved') || !matchesSess) {
        rejectedOrDropped.push({
          id: st.id,
          form: st['Form Number'] || st['FormNo'] || st.id,
          name: st["Student's Name (as per school records)"] || st["Student's Name"] || st.name,
          rollVal,
          status: st.Status || st.status,
          sess,
          isApproved,
          isRejected,
          matchesSess
        });
      } else {
        cSts.push(st);
      }
    }
  });

  console.log(`Total 11th with roll: ${cSts.length + rejectedOrDropped.length}`);
  console.log(`Matched in cSts: ${cSts.length}`);
  console.log(`Dropped students (${rejectedOrDropped.length}):`, JSON.stringify(rejectedOrDropped, null, 2));
}

findMissingStudent().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
