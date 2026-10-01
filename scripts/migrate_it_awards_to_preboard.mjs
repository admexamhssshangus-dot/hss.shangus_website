import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const admin = require(path.resolve('functions/node_modules/firebase-admin'));
const { getAuth: getAdminAuth } = require(path.resolve('functions/node_modules/firebase-admin/lib/auth/index.js'));
import { initializeApp as initClient } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve('scripts/serviceAccount.json');
let adminAuth = null;
if (fs.existsSync(saPath)) {
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const adminApp = admin.initializeApp({ credential: admin.cert(sa) }, 'adminAppMigrate');
  adminAuth = getAdminAuth(adminApp);
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "hsssdb.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "hsssdb",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "hsssdb.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "894258649787",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:894258649787:web:8e1f77202b304f48f2279e",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-3RJ3KDNTH2"
};

const clientApp = initClient(firebaseConfig, 'clientAppMigrate');
const auth = getAuth(clientApp);
const db = getFirestore(clientApp);

const TARGET_CLASSES = ['10th', '11th', '12th'];

async function migrate() {
  console.log("=== Starting IT and ITES Award Migration from Internal to Pre-Board ===");
  
  // 1. Authenticate with verified admin claims
  console.log("1. Authenticating as administrator...");
  if (!adminAuth) {
    console.error("Firebase Admin SDK credentials not available. Please provide serviceAccount.json.");
    return;
  }
  const customToken = await adminAuth.createCustomToken('admin_migration_agent', {
    email: 'adm.exam.hss.shangus@gmail.com',
    email_verified: true,
    role: 'admin'
  });
  await signInWithCustomToken(auth, customToken);
  console.log("   Authenticated as adm.exam.hss.shangus@gmail.com");

  // Ensure backup directory exists
  const backupDir = path.resolve('scripts/backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupData = {};

  for (const cls of TARGET_CLASSES) {
    const oldId = `${cls}_IT and ITES_Internal Assessment_2025-26`;
    const newId = `${cls}_IT and ITES_Pre-Board Test_2025-26`;
    console.log(`\n--- Processing Class ${cls} ---`);
    console.log(`Source Doc: ${oldId}`);
    console.log(`Target Doc: ${newId}`);

    const oldDocRef = doc(db, 'practicalsData', oldId);
    const oldSnap = await getDoc(oldDocRef);

    if (!oldSnap.exists()) {
      console.warn(`WARNING: Source document ${oldId} not found in practicalsData!`);
      continue;
    }

    const oldData = oldSnap.data();
    console.log(`   Found ${oldData.records?.length || 0} candidate records submitted by ${oldData.submittedByName || oldData.submittedByEmail}.`);
    backupData[oldId] = oldData;

    // 2. Prepare new document payload for Pre-Board Test
    const newPayload = {
      ...oldData,
      docId: newId,
      canonicalDocId: newId,
      practicalType: 'Pre-Board Test',
      evaluationType: 'Pre-Board Test',
      maxMarks: 50,
      minMarks: 18,
      status: 'approved',
      isDraft: false,
      updatedAt: new Date().toISOString(),
      migrationNote: 'Migrated from Internal Assessment to Pre-Board Test as per administrator directive',
      migratedAt: new Date().toISOString()
    };

    // 3. Backup to practicalsBin collection
    const binDocId = `bin_migration_${oldId}_${Date.now()}`;
    const binDocRef = doc(db, 'practicalsBin', binDocId);
    console.log(`   Saving backup to practicalsBin (${binDocId})...`);
    await setDoc(binDocRef, {
      originalDocId: oldId,
      targetNewDocId: newId,
      archivedAt: new Date().toISOString(),
      archivedBy: 'adm.exam.hss.shangus@gmail.com',
      reason: 'Migrated IT and ITES awards from Internal Assessment to Pre-Board Test',
      data: oldData
    });
    console.log(`   Backup saved to practicalsBin.`);

    // 4. Write new Pre-Board Test document to practicalsData
    console.log(`   Writing target document ${newId} to practicalsData...`);
    const newDocRef = doc(db, 'practicalsData', newId);
    await setDoc(newDocRef, newPayload);
    console.log(`   Successfully created ${newId}!`);

    // 5. Delete old Internal Assessment document from practicalsData
    console.log(`   Removing old document ${oldId} from practicalsData to clear slot for upcoming Internal Assessment...`);
    await deleteDoc(oldDocRef);
    console.log(`   Successfully deleted ${oldId}!`);
  }

  // Save local JSON backup
  const backupFilePath = path.join(backupDir, `it_internal_awards_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
  console.log(`\nLocal disk backup written to: ${backupFilePath}`);

  // 6. Log activity in activityLogs
  try {
    console.log("\nLogging migration to activityLogs...");
    await addDoc(collection(db, 'activityLogs'), {
      actionType: 'update',
      actionTitle: 'Migrated IT & ITES Awards to Pre-Board Test',
      details: 'Administrator moved IT and ITES awards from Internal Assessment to Pre-Board Test for Classes 10th, 11th, and 12th. Internal Assessment slots freed for upcoming assessments.',
      performedBy: 'adm.exam.hss.shangus@gmail.com',
      performedByName: 'Examination Administrator',
      targetCollection: 'practicalsData',
      affectedClasses: TARGET_CLASSES,
      timestamp: new Date().toISOString(),
      metadata: {
        subject: 'IT and ITES',
        fromEvaluationType: 'Internal Assessment',
        toEvaluationType: 'Pre-Board Test',
        session: '2025-26',
        classes: TARGET_CLASSES
      }
    });
    console.log("Activity log recorded.");
  } catch (logErr) {
    console.warn("Activity log note:", logErr?.message || logErr);
  }

  // 7. Verify migration
  console.log("\n=== Verifying Final Database State ===");
  for (const cls of TARGET_CLASSES) {
    const oldId = `${cls}_IT and ITES_Internal Assessment_2025-26`;
    const newId = `${cls}_IT and ITES_Pre-Board Test_2025-26`;

    const oldSnap = await getDoc(doc(db, 'practicalsData', oldId));
    const newSnap = await getDoc(doc(db, 'practicalsData', newId));

    console.log(`Class ${cls}:`);
    console.log(`  - Old ID ${oldId}: ${oldSnap.exists() ? 'STILL EXISTS (ERROR)' : 'DELETED (CLEARED FOR UPCOMING INTERNAL)'}`);
    console.log(`  - New ID ${newId}: ${newSnap.exists() ? `ACTIVE (${newSnap.data().records?.length} records, maxMarks: ${newSnap.data().maxMarks})` : 'MISSING (ERROR)'}`);
  }

  console.log("\nMigration completed successfully!");
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
