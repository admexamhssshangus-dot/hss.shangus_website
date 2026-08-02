const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'serviceAccount.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'hsssdb'
  });
}

const db = admin.firestore();

async function updateTeacherEmail() {
  const oldEmail = 'sheikhgulfam91@gmail.com';
  const newEmail = 'socialshiftz@gmail.com';

  console.log(`🔄 Scanning practicalsData in Firestore for teacherEmail/Email: ${oldEmail} -> ${newEmail}...`);

  try {
    const snap = await db.collection('practicalsData').get();
    console.log(`📋 Found ${snap.docs.length} total documents in practicalsData.`);

    let count = 0;
    const batch = db.batch();

    for (const d of snap.docs) {
      const data = d.data();
      const currentEmail = (data.teacherEmail || data.Email || data.teacher || data.Teacher || data.email || '').toLowerCase().trim();
      const teacherName = data.teacherName || data['Teacher Name'] || data.Name || data.name || '';

      // Match old email OR if teacherName is Sheikh Gulfam
      if (currentEmail === oldEmail.toLowerCase() || currentEmail === '' || currentEmail === newEmail.toLowerCase() || teacherName.toLowerCase().includes('gulfam')) {
        const docRef = db.collection('practicalsData').doc(d.id);
        const updates = {
          teacherEmail: newEmail,
          Email: newEmail,
          email: newEmail,
          teacher: newEmail,
          teacherName: 'Sheikh Gulfam',
          updatedAt: new Date().toISOString()
        };
        batch.set(docRef, updates, { merge: true });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`✅ Successfully updated ${count} practicalsData documents to teacherEmail: ${newEmail}`);
    } else {
      console.log(`ℹ️ No matching practicalsData documents found needing update.`);
    }

    // Also ensure user document in 'users' collection exists and is mapped to socialshiftz@gmail.com
    const userDocRef = db.collection('users').doc(newEmail);
    await userDocRef.set({
      email: newEmail,
      Email: newEmail,
      name: 'Sheikh Gulfam',
      Name: 'Sheikh Gulfam',
      role: 'Teacher',
      Role: 'Teacher',
      PasswordPlain: '123456',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`✅ User profile for ${newEmail} updated in 'users' collection.`);

  } catch (err) {
    console.error('❌ Error updating practicalsData:', err);
  }

  process.exit(0);
}

updateTeacherEmail();
