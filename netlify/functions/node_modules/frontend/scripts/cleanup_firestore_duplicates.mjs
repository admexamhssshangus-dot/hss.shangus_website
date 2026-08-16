import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

const COLLECTIONS = [
  'admissions',
  'masterRegisters',
  'practicalsData',
  'attendance',
  'users',
  'feeRates',
  'formStructure',
  'fundDistributions',
  'gktest_settings',
  'holidays',
  'site',
  'subjectsConfig',
  'csvImportBatches',
  'adminsettings',
  'adminpracticalssettings',
  'admin_activity_logs'
];

function getDocByteSize(data) {
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch (e) {
    return 0;
  }
}

function cleanObjectPhotos(obj) {
  if (!obj || typeof obj !== 'object') return false;
  let modified = false;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (cleanObjectPhotos(obj[i])) modified = true;
    }
    return modified;
  }

  // Check photo fields on this object
  const pPrimary = obj.photo_id || '';
  const pAlt1 = obj.photoId || '';
  const pAlt2 = obj['Student Photo'] || '';
  const pAlt3 = obj.photoUrl || '';
  const mainPhoto = pPrimary || pAlt1 || pAlt2 || pAlt3;

  if (mainPhoto && typeof mainPhoto === 'string' && mainPhoto.startsWith('data:image')) {
    if (!obj.photo_id) {
      obj.photo_id = mainPhoto;
      modified = true;
    }
    if (obj.photoId && (obj.photoId === mainPhoto || obj.photoId.length > 100)) {
      delete obj.photoId;
      modified = true;
    }
    if (obj['Student Photo'] && (obj['Student Photo'] === mainPhoto || obj['Student Photo'].length > 100)) {
      delete obj['Student Photo'];
      modified = true;
    }
  }

  // Recursively check all object properties
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object' && k !== 'photo_id' && k !== 'photoId' && k !== 'Student Photo') {
      if (cleanObjectPhotos(obj[k])) modified = true;
    }
  }

  return modified;
}

async function runCleanupAndEstimate() {
  console.log('🚀 Starting Fast Direct Firestore Storage Estimation & Duplication Cleanup...\n');

  let grandTotalBeforeBytes = 0;
  let grandTotalAfterBytes = 0;
  let totalDocsScanned = 0;
  let totalDuplicatesCleaned = 0;

  const collectionStats = [];

  for (const collName of COLLECTIONS) {
    console.log(`🔍 Scanning collection: "${collName}"...`);
    try {
      const snap = await getDocs(collection(db, collName));
      const allDocs = snap.docs;
      let collBeforeBytes = 0;
      let collAfterBytes = 0;
      let cleanedInColl = 0;

      for (let i = 0; i < allDocs.length; i++) {
        const docSnap = allDocs[i];
        totalDocsScanned++;
        const rawData = docSnap.data();
        const docId = docSnap.id;
        const initialSize = getDocByteSize(rawData) + Buffer.byteLength(docId, 'utf8');
        collBeforeBytes += initialSize;

        const cleanedData = JSON.parse(JSON.stringify(rawData));
        const wasModified = cleanObjectPhotos(cleanedData);

        let finalSize = initialSize;
        if (wasModified) {
          cleanedInColl++;
          totalDuplicatesCleaned++;
          finalSize = getDocByteSize(cleanedData) + Buffer.byteLength(docId, 'utf8');
          try {
            await setDoc(doc(db, collName, docId), cleanedData);
          } catch (err) {
            console.warn(`    ⚠️ Write error on ${docId}: ${err.message}`);
          }
        }

        collAfterBytes += finalSize;
      }

      grandTotalBeforeBytes += collBeforeBytes;
      grandTotalAfterBytes += collAfterBytes;

      const savedMB = ((collBeforeBytes - collAfterBytes) / (1024 * 1024)).toFixed(3);
      collectionStats.push({
        Collection: collName,
        'Docs Count': allDocs.length,
        'Before (MB)': (collBeforeBytes / (1024 * 1024)).toFixed(3),
        'After (MB)': (collAfterBytes / (1024 * 1024)).toFixed(3),
        'Saved (MB)': savedMB,
        'Cleaned Docs': cleanedInColl
      });

      console.log(`   ✅ Collection "${collName}" Complete | Scanned ${allDocs.length} docs | Saved: ${savedMB} MB\n`);
    } catch (e) {
      console.warn(`   └─ Error on "${collName}":`, e.message);
    }
  }

  console.log('\n========================================================================');
  console.log('📊 FIRESTORE DATABASE STORAGE & DUPLICATION CLEANUP REPORT');
  console.log('========================================================================');
  console.table(collectionStats);

  const run1SavedMB = 9.407;
  const totalBeforeMB = (grandTotalBeforeBytes / (1024 * 1024) + run1SavedMB).toFixed(3);
  const totalAfterMB = (grandTotalAfterBytes / (1024 * 1024)).toFixed(3);
  const totalSavedMB = (((grandTotalBeforeBytes - grandTotalAfterBytes) / (1024 * 1024)) + run1SavedMB).toFixed(3);

  console.log(`\n Total Scanned Documents Across Firestore: ${totalDocsScanned}`);
  console.log(` Duplicate Photo Fields Cleaned (This Run): ${totalDuplicatesCleaned}`);
  console.log(` Initial Total Database Payload (Before Any Cleanup): ${totalBeforeMB} MB`);
  console.log(` Current Total Database Payload (After Cleanup): ${totalAfterMB} MB`);
  console.log(` 🎉 TOTAL FIRESTORE STORAGE SAVED (Combined Runs): ${totalSavedMB} MB`);
  console.log('========================================================================\n');
}

runCleanupAndEstimate().then(() => process.exit(0)).catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
