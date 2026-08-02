const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, updateDoc } = require('firebase/firestore');

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

async function updateTeacherEmail() {
  console.log('🔄 Mapping sheikhgulfam91@gmail.com -> socialshiftz@gmail.com in Firestore...');
  
  const oldEmail = 'sheikhgulfam91@gmail.com';
  const newEmail = 'socialshiftz@gmail.com';

  // 1. Update practicalsData collection
  try {
    const snap = await getDocs(collection(db, 'practicalsData'));
    let count = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const currentT = data.teacherEmail || data.Email || '';
      if (currentT.toLowerCase() === oldEmail.toLowerCase() || currentT.toLowerCase() === newEmail.toLowerCase()) {
        await updateDoc(doc(db, 'practicalsData', d.id), {
          teacherEmail: newEmail,
          Email: newEmail,
          teacherName: data.teacherName || data['Teacher Name'] || 'Sheikh Gulfam'
        });
        count++;
      }
    }
    console.log(`✅ Updated ${count} documents in practicalsData to teacherEmail: ${newEmail}`);
  } catch (err) {
    console.error('Error updating practicalsData:', err);
  }

  // 2. Ensure user document in 'users' collection exists for socialshiftz@gmail.com
  try {
    const userDocRef = doc(db, 'users', newEmail);
    await setDoc(userDocRef, {
      email: newEmail,
      Email: newEmail,
      name: 'Sheikh Gulfam',
      Name: 'Sheikh Gulfam',
      role: 'Teacher',
      Role: 'Teacher',
      PasswordPlain: '123456',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`✅ Updated user profile for ${newEmail} in Firestore 'users' collection.`);
  } catch (userErr) {
    console.error('Error updating user profile:', userErr);
  }

  console.log('🎉 Teacher email migration complete!');
}

updateTeacherEmail();
