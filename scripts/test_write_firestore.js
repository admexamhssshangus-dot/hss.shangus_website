const admin = require('firebase-admin');
const fs = require('fs');

const svcPath = process.argv[2] || './scripts/serviceAccount.json';
if (!fs.existsSync(svcPath)) {
  console.error('serviceAccount.json not found at', svcPath);
  process.exit(2);
}
const serviceAccount = require(svcPath);

const credential = (admin.credential && typeof admin.credential.cert === 'function')
  ? admin.credential.cert(serviceAccount)
  : (typeof admin.cert === 'function' ? admin.cert(serviceAccount) : null);
if (!credential) {
  console.error('Cannot construct firebase-admin credential');
  process.exit(1);
}

admin.initializeApp({ credential });

let db;
try {
  db = admin.firestore ? admin.firestore() : require('firebase-admin/firestore').getFirestore();
} catch (e) {
  console.error('Failed to get Firestore from firebase-admin:', e);
  process.exit(1);
}

(async () => {
  try {
    const docRef = db.collection('site').doc('admin_test_write');
    await docRef.set({
      updatedAt: new Date().toISOString(),
      updatedBy: 'adm.exam.hss.shangus@gmail.com',
      note: 'test write from scripts/test_write_firestore.js'
    }, { merge: true });
    console.log('Test write successful to site/admin_test_write');
    process.exit(0);
  } catch (err) {
    console.error('Test write failed:', err);
    process.exit(1);
  }
})();
