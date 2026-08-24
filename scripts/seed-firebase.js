/**
 * seed-firebase.js
 * 
 * One-time script to seed Firestore with the full local data.
 * Run from the project root: node scripts/seed-firebase.js
 * 
 * Requires: firebase-admin (installed via npm)
 * Requires: A Firebase service account key JSON file
 * 
 * ALTERNATIVE: Since the Firestore rules already hardcode the admin email,
 * you can also seed by simply signing into the admin panel with Google
 * (adm.exam.hss.shangus@gmail.com) and clicking "Apply & Save".
 * The auto-sign-in feature will handle the rest.
 */

const fs = require('fs');
const path = require('path');
const { toPublicFacultyMember } = require('./generate-public-faculty');

// Try to load firebase-admin
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('firebase-admin not installed. Run: npm install firebase-admin');
  console.error('\nALTERNATIVE: Open the admin panel at http://localhost:3000/admin,');
  console.error('sign in with Google (adm.exam.hss.shangus@gmail.com), and click "Apply & Save".');
  console.error('The auto-sign-in feature will seed Firestore automatically.');
  process.exit(1);
}

// Path to service account key
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Service account key not found at: ${SERVICE_ACCOUNT_PATH}`);
  console.error('\nTo get one:');
  console.error('1. Go to https://console.firebase.google.com/project/hsssdb/settings/serviceaccounts/adminsdk');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save the file as scripts/serviceAccountKey.json');
  console.error('\nALTERNATIVE: Open the admin panel, sign in with Google, and click "Apply & Save".');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hsssdb'
});

const db = admin.firestore();
const slidesDir = path.join(__dirname, '..', 'public', 'slides');

async function seed() {
  console.log('Seeding Firestore with local data...\n');

  // 1. Settings
  try {
    const settingsRaw = fs.readFileSync(path.join(slidesDir, 'settings.json'), 'utf8');
    const settings = JSON.parse(settingsRaw);
    await db.doc('site/settings').set(settings);
    console.log('✅ site/settings — written (' + Object.keys(settings).length + ' top-level keys)');
  } catch (e) {
    console.error('❌ site/settings — failed:', e.message);
  }

  // 2. Faculty. The public file is already data-minimised. A private source
  // may be supplied explicitly as argv[2], but it must not live under public/.
  try {
    const facultyRaw = fs.readFileSync(path.join(slidesDir, 'faculty.json'), 'utf8');
    const publicFaculty = JSON.parse(facultyRaw).map(toPublicFacultyMember).filter(Boolean);
    const batch = db.batch();
    const existing = await db.collection('facultyPublic').get();
    existing.docs.forEach(doc => batch.delete(doc.ref));
    publicFaculty.forEach((member, index) => {
      const safeId = `${member.name}-${member.designation}-${index}`.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
      batch.set(db.collection('facultyPublic').doc(safeId || `staff-${index}`), member);
    });
    await batch.commit();
    const principal = publicFaculty.find(member => member.designation.toLowerCase() === 'principal');
    await db.doc('site/facultySummary').set({ principalName: principal?.name || '', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await db.doc('site/faculty').set({ items: publicFaculty, privacyVersion: 2, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log('✅ public faculty projection — written (' + publicFaculty.length + ' employees)');

    const privateArg = process.argv[2];
    if (privateArg) {
      const privatePath = path.resolve(privateArg);
      const publicRoot = path.resolve(__dirname, '..', 'public') + path.sep;
      if (privatePath.startsWith(publicRoot)) throw new Error('Private faculty source must not be inside public/.');
      const privateFaculty = JSON.parse(fs.readFileSync(privatePath, 'utf8'));
      if (!Array.isArray(privateFaculty)) throw new Error('Private faculty source must be an array.');
      await db.doc('systemSettings/facultyPrivate').set({
        items: privateFaculty.slice(0, 150),
        privacyVersion: 2,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ systemSettings/facultyPrivate — written from explicit private source');
    }
  } catch (e) {
    console.error('❌ faculty projection — failed:', e.message);
  }

  // 3. Notices
  try {
    const noticesText = fs.readFileSync(path.join(slidesDir, 'notices.txt'), 'utf8');
    await db.doc('site/notices').set({ text: noticesText });
    console.log('✅ site/notices — written (' + noticesText.split('\n').filter(Boolean).length + ' notices)');
  } catch (e) {
    console.error('❌ site/notices — failed:', e.message);
  }

  console.log('\n🎉 Seeding complete! Verify at:');
  console.log('   https://console.firebase.google.com/project/hsssdb/firestore/databases/-default-/data/~2Fsite');
}

seed().then(() => process.exit(0)).catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
