import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

async function inspectDoc(id) {
  const snap = await getDoc(doc(db, 'practicalsData', id));
  if (!snap.exists()) {
    console.log(`Doc ${id} DOES NOT EXIST`);
    return;
  }
  const data = snap.data();
  console.log(`\n=== DOC: ${id} ===`);
  console.log({
    className: data.className,
    subject: data.subject,
    subjectCode: data.subjectCode,
    practicalType: data.practicalType,
    evaluationType: data.evaluationType,
    yearSuffix: data.yearSuffix,
    session: data.session,
    sessionCanonical: data.sessionCanonical,
    status: data.status,
    isDraft: data.isDraft,
    recordsLength: data.records?.length,
    sampleRecords: data.records?.slice(0, 5)
  });
}

async function run() {
  await inspectDoc('12th_General English_Pre-Board Test_2025-26');
  await inspectDoc('11th_Environmental Science_Pre-Board Test_2025-26');
  await inspectDoc('11th_Political Science_Pre-Board Test_2025-26');
  await inspectDoc('12th_Healthcare_Pre-Board Test_2025-26');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
