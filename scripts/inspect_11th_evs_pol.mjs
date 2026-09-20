import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function run() {
  const evsSnap = await getDoc(doc(db, 'practicalsData', '11th_Environmental Science_Pre-Board Test_2025-26'));
  const evsData = evsSnap.data();
  console.log("=== 11th EVS RECORDS ===");
  console.log("Count:", evsData.records?.length);
  evsData.records?.forEach((r, idx) => {
    console.log(`${idx+1}. Roll: ${r.rollNo} | Form: ${r.formNo} | Reg: ${r.regNo} | Name: ${r.name} | Marks: ${r.totalMarks} (p:${r.practicalMarks}, v:${r.vivaMarks})`);
  });

  const polSnap = await getDoc(doc(db, 'practicalsData', '11th_Political Science_Pre-Board Test_2025-26'));
  const polData = polSnap.data();
  console.log("\n=== 11th POLITICAL SCIENCE RECORDS ===");
  console.log("Count:", polData.records?.length);
  polData.records?.forEach((r, idx) => {
    console.log(`${idx+1}. Roll: ${r.rollNo} | Form: ${r.formNo} | Reg: ${r.regNo} | Name: ${r.name} | Marks: ${r.totalMarks} (p:${r.practicalMarks}, v:${r.vivaMarks})`);
  });
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
