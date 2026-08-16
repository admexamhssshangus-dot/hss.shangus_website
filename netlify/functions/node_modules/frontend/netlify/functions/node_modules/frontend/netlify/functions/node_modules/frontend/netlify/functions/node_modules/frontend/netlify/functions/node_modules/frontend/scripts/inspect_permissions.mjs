import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function inspectPermissions() {
  console.log('--- 1. adminSettings/permissions ---');
  const snap = await getDoc(doc(db, 'adminSettings', 'permissions'));
  if (snap.exists()) {
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('No adminSettings/permissions doc found!');
  }

  console.log('\n--- 2. users collection ---');
  const usersSnap = await getDocs(collection(db, 'users'));
  usersSnap.forEach(u => {
    console.log(`User ID: ${u.id}`, u.data());
  });
}

inspectPermissions().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
