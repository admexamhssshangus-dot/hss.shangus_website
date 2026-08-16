const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function forceClean() {
  console.log('Fetching documents from practicalsData...');
  const coll = db.collection('practicalsData');
  
  // Fetch up to 50 at a time until empty
  let totalDeleted = 0;
  while (true) {
    const snap = await coll.limit(50).get();
    if (snap.empty) {
      console.log(`Finished! Total deleted: ${totalDeleted}`);
      break;
    }
    console.log(`Found ${snap.docs.length} docs to delete...`);
    const batch = db.batch();
    for (const d of snap.docs) {
      console.log(`  Deleting doc ID: ${d.id}`);
      batch.delete(d.ref);
      totalDeleted++;
    }
    await batch.commit();
  }
  console.log('All practicalsData documents wiped 100% clean!');
  process.exit(0);
}

forceClean().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
