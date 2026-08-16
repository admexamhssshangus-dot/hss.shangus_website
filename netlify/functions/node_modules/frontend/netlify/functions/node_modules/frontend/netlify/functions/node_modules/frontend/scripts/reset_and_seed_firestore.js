#!/usr/bin/env node
/**
 * Firestore reset and seed script
 *
 * Usage:
 * 1. Create a service account JSON in Firebase Console (Project Settings -> Service Accounts)
 * 2. Download the JSON and set env var: `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` (Windows PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS='C:\path\to\key.json')
 * 3. Install deps: `npm install firebase-admin --save-dev`
 * 4. Run: `node scripts/reset_and_seed_firestore.js`
 *
 * WARNING: This will permanently delete the specified collections and their documents.
 */

const admin = require('firebase-admin');
const fs = require('fs');

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error('ERROR: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath))
});

const db = admin.firestore();

async function deleteDocRecursive(docRef) {
  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    const docs = await sub.listDocuments();
    for (const sd of docs) {
      await deleteDocRecursive(sd);
    }
  }
  await docRef.delete();
  console.log('Deleted', docRef.path);
}

async function deleteCollection(collPath) {
  const collRef = db.collection(collPath);
  const docs = await collRef.listDocuments();
  for (const d of docs) {
    await deleteDocRecursive(d);
  }
  console.log('Collection cleared:', collPath);
}

async function exportCollectionToArray(collPath) {
  const collRef = db.collection(collPath);
  const docs = await collRef.listDocuments();
  const out = [];
  for (const d of docs) {
    try {
      const snap = await d.get();
      out.push({ id: d.id, data: snap.exists ? snap.data() : null });
    } catch (e) {
      console.warn('Failed to read doc for backup', d.path, e);
    }
  }
  return out;
}

async function seedSite() {
  const settings = {
    defaultNewNoticeDays: 7,
    globalAdmissionsClosed: false,
    socialLinks: { facebook: '#', youtube: '#', twitter: '#', instagram: '#' }
  };

  const notices = { text: '' };
  const faculty = { items: [] };
  const admins = {
    items: [ { email: 'adm.exam.hss.shangus@gmail.com', role: 'Super Admin' } ],
    emails: [ 'adm.exam.hss.shangus@gmail.com' ]
  };

  await db.collection('site').doc('settings').set(settings);
  await db.collection('site').doc('notices').set(notices);
  await db.collection('site').doc('faculty').set(faculty);
  await db.collection('site').doc('admins').set(admins);

  console.log('Seeded site documents: settings, notices, faculty, admins');
}

async function main() {
  try {
    const argv = process.argv.slice(2);
    const yes = argv.includes('--yes') || argv.includes('-y');
    const backupOnly = argv.includes('--backup-only');
    const collectionsArgIndex = argv.findIndex(a => a.startsWith('--collections='));
    let toDelete = ['attendance', 'admissions', 'users', 'site'];
    if (collectionsArgIndex !== -1) {
      const val = argv[collectionsArgIndex].split('=')[1] || '';
      toDelete = val.split(',').map(s => s.trim()).filter(Boolean);
    }

    console.log('Collections targeted:', toDelete.join(', '));

    if (!yes) {
      // interactive confirmation
      const prompt = `\nThis will DELETE documents in: ${toDelete.join(', ')}\nType DELETE to proceed: `;
      process.stdout.write(prompt);
      const input = await new Promise((resolve) => {
        const stdin = process.stdin;
        stdin.setEncoding('utf8');
        stdin.once('data', d => resolve(d.toString().trim()));
      });
      if (input !== 'DELETE') {
        console.log('Aborted by user. No changes made.');
        process.exit(0);
      }
    }

    // Backup existing collections first
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `${__dirname}/backups`;
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = `${backupDir}/firestore-backup-${timestamp}.json`;
    const backupObj = {};
    for (const c of toDelete) {
      console.log('Exporting collection for backup:', c);
      backupObj[c] = await exportCollectionToArray(c);
    }
    fs.writeFileSync(backupFile, JSON.stringify(backupObj, null, 2));
    console.log('Backup written to', backupFile);

    if (backupOnly) {
      console.log('Backup-only mode; exiting without deleting.');
      process.exit(0);
    }

    for (const c of toDelete) {
      console.log('Deleting collection (if exists):', c);
      await deleteCollection(c);
    }

    // Recreate minimal site docs
    await seedSite();
    console.log('\nReset and seed complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during reset/seed:', err);
    process.exit(2);
  }
}

main();
