const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const XLSX = require('xlsx');
const path = require('path');

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

async function searchAll() {
  console.log('=== SEARCHING FIRESTORE ADMISSIONS & MASTERREGISTERS ===');
  
  const admSnap = await getDocs(collection(db, 'admissions'));
  console.log(`Total admissions documents in Firestore: ${admSnap.size}`);
  
  let foundAdm = [];
  admSnap.docs.forEach(doc => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('250218') || str.includes('uzma') || str.includes('rashid')) {
      foundAdm.push({ id: doc.id, data });
    }
  });
  
  console.log(`Matching records in Firestore 'admissions': ${foundAdm.length}`);
  foundAdm.forEach((r, idx) => {
    console.log(`\n--- Firestore Admission Match #${idx+1} [ID: ${r.id}] ---`);
    console.log(JSON.stringify(r.data, null, 2));
  });

  const masterSnap = await getDocs(collection(db, 'masterRegisters'));
  console.log(`\nTotal masterRegisters documents in Firestore: ${masterSnap.size}`);
  
  let foundMaster = [];
  masterSnap.docs.forEach(doc => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('250218') || str.includes('uzma') || str.includes('rashid')) {
      foundMaster.push({ id: doc.id, sample: str.slice(0, 200) });
    }
  });
  console.log(`Matching records in Firestore 'masterRegisters': ${foundMaster.length}`);
  foundMaster.forEach((r, idx) => {
    console.log(`Match #${idx+1} in masterRegisters [ID: ${r.id}]`);
  });

  console.log('\n=== SEARCHING LOCAL EXCEL DB (db_30 Jul 2026.xlsx) ===');
  try {
    const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
    const wb = XLSX.readFile(filePath);
    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const matches = data.filter(r => {
        const str = JSON.stringify(r).toLowerCase();
        return str.includes('250218') || str.includes('uzma');
      });
      if (matches.length > 0) {
        console.log(`Found ${matches.length} matches in sheet '${sheetName}':`);
        console.log(matches);
      }
    });
  } catch (e) {
    console.log('Excel file search note:', e.message);
  }
}

searchAll().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
