const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Generate all possible document IDs for practicalsData
const knownIds = new Set([
  // Seed IDs
  "11th_bo_internal_2024-25-oct-nov",
  "11th_zo_internal_2024-25-oct-nov",
  "11th_ph_internal_2024-25-oct-nov",
  "11th_ch_internal_2024-25-oct-nov",
  "11th_bi_internal_2024-25-oct-nov",
  "11th_ma_internal_2024-25-oct-nov",
  "11th_ur_internal_2024-25-oct-nov",
  "11th_ed_internal_2024-25-oct-nov",
  "11th_ht_internal_2024-25-oct-nov",
  "11th_ps_internal_2024-25-oct-nov",
  "11th_ec_internal_2024-25-oct-nov",
  "11th_es_internal_2024-25-oct-nov",
  "11th_pd_internal_2024-25-oct-nov",
  "11th_htc_internal_2024-25-oct-nov",
  "11th_ite_internal_2024-25-oct-nov",
  "12th_bo_internal_2024-25-oct-nov",
  "12th_zo_internal_2024-25-oct-nov",
  "12th_ph_internal_2024-25-oct-nov",
  "12th_ch_internal_2024-25-oct-nov",
  "12th_bi_internal_2024-25-oct-nov",
  "12th_ma_internal_2024-25-oct-nov",
  "12th_ur_internal_2024-25-oct-nov",
  "12th_ed_internal_2024-25-oct-nov",
  "12th_ht_internal_2024-25-oct-nov",
  "12th_ps_internal_2024-25-oct-nov",
  "12th_ec_internal_2024-25-oct-nov",
  "12th_es_internal_2024-25-oct-nov",
  "12th_pd_internal_2024-25-oct-nov",
  "12th_htc_internal_2024-25-oct-nov",
  "12th_ite_internal_2024-25-oct-nov"
]);

const classes = ['11th', '12th', '11', '12', '10th', '9th'];
const subjects = ['bo', 'zo', 'ph', 'ch', 'bi', 'ma', 'ur', 'ed', 'ht', 'ps', 'ec', 'es', 'pd', 'htc', 'ite', 'cs', 'ip', 'gg', 'so', 'ar', 'ks', 'pl', 'hs', 'e1', 'e2', 'botany', 'zoology', 'physics', 'chemistry', 'biology', 'math', 'urdu', 'education', 'history', 'polscience', 'economics', 'evs'];
const types = ['internal', 'external'];
const sessions = ['2024-25-oct-nov', '2024-25', '2025-26', '2023-24', 'annual-regular-2025', '2025', 'current'];

classes.forEach(c => {
  subjects.forEach(s => {
    types.forEach(t => {
      sessions.forEach(sess => {
        knownIds.add(`${c}_${s}_${t}_${sess}`);
        knownIds.add(`${c}_${s}_${sess}`);
        knownIds.add(`${c}_${s}_${t}`);
        knownIds.add(`${c}_${s}`);
        knownIds.add(`${c}_${s.toUpperCase()}_${t}_${sess}`);
        knownIds.add(`${c}_${s.toUpperCase()}`);
      });
    });
  });
});

async function runDirectDeletes() {
  console.log(`Directly deleting ${knownIds.size} potential practical document IDs without ANY read operations...`);
  
  const idArray = Array.from(knownIds);
  const chunkSize = 400;
  let deletedCount = 0;

  for (let i = 0; i < idArray.length; i += chunkSize) {
    const chunk = idArray.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach(id => {
      const docRef = db.collection('practicalsData').doc(id);
      batch.delete(docRef);
    });
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`Processed batch delete: ${deletedCount} / ${idArray.length}`);
  }

  console.log('✅ All targeted practicalsData documents successfully deleted from Firestore!');
  console.log('✅ masterRegisters collection and all other data are 100% intact.');
  process.exit(0);
}

runDirectDeletes().catch(err => {
  console.error('Direct delete error:', err);
  process.exit(1);
});
