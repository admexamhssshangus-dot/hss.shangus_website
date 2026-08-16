#!/usr/bin/env node
/**
 * Firebase Data & Storage Export Script
 *
 * Usage:
 * 1. Go to Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
 * 2. Save the downloaded JSON file to your computer.
 * 3. Set the environment variable GOOGLE_APPLICATION_CREDENTIALS to the path of the JSON file:
 *    - Windows PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your-key.json"
 *    - Mac/Linux: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-key.json"
 * 4. Run: node scripts/export_all_data.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error('ERROR: You must set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  console.error('Please see the instructions at the top of this script.');
  process.exit(1);
}

// Initialize Firebase Admin with the credentials and the storage bucket
admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
  storageBucket: 'hsssdb.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

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

async function exportStorageFolder(folderPrefix, outputDir) {
  console.log(`\nFetching list of files in storage folder: ${folderPrefix}...`);
  const [files] = await bucket.getFiles({ prefix: folderPrefix });

  if (files.length === 0) {
    console.log(`No files found in ${folderPrefix}`);
    return;
  }

  console.log(`Found ${files.length} files. Starting download...`);
  for (const file of files) {
    // Skip placeholder "folders" if they exist
    if (file.name.endsWith('/')) continue;

    // Create the local file path mirroring the storage path
    const localFilePath = path.join(outputDir, file.name);
    const localDir = path.dirname(localFilePath);
    
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    console.log(`Downloading: ${file.name} -> ${localFilePath}`);
    await file.download({ destination: localFilePath });
  }
  console.log('Finished downloading files.');
}

async function main() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', `export-${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`=== Exporting Data to: ${backupDir} ===`);

    // 1. Export Firestore Collections
    const collectionsToExport = ['site', 'admissions', 'attendance', 'users'];
    const dbBackupFile = path.join(backupDir, 'firestore-backup.json');
    const backupObj = {};
    
    for (const c of collectionsToExport) {
      console.log(`Exporting Firestore collection: ${c}`);
      backupObj[c] = await exportCollectionToArray(c);
    }
    
    fs.writeFileSync(dbBackupFile, JSON.stringify(backupObj, null, 2));
    console.log(`Firestore backup saved to: ${dbBackupFile}`);

    // 2. Export Storage Images
    const storageBackupDir = path.join(backupDir, 'storage');
    // The main folder containing your uploaded photos
    await exportStorageFolder('slides/photos/', storageBackupDir);

    console.log(`\n=== Export Complete! ===`);
    console.log(`All data and images have been saved to: ${backupDir}`);
    process.exit(0);
  } catch (err) {
    console.error('Error during export:', err);
    process.exit(2);
  }
}

main();
