import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object' && k !== 'photo_id' && k !== 'photoId' && k !== 'Student Photo') {
      if (cleanObjectPhotos(obj[k])) modified = true;
    }
  }

  return modified;
}

async function runMasterRegistersClean() {
  console.log('⚡ Running Fast Parallel masterRegisters Clean & Storage Calculation...');

  const prefixes = [
    '2023-24_11th_part',
    '2023-24_12th_part',
    '2024-25_11th_part',
    '2024-25_12th_part',
    '2025-26_11th_part',
    '2025-26_12th_part'
  ];

  const docIdsToFetch = [];
  for (const prefix of prefixes) {
    for (let partIdx = 1; partIdx <= 60; partIdx++) {
      docIdsToFetch.push(`${prefix}${partIdx}`);
    }
  }

  let totalDocsFound = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  let totalCleaned = 0;

  const BATCH_SIZE = 15;
  for (let i = 0; i < docIdsToFetch.length; i += BATCH_SIZE) {
    const chunk = docIdsToFetch.slice(i, i + BATCH_SIZE);
    const snaps = await Promise.all(chunk.map(id => getDoc(doc(db, 'masterRegisters', id)).catch(() => null)));

    for (let j = 0; j < snaps.length; j++) {
      const dSnap = snaps[j];
      if (!dSnap || !dSnap.exists()) continue;

      totalDocsFound++;
      const docId = dSnap.id;
      const rawData = dSnap.data();
      const initialSize = getDocByteSize(rawData) + Buffer.byteLength(docId, 'utf8');
      totalBytesBefore += initialSize;

      const cleanedData = JSON.parse(JSON.stringify(rawData));
      const wasModified = cleanObjectPhotos(cleanedData);

      let finalSize = initialSize;
      if (wasModified) {
        totalCleaned++;
        finalSize = getDocByteSize(cleanedData) + Buffer.byteLength(docId, 'utf8');
        await setDoc(doc(db, 'masterRegisters', docId), cleanedData);
      }

      totalBytesAfter += finalSize;
    }
  }

  const beforeMB = (totalBytesBefore / (1024 * 1024)).toFixed(3);
  const afterMB = (totalBytesAfter / (1024 * 1024)).toFixed(3);
  const savedMB = ((totalBytesBefore - totalBytesAfter) / (1024 * 1024)).toFixed(3);

  console.log(`\n==================================================`);
  console.log(`📊 masterRegisters Final Storage Breakdown:`);
  console.log(` Total Part Documents Found: ${totalDocsFound}`);
  console.log(` Part Docs Cleaned: ${totalCleaned}`);
  console.log(` masterRegisters Initial Storage: ${beforeMB} MB`);
  console.log(` masterRegisters Current Storage: ${afterMB} MB`);
  console.log(` masterRegisters Storage Saved: ${savedMB} MB`);
  console.log(`==================================================\n`);
}

runMasterRegistersClean().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
