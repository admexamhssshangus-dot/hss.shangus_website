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

async function inspectAdminPermissions() {
  const permDoc = await getDoc(doc(db, 'adminSettings', 'permissions'));
  console.log('=== adminSettings/permissions ===');
  console.log(JSON.stringify(permDoc.data(), null, 2));

  const adminEmails = [
    'adm.exam.hss.shangus@gmail.com',
    'e.educational.24@gmail.com',
    'shahnawaz@gmail.com',
    'bilalhcu@gmail.com',
    'majidhassannajar@gmail.com',
    'ghssshangus74@gmail.com'
  ];

  console.log('\n=== Users docs for admins ===');
  for (const email of adminEmails) {
    const uDoc = await getDoc(doc(db, 'users', email));
    if (uDoc.exists()) {
      console.log(`\nUser [${email}]:`, uDoc.data());
    } else {
      console.log(`\nUser [${email}]: NOT FOUND`);
    }
  }
}

inspectAdminPermissions().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
