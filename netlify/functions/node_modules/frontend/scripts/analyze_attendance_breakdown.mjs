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

async function analyzeAllAttendance() {
  const snap = await getDocs(collection(db, 'attendance'));
  console.log(`Total attendance records in Firestore: ${snap.size}`);

  const subjects = {};
  const classes = {};
  const teachers = {};
  const dates = new Set();

  snap.forEach(d => {
    const data = d.data();
    const sub = data.subject || data.subjectName || 'Unknown';
    const cls = data.className || 'Unknown';
    const teacher = data.teacherName || data.teacherEmail || data.submittedBy || 'Faculty';
    const dt = data.date;

    subjects[sub] = (subjects[sub] || 0) + 1;
    classes[cls] = (classes[cls] || 0) + 1;
    teachers[teacher] = (teachers[teacher] || 0) + 1;
    if (dt) dates.add(dt);
  });

  console.log('\n📚 By Subject:', subjects);
  console.log('\n🏫 By Class:', classes);
  console.log('\n👨‍🏫 By Teacher / Submitter:', teachers);
  console.log(`\n📅 Unique Dates count: ${dates.size}, sample dates:`, Array.from(dates).sort().slice(-10));
}

analyzeAllAttendance().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
