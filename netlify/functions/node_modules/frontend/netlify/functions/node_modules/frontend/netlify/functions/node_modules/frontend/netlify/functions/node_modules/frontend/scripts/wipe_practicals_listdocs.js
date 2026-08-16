const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function listAndWipeAllPracticals() {
  console.log('Listing all document references from practicalsData...');
  const docRefs = await db.collection('practicalsData').listDocuments();
  console.log(`Found ${docRefs.length} documents in practicalsData collection.`);

  if (docRefs.length === 0) {
    console.log('Collection practicalsData is completely empty (0 documents).');
    process.exit(0);
  }

  const batchSize = 300;
  let batch = db.batch();
  let count = 0;
  let totalDeleted = 0;

  for (const ref of docRefs) {
    console.log(`Deleting [${ref.id}]...`);
    batch.delete(ref);
    count++;
    totalDeleted++;

    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Completely deleted ALL ${totalDeleted} documents from practicalsData in Firestore!`);
  process.exit(0);
}

listAndWipeAllPracticals().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
