import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectAttendance() {
  const snap = await getDocs(query(collection(db, 'attendance'), limit(10)));
  console.log(`Total sample attendance docs: ${snap.size}`);
  snap.forEach(d => {
    console.log(`\nDoc ID: ${d.id}`);
    const data = d.data();
    console.log({
      date: data.date,
      className: data.className,
      subject: data.subject,
      subjectName: data.subjectName,
      teacherEmail: data.teacherEmail,
      teacherName: data.teacherName,
      updatedAt: data.updatedAt,
      studentsCount: data.records?.length || 0,
      sampleStudent: data.records?.[0]
    });
  });
}

inspectAttendance().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
