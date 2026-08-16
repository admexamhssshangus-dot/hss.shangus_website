/**
 * HSS SHANGUS — Node.js Student Photo Migration Seeder Script
 * Batch uploads and links all 1,582+ optimized photos from local drive to Cloud Firestore documents.
 * Includes cross-session photo lookup for missing lists & multi-identifier matching.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PHOTOS_DIR = 'I:\\My Drive\\Projects\\admission form\\2026 onwards\\Student Photos\\optimized_photos';

// Parse multi-identifier filename
function parseFilename(fileName) {
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext).trim();

  // Pattern: {Class}_{Session}_{BoardRegNo}_{StudentName}.jpg
  const parts = baseName.split('_');

  let cls = '';
  let session = '';
  let regNo = '';
  let name = '';

  if (parts.length >= 4) {
    cls = parts[0];
    session = parts[1];
    regNo = parts[2];
    name = parts.slice(3).join('_').replace(/_/g, ' ');
  } else if (parts.length === 3) {
    cls = parts[0];
    regNo = parts[1];
    name = parts[2].replace(/_/g, ' ');
  } else if (parts.length === 2) {
    regNo = parts[0];
    name = parts[1].replace(/_/g, ' ');
  } else {
    name = baseName.replace(/_/g, ' ');
  }

  return {
    fileName,
    cls: cls.toLowerCase().trim(),
    session: session.toLowerCase().trim(),
    regNo: regNo.toLowerCase().trim(),
    name: name.toLowerCase().trim()
  };
}

async function runPhotoMigration() {
  console.log('🚀 Starting Student Photo Migration Engine for Cloud Firestore...');
  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error('❌ Local photo directory not found:', PHOTOS_DIR);
    process.exit(1);
  }

  // Read all image files in optimized_photos folder
  const allFiles = fs.readdirSync(PHOTOS_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp';
  });

  console.log(`📁 Found ${allFiles.length} photo files in optimized_photos folder.`);

  const parsedPhotos = allFiles.map(parseFilename);

  // Read missing photo text logs to build missing index
  const missingLogs = {};
  const txtFiles = fs.readdirSync(PHOTOS_DIR).filter(f => f.endsWith('.txt'));
  txtFiles.forEach(tf => {
    const content = fs.readFileSync(path.join(PHOTOS_DIR, tf), 'utf8');
    const matches = content.matchAll(/(.*?)\s+\(Board Reg:\s*([A-Za-z0-9]+)\)/g);
    for (const m of matches) {
      const reg = m[2].toLowerCase().trim();
      missingLogs[reg] = true;
    }
  });

  // 1. Fetch active admissions from Firestore
  console.log('📥 Fetching student records from Cloud Firestore (admissions collection)...');
  const admissionsSnap = await getDocs(collection(db, 'admissions'));
  const studentDocs = admissionsSnap.docs.map(d => ({ docId: d.id, ...d.data() }));

  console.log(`✅ Loaded ${studentDocs.length} student records from Cloud Firestore.`);

  let updatedCount = 0;
  let missingFoundInOtherSessionCount = 0;
  let unlinkedCount = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < studentDocs.length; i += BATCH_SIZE) {
    const batch = studentDocs.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (student) => {
      const sRegNo = String(student['Board Registration No. (Class 10th)'] || student['Board Registration No. (Class 11th)'] || student['Board Reg. No.'] || student['Board Registration No.'] || student.regNo || '').toLowerCase().trim();
      const sFormNo = String(student['Form Number'] || student['Form No.'] || student.formNo || '').toLowerCase().trim();
      const sRollNo = String(student['Class Roll No'] || student['Class R.No.'] || student.rollNo || '').toLowerCase().trim();
      const sName = String(student["Student's Name (as per school records)"] || student["Student's Name"] || student.name || '').toLowerCase().trim();

      // 1. Primary Match: Board Registration No
      let photoMatch = parsedPhotos.find(p => p.regNo && sRegNo && p.regNo === sRegNo);

      // 2. Secondary Match: Form No / Roll No
      if (!photoMatch && sFormNo) {
        photoMatch = parsedPhotos.find(p => p.regNo && p.regNo === sFormNo);
      }
      if (!photoMatch && sRollNo) {
        photoMatch = parsedPhotos.find(p => p.regNo && p.regNo === sRollNo);
      }

      // 3. Fallback Match: Student Name (Cross-session lookup if student was in missing list or no reg no)
      if (!photoMatch && sName) {
        photoMatch = parsedPhotos.find(p => p.name && p.name === sName);
        if (photoMatch && sRegNo && missingLogs[sRegNo]) {
          missingFoundInOtherSessionCount++;
        }
      }

      if (photoMatch) {
        try {
          const filePath = path.join(PHOTOS_DIR, photoMatch.fileName);
          const fileBuffer = fs.readFileSync(filePath);
          const base64Data = fileBuffer.toString('base64');
          const ext = path.extname(photoMatch.fileName).toLowerCase().replace('.', '') || 'jpeg';
          const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${base64Data}`;

          // Save Data URL into Firestore student document
          const docRef = doc(db, 'admissions', student.docId);
          await updateDoc(docRef, {
            'Student Photo': dataUrl,
            'photo_id': dataUrl,
            'photoUrl': dataUrl,
            'photo_synced_at': new Date().toISOString(),
            'photo_source_filename': photoMatch.fileName
          });

          updatedCount++;
        } catch (e) {
          console.error(`❌ Error updating photo for student ${student.docId}:`, e.message);
        }
      } else {
        unlinkedCount++;
      }
    }));

    await new Promise(r => setTimeout(r, 150));
    console.log(`  [Progress] Uploaded & attached photos to ${Math.min(i + BATCH_SIZE, studentDocs.length)}/${studentDocs.length} Firestore student records...`);
  }

  console.log('\n======================================================');
  console.log('🎉 FIRESTORE STUDENT PHOTO MIGRATION COMPLETED');
  console.log('======================================================');
  console.log(`Total Firestore Student Records: ${studentDocs.length}`);
  console.log(`Photos Successfully Linked & Saved: ${updatedCount}`);
  console.log(`Missing List Recovered Cross-Session: ${missingFoundInOtherSessionCount}`);
  console.log(`Students Without Photo Match:    ${unlinkedCount}`);
  console.log('======================================================\n');

  process.exit(0);
}

runPhotoMigration().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
