const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, writeBatch } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyDhVgqXBo93FGXAm9YrG8x40Oa9pApu0bo",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const EXCEL_PATH = path.join(__dirname, '../db_30 Jul 2026.xlsx');
const PHOTOS_DIRS = [
  path.join(__dirname, '../optimized_photos (8 aug 2026)'),
  path.join(__dirname, '../optimized_photos')
];

function cleanVal(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cleanRegNoVal(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (!s || /^(N\/A|#N\/A|—|-|null|undefined)$/i.test(s)) return '';
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
    try {
      const num = Number(s);
      if (!isNaN(num) && num > 0) {
        s = BigInt(Math.round(num)).toString();
      }
    } catch (_) { }
  }
  return s.replace(/\.0+$/, '');
}

function normCls(cls) {
  if (!cls) return '';
  const s = String(cls).toLowerCase().trim();
  if (s.includes('9')) return '9th';
  if (s.includes('10')) return '10th';
  if (s.includes('11')) return '11th';
  if (s.includes('12')) return '12th';
  return s;
}

function normSess(sess) {
  if (!sess) return '';
  return String(sess).toLowerCase().trim().replace(/[\/\s]+/g, '-');
}

function sanitizeDocIdKey(str) {
  if (!str) return 'historical';
  return String(str)
    .replace(/[\/\s\(\)]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function purgeCollection(colName) {
  console.log(`🧹 Purging ALL documents in "${colName}" collection...`);
  const snap = await getDocs(collection(db, colName));
  console.log(`Found ${snap.size} documents in "${colName}". Deleting...`);

  const docs = snap.docs;
  let deletedCount = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + 400);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`  Deleted ${deletedCount}/${docs.length} from "${colName}"...`);
    await delay(100);
  }
  console.log(`✅ Fully purged "${colName}" collection.`);
}

async function main() {
  console.log("🚀 Starting Clean Firestore Database Purge & Rebuild with Strict RegNo/AdmNo Photo Matching...");
  await signInAnonymously(auth);
  console.log("✅ Authenticated with Firebase.");

  // Step 1: Purge ALL legacy & duplicate documents from masterRegisters & admissions
  await purgeCollection('masterRegisters');
  await purgeCollection('admissions');

  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Could not find Excel file at ${EXCEL_PATH}`);
  }
  console.log(`Using Excel database file: "${EXCEL_PATH}"`);

  // Build Strict RegNo (Primary) & AdmNo (Secondary) Photo Lookup Maps (NO NAMES)
  const photoByRegSessClass = new Map();
  const photoByAdmSessClass = new Map();
  const photoByRegSess = new Map();
  const photoByAdmSess = new Map();
  const photoByRegOnly = new Map();
  const photoByAdmOnly = new Map();

  let targetPhotosDir = PHOTOS_DIRS.find(d => fs.existsSync(d));
  if (targetPhotosDir) {
    const photoFiles = fs.readdirSync(targetPhotosDir);
    console.log(`Found ${photoFiles.length} photo files in ${targetPhotosDir}.`);
    for (const file of photoFiles) {
      if (!/\.(jpg|jpeg|png)$/i.test(file)) continue;
      const parts = file.replace(/\.(jpg|jpeg|png)$/i, '').split('_');
      if (parts.length < 3) continue;

      const cls = normCls(parts[0]);
      const sess = normSess(parts[1]);
      const idKey = cleanRegNoVal(parts[2]);

      const filePath = path.join(targetPhotosDir, file);
      const fileBuf = fs.readFileSync(filePath);
      const mime = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const base64Data = `data:${mime};base64,${fileBuf.toString('base64')}`;

      if (idKey) {
        if (sess && cls) {
          photoByRegSessClass.set(`${idKey}::${sess}::${cls}`, base64Data);
          photoByAdmSessClass.set(`${idKey}::${sess}::${cls}`, base64Data);
        }
        if (sess) {
          photoByRegSess.set(`${idKey}::${sess}`, base64Data);
          photoByAdmSess.set(`${idKey}::${sess}`, base64Data);
        }
        photoByRegOnly.set(idKey, base64Data);
        photoByAdmOnly.set(idKey, base64Data);
      }
    }
    console.log(`Indexed photo files strictly by RegNo (Primary) & AdmNo (Secondary) + Session + Class.`);
  } else {
    console.warn("⚠️ No photos directory found!");
  }

  // Strict Photo Resolver (Hierarchy: RegNo primary -> AdmNo secondary + Session + Class, NO NAMES)
  const resolvePhoto = (row) => {
    let photoVal = cleanVal(row['Student Photo'] || row['photo_id'] || row['photoId'] || row['photoUrl']);
    if (photoVal && photoVal.startsWith('data:image')) return photoVal;

    const regNo = cleanRegNoVal(row['Board Reg. No.'] || row['Board Registration Number'] || row['Board Registration No. (Class 10th)'] || row['Board Registration No. (Class 11th)'] || row['Reg No'] || row['boardRegNo']);
    const admNo = cleanRegNoVal(row['Adm. No.'] || row['admNo']);
    const sess = normSess(row['Session'] || row['Academic Session']);
    const cls = normCls(row['Class'] || row['Admission sought for class']);

    if (regNo && sess && cls && photoByRegSessClass.has(`${regNo}::${sess}::${cls}`)) {
      return photoByRegSessClass.get(`${regNo}::${sess}::${cls}`);
    }
    if (regNo && sess && photoByRegSess.has(`${regNo}::${sess}`)) {
      return photoByRegSess.get(`${regNo}::${sess}`);
    }
    if (regNo && photoByRegOnly.has(regNo)) {
      return photoByRegOnly.get(regNo);
    }
    if (admNo && sess && cls && photoByAdmSessClass.has(`${admNo}::${sess}::${cls}`)) {
      return photoByAdmSessClass.get(`${admNo}::${sess}::${cls}`);
    }
    if (admNo && sess && photoByAdmSess.has(`${admNo}::${sess}`)) {
      return photoByAdmSess.get(`${admNo}::${sess}`);
    }
    if (admNo && photoByAdmOnly.has(admNo)) {
      return photoByAdmOnly.get(admNo);
    }
    return '';
  };

  // Load Excel workbook
  const wb = xlsx.readFile(EXCEL_PATH);

  // ----------------------------------------------------
  // Step 2: Populate "admissions" collection from adm_form sheet
  // ----------------------------------------------------
  const admFormWs = wb.Sheets['adm_form'];
  const admFormRows = xlsx.utils.sheet_to_json(admFormWs);
  console.log(`Processing ${admFormRows.length} online form submissions from adm_form sheet...`);

  let writtenAdmissions = 0;
  let admPhotosAttached = 0;
  for (let i = 0; i < admFormRows.length; i += 300) {
    const batch = writeBatch(db);
    const chunk = admFormRows.slice(i, i + 300);
    for (const row of chunk) {
      const rawFormNo = cleanVal(row['Form Number'] || row['formNo'] || row['FormNo'] || row['S.No']);
      const cleanFNo = rawFormNo.replace(/^'/, '').trim();
      const docId = cleanFNo ? `form_${cleanFNo}` : `form_auto_${writtenAdmissions + 1}`;

      const photoVal = resolvePhoto(row);
      if (photoVal) admPhotosAttached++;

      const docData = { ...row, updatedAt: new Date().toISOString() };
      const pContact = cleanVal(row["Parent's Contact"] || row["Parent's Mobile No. (must be working)"] || row["Parent's Mobile No."] || row["Father's Mobile No."]);
      if (pContact) {
        docData["Parent's Contact"] = pContact;
        docData["parentContact"] = pContact;
      }
      if (photoVal) {
        docData['photoId'] = photoVal;
        docData['photo_id'] = photoVal;
        docData['Student Photo'] = photoVal;
      }
      batch.set(doc(db, 'admissions', docId), docData, { merge: true });
      writtenAdmissions++;
    }
    await batch.commit();
    console.log(`  Saved ${writtenAdmissions}/${admFormRows.length} admissions docs...`);
    await delay(100);
  }
  console.log(`✅ Successfully wrote ${writtenAdmissions} clean admissions documents (${admPhotosAttached} with photos attached).`);

  // ----------------------------------------------------
  // Step 3: Populate "masterRegisters" collection from source_data sheet
  // ----------------------------------------------------
  const masterWs = wb.Sheets['source_data'];
  const masterRows = xlsx.utils.sheet_to_json(masterWs);
  console.log(`Processing ${masterRows.length} master register items from source_data sheet...`);

  const groupsMap = new Map();
  let masterPhotosAttached = 0;
  for (const row of masterRows) {
    const sessRaw = cleanVal(row['Session'] || 'Historical');
    const clsRaw = cleanVal(row['Class'] || '11th');
    const groupKey = `${sanitizeDocIdKey(sessRaw)}_${sanitizeDocIdKey(clsRaw)}`;
    if (!groupsMap.has(groupKey)) groupsMap.set(groupKey, []);

    const photoVal = resolvePhoto(row);
    if (photoVal) masterPhotosAttached++;

    const rowObj = { ...row };
    if (photoVal) {
      rowObj['photoId'] = photoVal;
      rowObj['photo_id'] = photoVal;
      rowObj['Student Photo'] = photoVal;
    }

    groupsMap.get(groupKey).push(rowObj);
  }
  console.log(`Attached photos to ${masterPhotosAttached}/${masterRows.length} master register items.`);

  const MAX_DOC_BYTES = 750000; // 750 KB max per document (well below 1 MB Firestore limit)
  let masterDocCount = 0;

  for (const [groupKey, items] of groupsMap.entries()) {
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;

    for (const item of items) {
      const itemSize = Buffer.byteLength(JSON.stringify(item), 'utf8');
      if (currentChunk.length > 0 && (currentSize + itemSize) > MAX_DOC_BYTES) {
        chunks.push(currentChunk);
        currentChunk = [item];
        currentSize = itemSize;
      } else {
        currentChunk.push(item);
        currentSize += itemSize;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    const totalParts = chunks.length;
    for (let p = 0; p < totalParts; p++) {
      const chunkItems = chunks[p];
      const subDocId = totalParts === 1 ? groupKey : `${groupKey}_part${p + 1}`;
      const docRef = doc(db, 'masterRegisters', subDocId);
      await setDoc(docRef, {
        groupKey: subDocId,
        parentGroup: groupKey,
        part: p + 1,
        totalParts,
        count: chunkItems.length,
        items: chunkItems,
        updatedAt: new Date().toISOString()
      });
      masterDocCount++;
      await delay(80);
    }
  }
  console.log(`✅ Successfully wrote ${masterDocCount} sub-chunk documents (${masterRows.length} items) to "masterRegisters".`);
  console.log("🎉 Complete Clean Firestore Database Rebuild Finished Successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ ERROR rebuilding Firestore database:", err);
  process.exit(1);
});
