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

async function testCollisions() {
  const masterSnap = await getDocs(collection(db, 'masterRegisters'));
  const admissionsSnap = await getDocs(collection(db, 'admissions'));
  const practicalsSnap = await getDocs(collection(db, 'practicalsData'));

  console.log(`masterRegisters docs: ${masterSnap.size}, admissions docs: ${admissionsSnap.size}, practicals docs: ${practicalsSnap.size}`);

  const studentsMap = new Map();
  const indexByRoll = new Map();
  const indexByName = new Map();

  let mergedCount = 0;
  let mergedPairs = [];

  const addOrMerge = (st, source) => {
    const cls = String(st.Class || st.class || '11th').toLowerCase().includes('11') ? '11th' : '12th';
    const roll = String(st['Class Roll No'] || st.classRollNo || st.rollNo || '').trim();
    const name = String(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').trim().toLowerCase();
    const father = String(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '').trim().toLowerCase();
    const sess = String(st.Session || st.session || '2025-26');

    // Without session in key (BUGGY):
    const rollKey = `cls_${cls}_roll_${roll}`;
    if (roll && roll !== '—' && indexByRoll.has(rollKey)) {
      const existingId = indexByRoll.get(rollKey);
      const existing = studentsMap.get(existingId);
      mergedCount++;
      mergedPairs.push({
        roll,
        source1: existing.source,
        name1: existing.name,
        sess1: existing.sess,
        source2: source,
        name2: name,
        sess2: sess
      });
      return;
    }

    const newId = `st_${Math.random()}`;
    studentsMap.set(newId, { st, source, name, sess });
    if (roll && roll !== '—') indexByRoll.set(rollKey, newId);
  };

  admissionsSnap.forEach(d => addOrMerge(d.data(), 'admissions'));
  masterSnap.forEach(d => {
    const data = d.data();
    const items = data.items || data.data || data.records || [];
    items.forEach(it => addOrMerge(it, 'masterRegisters'));
  });

  console.log(`Total merged collisions due to un-scoped roll keys: ${mergedCount}`);
  if (mergedPairs.length > 0) {
    console.log('Sample merged collisions:', JSON.stringify(mergedPairs.slice(0, 10), null, 2));
  }
}

testCollisions().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
