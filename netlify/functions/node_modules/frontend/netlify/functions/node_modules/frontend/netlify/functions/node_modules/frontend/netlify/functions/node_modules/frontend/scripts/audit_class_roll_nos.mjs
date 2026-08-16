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

async function auditRollNos() {
  const snap = await getDocs(collection(db, 'admissions'));
  console.log(`Auditing all ${snap.size} admissions documents...`);

  let examRollsInClassRollField = [];
  let validClassRolls = 0;
  let blankClassRolls = 0;

  snap.forEach(d => {
    const data = d.data();
    const classRoll = String(data['Class Roll No'] || data['Class Roll No.'] || data.classRollNo || '').trim();
    const examRoll10 = String(data['Exam Roll Number of Class 10th'] || '').trim();
    const examRoll11 = String(data['Exam Roll Number of Class 11th'] || '').trim();
    const name = data["Student's Name (as per school records)"] || data.name || 'Student';
    const form = data['Form Number'] || data.formNo || d.id;

    if (!classRoll || classRoll === '—' || classRoll === 'N/A') {
      blankClassRolls++;
    } else if (classRoll.length >= 7 || classRoll === examRoll10 || classRoll === examRoll11) {
      examRollsInClassRollField.push({
        id: d.id,
        form,
        name,
        classRoll,
        examRoll10,
        examRoll11
      });
    } else {
      validClassRolls++;
    }
  });

  console.log(`\n📊 Audit Results:`);
  console.log(`- Valid School Class Roll Numbers: ${validClassRolls}`);
  console.log(`- Blank / Unassigned Class Roll Numbers: ${blankClassRolls}`);
  console.log(`- Suspicious Board Exam Roll Numbers in Class Roll field: ${examRollsInClassRollField.length}`);

  if (examRollsInClassRollField.length > 0) {
    console.log(`\nSample suspicious entries:`, JSON.stringify(examRollsInClassRollField.slice(0, 10), null, 2));
  }
}

auditRollNos().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
