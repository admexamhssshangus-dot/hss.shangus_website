const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

(async () => {
  try {
    const docs = ['settings', 'notices', 'faculty', 'admins'];
    for (const d of docs) {
      const snap = await db.collection('site').doc(d).get();
      if (snap.exists) {
        console.log(`=== Document site/${d} ===`);
        console.log(JSON.stringify(snap.data(), null, 2));
      } else {
        console.log(`=== Document site/${d} DOES NOT EXIST ===`);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Error inspecting Firestore:', err);
    process.exit(1);
  }
})();
