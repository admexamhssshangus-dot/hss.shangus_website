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

async function audit11thStudents() {
  const snap = await getDocs(collection(db, 'admissions'));
  console.log(`Total admissions docs: ${snap.size}`);

  const all11th = [];
  const approved11th = [];
  const hasClassRoll11th = [];

  snap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    const cls = String(data['Admission sought for class'] || data['Class'] || data.class || '').trim();
    if (cls.includes('11') || cls === '11th') {
      all11th.push(data);
      const status = data['Status'] || data.status;
      const roll = String(data['Class Roll No'] || data['Class Roll No.'] || data.classRollNo || data['RL. NO.'] || data['Class R.No.'] || '').trim();
      const hasRoll = !!(roll && roll !== '—' && roll !== 'N/A');

      if (hasRoll) {
        hasClassRoll11th.push({
          id: d.id,
          form: data['Form Number'] || data['FormNo'] || data.id,
          name: data["Student's Name (as per school records)"] || data["Student's Name"] || data.name,
          roll,
          status,
          session: data['Session'] || data.session
        });
      }
    }
  });

  console.log(`Total Class 11th in admissions: ${all11th.length}`);
  console.log(`Total Class 11th with assigned Class Roll No: ${hasClassRoll11th.length}`);

  // Sort by Class Roll No
  hasClassRoll11th.sort((a, b) => {
    const numA = parseInt(a.roll, 10);
    const numB = parseInt(b.roll, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.roll.localeCompare(b.roll);
  });

  console.log(`\nList of Class 11th students with Class Roll Nos (${hasClassRoll11th.length}):`);
  hasClassRoll11th.forEach((s, idx) => {
    console.log(`${idx + 1}. Roll: ${s.roll} | Form: ${s.form} | Name: ${s.name} | Status: ${s.status} | Session: ${s.session}`);
  });

  // Check for duplicates or missing numbers in sequence 1 to N
  const rollCounts = {};
  hasClassRoll11th.forEach(s => {
    rollCounts[s.roll] = (rollCounts[s.roll] || 0) + 1;
  });

  const dupes = Object.entries(rollCounts).filter(([k, v]) => v > 1);
  if (dupes.length > 0) {
    console.log('\n⚠️ DUPLICATE CLASS ROLL NUMBERS FOUND IN 11TH:', dupes);
  }
}

audit11thStudents().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
