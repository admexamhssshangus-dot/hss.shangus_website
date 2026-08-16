const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyDhVgqXBo93FGXAm9YrG8x40Oa9pApu0bo",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  await signInAnonymously(auth);
  console.log("✅ Authenticated.");

  const admSnap = await getDocs(collection(db, 'admissions'));
  console.log(`[admissions] total docs: ${admSnap.size}`);

  const masterSnap = await getDocs(collection(db, 'masterRegisters'));
  console.log(`[masterRegisters] total chunk docs: ${masterSnap.size}`);

  let totalMasterItems = 0;
  masterSnap.docs.forEach(d => {
    const data = d.data();
    const count = data.items ? data.items.length : (Array.isArray(data) ? data.length : 0);
    totalMasterItems += count;
    console.log(`  - Doc "${d.id}": ${count} items`);
  });

  console.log(`TOTAL master items across all chunks: ${totalMasterItems}`);
  console.log(`TOTAL ALL (admissions + masterItems): ${admSnap.size + totalMasterItems}`);
  process.exit(0);
}

main().catch(console.error);
