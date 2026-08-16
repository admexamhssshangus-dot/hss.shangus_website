const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deletePracticalsOnly() {
  console.log('Fetching practicalsData document IDs...');
  const collRef = db.collection('practicalsData');
  const snap = await collRef.select().get(); // fetch only metadata/document references, minimal quota

  console.log(`Found ${snap.docs.length} documents in practicalsData.`);

  if (!snap.empty) {
    const batchSize = 300;
    let batch = db.batch();
    let count = 0;
    let total = 0;

    for (const d of snap.docs) {
      batch.delete(d.ref);
      count++;
      total++;
      if (count >= batchSize) {
        await batch.commit();
        batch = db.batch();
        count = 0;
        console.log(`Deleted batch of ${total} documents.`);
      }
    }
    if (count > 0) {
      await batch.commit();
    }
    console.log(`Successfully deleted ALL ${total} practicalsData documents from Firestore!`);
  } else {
    console.log('practicalsData collection is already 100% clean and empty.');
  }

  console.log('Done! All other collections (masterRegisters, admissions, users, etc.) are 100% untouched and intact.');
  process.exit(0);
}

deletePracticalsOnly().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
