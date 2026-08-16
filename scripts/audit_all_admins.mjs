import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

async function auditAdmins() {
  console.log('🔍 Auditing all admin accounts across Firestore...\n');

  // 1. Check all users in 'users' collection
  const usersSnap = await getDocs(collection(db, 'users'));
  const allAdminsInUsersCol = [];
  const allTeachersInUsersCol = [];
  const otherRoles = [];

  usersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const role = (data.role || data.Role || '').trim();
    const email = (data.email || data.Email || docSnap.id).trim().toLowerCase();
    const name = data.name || data.Name || 'N/A';
    const perms = data.perms || data.Permissions || [];

    if (/admin/i.test(role)) {
      allAdminsInUsersCol.push({ id: docSnap.id, email, name, role, perms });
    } else if (/teacher|faculty/i.test(role)) {
      allTeachersInUsersCol.push({ id: docSnap.id, email, name, role });
    } else {
      otherRoles.push({ id: docSnap.id, email, name, role });
    }
  });

  console.log(`👤 Total Admins found in 'users' collection (${allAdminsInUsersCol.length}):`);
  console.log(JSON.stringify(allAdminsInUsersCol, null, 2));

  // 2. Check adminSettings / permissions
  const permDoc = await getDoc(doc(db, 'adminSettings', 'permissions'));
  console.log(`\n📋 'adminSettings/permissions' configured users:`);
  if (permDoc.exists()) {
    console.log(JSON.stringify(permDoc.data()?.users || [], null, 2));
  } else {
    console.log('No adminSettings/permissions document found.');
  }
}

auditAdmins().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
