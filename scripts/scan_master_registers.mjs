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

function getDocByteSize(data) {
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch (e) {
    return 0;
  }
}

async function scanMasterRegisters() {
  console.log('🔍 Fetching masterRegisters size breakdown...');
  const snap = await getDocs(collection(db, 'masterRegisters'));
  let totalBytes = 0;
  console.log(`Found ${snap.docs.length} masterRegisters part documents.`);

  for (const d of snap.docs) {
    const sz = getDocByteSize(d.data()) + Buffer.byteLength(d.id, 'utf8');
    totalBytes += sz;
  }

  const mb = (totalBytes / (1024 * 1024)).toFixed(3);
  console.log(`📊 masterRegisters Total Storage: ${mb} MB`);
}

scanMasterRegisters().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
