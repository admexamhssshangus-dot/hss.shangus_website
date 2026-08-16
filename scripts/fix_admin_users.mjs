import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

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

const ALL_MODULES = [
  'reports', 'controls', 'subjects', 'gkTest', 'practicals', 
  'attendanceMgmt', 'rollNo', 'bulk', 'automations', 'funds', 
  'ingestion', 'adminMgmt'
];

async function fixAdmins() {
  console.log('🔧 Updating e.educational.24@gmail.com and adminSettings/permissions in Firestore...\n');

  // 1. Update users/e.educational.24@gmail.com
  await setDoc(doc(db, 'users', 'e.educational.24@gmail.com'), {
    name: 'Sheikh Gulfam (SuperAdmin)',
    email: 'e.educational.24@gmail.com',
    role: 'SuperAdmin',
    perms: ALL_MODULES,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  console.log('✅ Updated users/e.educational.24@gmail.com');

  // 2. Fetch existing permissions doc
  const permDoc = await getDoc(doc(db, 'adminSettings', 'permissions'));
  let currentUsers = permDoc.exists() ? (permDoc.data()?.users || []) : [];

  const updatedAdminList = [
    {
      name: 'Sheikh Gulfam (SuperAdmin)',
      email: 'adm.exam.hss.shangus@gmail.com',
      role: 'SuperAdmin',
      perms: ALL_MODULES
    },
    {
      name: 'Sheikh Gulfam',
      email: 'e.educational.24@gmail.com',
      role: 'SuperAdmin',
      perms: ALL_MODULES
    },
    {
      name: 'Nawaz Ahmad Shah (Admin)',
      email: 'shahnawaz@gmail.com',
      role: 'Admin',
      perms: ['reports']
    },
    {
      name: 'Bilal Ahmad Khandy',
      email: 'bilalhcu@gmail.com',
      role: 'Admin',
      perms: ['reports']
    },
    {
      name: 'Majid Hassan Najar',
      email: 'majidhassannajar@gmail.com',
      role: 'Admin',
      perms: ['reports']
    }
  ];

  await setDoc(doc(db, 'adminSettings', 'permissions'), {
    users: updatedAdminList,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log('✅ Updated adminSettings/permissions with all 5 admin accounts');
  console.log(JSON.stringify(updatedAdminList, null, 2));
}

fixAdmins().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
