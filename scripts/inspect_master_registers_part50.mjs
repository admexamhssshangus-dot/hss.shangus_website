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

async function inspectPart50() {
  const dSnap = await getDoc(doc(db, 'masterRegisters', '2023-24_12th_part50'));
  if (!dSnap.exists()) {
    console.log('Doc 2023-24_12th_part50 not found');
    return;
  }
  const data = dSnap.data();
  console.log('Keys in 2023-24_12th_part50:');
  const photoKeys = Object.keys(data).filter(k => k.toLowerCase().includes('photo'));
  console.log('Photo keys:', photoKeys);
  for (const k of photoKeys) {
    console.log(`  Key "${k}": ${String(data[k]).substring(0, 40)}...`);
  }
}

inspectPart50().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
