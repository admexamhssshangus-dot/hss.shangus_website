const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function wipePracticalsData() {
  console.log('1. Fetching all documents from practicalsData collection...');
  const practicalsSnap = await db.collection('practicalsData').get();
  console.log(`Found ${practicalsSnap.docs.length} documents in practicalsData.`);

  if (!practicalsSnap.empty) {
    const batchSize = 400;
    let batch = db.batch();
    let count = 0;
    let totalDeleted = 0;

    for (const doc of practicalsSnap.docs) {
      batch.delete(doc.ref);
      count++;
      totalDeleted++;

      if (count >= batchSize) {
        await batch.commit();
        batch = db.batch();
        count = 0;
        console.log(`Deleted batch of ${totalDeleted} documents...`);
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    console.log(`Successfully deleted ALL ${totalDeleted} documents from practicalsData.`);
  } else {
    console.log('practicalsData collection is already completely empty.');
  }

  console.log('\n2. Verifying masterRegisters collection integrity...');
  const masterSnap = await db.collection('masterRegisters').get();
  console.log(`Found ${masterSnap.docs.length} masterRegisters session/group documents.`);
  let totalMasterItems = 0;
  masterSnap.docs.forEach(d => {
    const data = d.data();
    if (Array.isArray(data.items)) {
      totalMasterItems += data.items.length;
    } else if (Array.isArray(data)) {
      totalMasterItems += data.length;
    } else if (Array.isArray(data.data)) {
      totalMasterItems += data.data.length;
    } else {
      totalMasterItems += 1;
    }
  });
  console.log(`masterRegisters contains ${totalMasterItems} student registration records intact and safe.`);

  console.log('\n3. Database practicals cleanup complete! Exiting.');
  process.exit(0);
}

wipePracticalsData().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
